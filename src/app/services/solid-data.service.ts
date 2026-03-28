import { Injectable, inject } from '@angular/core';
import {
  createSolidDataset,
  createThing,
  setThing,
  removeThing,
  getSolidDataset,
  saveSolidDatasetAt,
  createContainerAt,
  getThingAll,
  getStringNoLocale,
  getUrl,
  getInteger,
  getDecimal,
  getDatetime,
  setStringNoLocale,
  setUrl,
  setInteger,
  setDecimal,
  setDatetime,
  SolidDataset,
  Thing,
} from '@inrupt/solid-client';
import { SCHEMA_INRUPT } from '@inrupt/vocab-common-rdf';
import { Podcast } from '../models/podcast.model';
import { SolidAuthService } from './solid-auth.service';

/**
 * Custom RDF vocabulary namespace for predicates not covered by schema.org.
 * In production, this should point to a real, dereferenceable vocabulary document.
 */
const POD_VOCAB = 'https://pod-app.example/vocab#';
const SCHEMA = 'https://schema.org/';

/** Playback position in seconds (decimal). */
const PLAYBACK_POSITION = `${POD_VOCAB}playbackPosition`;

/** Timestamp when an episode was marked as completed. */
const COMPLETED_AT = `${POD_VOCAB}completedAt`;

/*
 * The following schema.org predicates are not exported by `@inrupt/vocab-common-rdf`,
 * so we reference them by their full URI strings.
 */
const SCHEMA_AUTHOR = `${SCHEMA}author`;
const SCHEMA_GENRE = `${SCHEMA}genre`;
const SCHEMA_NUMBER_OF_EPISODES = `${SCHEMA}numberOfEpisodes`;

/**
 * Low-level data access layer for reading and writing app data in a Solid Pod.
 *
 * ## Pod resource layout
 *
 * All resources live under a single container at `<podRoot>/podcasts/`:
 *
 * ```
 * <podRoot>/podcasts/          ← LDP container (created by ensureContainer)
 *   subscriptions              ← SolidDataset: one Thing per subscribed Podcast
 *   progress                   ← SolidDataset: one Thing per episode with playback position
 *   completed                  ← SolidDataset: one Thing per completed episode ID
 * ```
 *
 * Each resource is a single Turtle document (SolidDataset). This flat layout
 * avoids the overhead of one-resource-per-podcast, which would mean N HTTP
 * requests to sync N subscriptions.
 *
 * ## RDF mapping
 *
 * App models are mapped to RDF using **schema.org** where possible, supplemented
 * by a small custom vocabulary (`pod:`) for podcast-specific concepts:
 *
 * | App field               | RDF predicate                    | RDF type          |
 * |-------------------------|----------------------------------|-------------------|
 * | Podcast.id              | `schema:identifier`              | xsd:string        |
 * | Podcast.title           | `schema:name`                    | xsd:string        |
 * | Podcast.author          | `schema:author`                  | xsd:string        |
 * | Podcast.feedUrl         | `schema:url`                     | Named node (URL)  |
 * | Podcast.artworkUrl      | `schema:image`                   | Named node (URL)  |
 * | Podcast.genre           | `schema:genre`                   | xsd:string        |
 * | Podcast.episodeCount    | `schema:numberOfEpisodes`        | xsd:integer       |
 * | Progress.currentTime    | `pod:playbackPosition`           | xsd:decimal       |
 * | Progress.lastUpdated    | `schema:dateModified`            | xsd:dateTime      |
 * | Completed.completedAt   | `pod:completedAt`                | xsd:dateTime      |
 *
 * Each Thing within a dataset is identified by a fragment URI derived from
 * the entity's ID: `<resourceUrl>#<encodeURIComponent(id)>`.
 *
 * ## Write strategy (fetchOrCreate)
 *
 * All write methods follow the same pattern to avoid HTTP 412 (Precondition Failed):
 *
 * 1. **Fetch** the existing dataset — this preserves the server's ETag metadata
 *    so `saveSolidDatasetAt` can send a correct `If-Match` header.
 * 2. If the resource doesn't exist yet (404), fall back to a fresh `createSolidDataset()`
 *    which carries no ETag, causing the library to create the resource with `If-None-Match: *`.
 * 3. **Clear** all existing Things, **repopulate** with the new data, and **save**.
 */
@Injectable({ providedIn: 'root' })
export class SolidDataService {
  private solidAuth = inject(SolidAuthService);

  /** Returns the authenticated fetch function that attaches the user's access token. */
  private get fetch(): typeof globalThis.fetch {
    return this.solidAuth.session.fetch;
  }

  /** Builds the `/podcasts/` container URL from the discovered Pod root. */
  private get containerUrl(): string | null {
    const pod = this.solidAuth.podUrl();
    return pod ? `${pod.replace(/\/$/, '')}/podcasts/` : null;
  }

  /** Builds the full URL for a named resource inside the podcasts container. */
  private resourceUrl(name: string): string | null {
    const container = this.containerUrl;
    return container ? `${container}${name}` : null;
  }

  /**
   * Creates the `<podRoot>/podcasts/` container if it doesn't exist.
   * Called once at the start of a full sync. If the container already exists,
   * the GET succeeds and no creation is attempted.
   */
  async ensureContainer(): Promise<void> {
    const url = this.containerUrl;
    if (!url) return;
    try {
      await getSolidDataset(url, { fetch: this.fetch });
    } catch {
      await createContainerAt(url, { fetch: this.fetch });
    }
  }

  // ── Subscriptions ─────────────────────────────────────────────────────

  /**
   * Reads all subscribed podcasts from the Pod.
   * @returns An array of {@link Podcast} objects, or `[]` if the resource doesn't exist.
   */
  async readSubscriptions(): Promise<Podcast[]> {
    const url = this.resourceUrl('subscriptions');
    if (!url) return [];
    try {
      const dataset = await getSolidDataset(url, { fetch: this.fetch });
      return getThingAll(dataset).map(thing => this.thingToPodcast(thing));
    } catch {
      return [];
    }
  }

  /**
   * Replaces the entire subscriptions resource with the given podcast list.
   * Uses the {@link fetchOrCreate} strategy to avoid 412 errors.
   */
  async writeSubscriptions(podcasts: Podcast[]): Promise<void> {
    const url = this.resourceUrl('subscriptions');
    if (!url) return;
    let dataset = await this.fetchOrCreate(url);
    for (const thing of getThingAll(dataset)) {
      dataset = removeThing(dataset, thing);
    }
    for (const podcast of podcasts) {
      dataset = setThing(dataset, this.podcastToThing(podcast, url));
    }
    await saveSolidDatasetAt(url, dataset, { fetch: this.fetch });
  }

  // ── Progress ──────────────────────────────────────────────────────────

  /**
   * Reads all playback progress entries from the Pod.
   *
   * Each entry maps an episode ID to its playback position (seconds) and
   * a last-updated timestamp. The timestamp is used for last-write-wins
   * conflict resolution during merge in {@link SolidSyncService}.
   *
   * @returns A record of `episodeId → { time, updatedAt }`, or `{}` if empty/missing.
   */
  async readProgress(): Promise<Record<string, { time: number; updatedAt: number }>> {
    const url = this.resourceUrl('progress');
    if (!url) return {};
    try {
      const dataset = await getSolidDataset(url, { fetch: this.fetch });
      const result: Record<string, { time: number; updatedAt: number }> = {};
      for (const thing of getThingAll(dataset)) {
        const id = getStringNoLocale(thing, SCHEMA_INRUPT.identifier);
        const time = getDecimal(thing, PLAYBACK_POSITION);
        const updated = getDatetime(thing, SCHEMA_INRUPT.dateModified);
        if (id != null && time != null) {
          result[id] = { time, updatedAt: updated?.getTime() ?? 0 };
        }
      }
      return result;
    } catch {
      return {};
    }
  }

  /**
   * Replaces the entire progress resource with the given entries.
   * Uses the {@link fetchOrCreate} strategy to avoid 412 errors.
   */
  async writeProgress(progress: Record<string, { time: number; updatedAt: number }>): Promise<void> {
    const url = this.resourceUrl('progress');
    if (!url) return;
    let dataset = await this.fetchOrCreate(url);
    for (const thing of getThingAll(dataset)) {
      dataset = removeThing(dataset, thing);
    }
    for (const [episodeId, { time, updatedAt }] of Object.entries(progress)) {
      let thing = createThing({ url: `${url}#${encodeURIComponent(episodeId)}` });
      thing = setStringNoLocale(thing, SCHEMA_INRUPT.identifier, episodeId);
      thing = setDecimal(thing, PLAYBACK_POSITION, time);
      thing = setDatetime(thing, SCHEMA_INRUPT.dateModified, new Date(updatedAt));
      dataset = setThing(dataset, thing);
    }
    await saveSolidDatasetAt(url, dataset, { fetch: this.fetch });
  }

  // ── Completed ─────────────────────────────────────────────────────────

  /**
   * Reads the list of completed episode IDs from the Pod.
   * @returns An array of episode ID strings, or `[]` if the resource doesn't exist.
   */
  async readCompleted(): Promise<string[]> {
    const url = this.resourceUrl('completed');
    if (!url) return [];
    try {
      const dataset = await getSolidDataset(url, { fetch: this.fetch });
      return getThingAll(dataset)
        .map(thing => getStringNoLocale(thing, SCHEMA_INRUPT.identifier))
        .filter((id): id is string => id != null);
    } catch {
      return [];
    }
  }

  /**
   * Replaces the entire completed-episodes resource with the given IDs.
   * Uses the {@link fetchOrCreate} strategy to avoid 412 errors.
   */
  async writeCompleted(ids: string[]): Promise<void> {
    const url = this.resourceUrl('completed');
    if (!url) return;
    let dataset = await this.fetchOrCreate(url);
    for (const thing of getThingAll(dataset)) {
      dataset = removeThing(dataset, thing);
    }
    for (const episodeId of ids) {
      let thing = createThing({ url: `${url}#${encodeURIComponent(episodeId)}` });
      thing = setStringNoLocale(thing, SCHEMA_INRUPT.identifier, episodeId);
      thing = setDatetime(thing, COMPLETED_AT, new Date());
      dataset = setThing(dataset, thing);
    }
    await saveSolidDatasetAt(url, dataset, { fetch: this.fetch });
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  /**
   * Fetches an existing SolidDataset (preserving server-side ETag metadata),
   * or returns a fresh empty dataset if the resource doesn't exist yet.
   *
   * This is critical for avoiding HTTP 412 (Precondition Failed): the Inrupt
   * library attaches `If-Match: <etag>` when saving a previously fetched dataset,
   * but sends `If-None-Match: *` for a brand-new one. Without this helper,
   * saving a `createSolidDataset()` to an existing resource would fail because
   * the server expects the ETag.
   */
  private async fetchOrCreate(url: string): Promise<SolidDataset> {
    try {
      return await getSolidDataset(url, { fetch: this.fetch });
    } catch {
      return createSolidDataset();
    }
  }

  // ── Mapping helpers ───────────────────────────────────────────────────

  /**
   * Converts a {@link Podcast} app model to an RDF Thing for storage in the Pod.
   * The Thing's URL is `<baseUrl>#<encodedId>`, making it addressable within the dataset.
   */
  private podcastToThing(podcast: Podcast, baseUrl: string): Thing {
    let thing = createThing({ url: `${baseUrl}#${encodeURIComponent(podcast.id)}` });
    thing = setStringNoLocale(thing, SCHEMA_INRUPT.identifier, podcast.id);
    thing = setStringNoLocale(thing, SCHEMA_INRUPT.name, podcast.title);
    thing = setStringNoLocale(thing, SCHEMA_AUTHOR, podcast.author);
    thing = setUrl(thing, SCHEMA_INRUPT.url, podcast.feedUrl);
    thing = setUrl(thing, SCHEMA_INRUPT.image, podcast.artworkUrl);
    thing = setStringNoLocale(thing, SCHEMA_GENRE, podcast.genre);
    thing = setInteger(thing, SCHEMA_NUMBER_OF_EPISODES, podcast.episodeCount);
    return thing;
  }

  /**
   * Converts an RDF Thing from the Pod back to a {@link Podcast} app model.
   * Missing fields default to empty strings or zero.
   */
  private thingToPodcast(thing: Thing): Podcast {
    return {
      id: getStringNoLocale(thing, SCHEMA_INRUPT.identifier) ?? '',
      title: getStringNoLocale(thing, SCHEMA_INRUPT.name) ?? '',
      author: getStringNoLocale(thing, SCHEMA_AUTHOR) ?? '',
      feedUrl: getUrl(thing, SCHEMA_INRUPT.url) ?? '',
      artworkUrl: getUrl(thing, SCHEMA_INRUPT.image) ?? '',
      genre: getStringNoLocale(thing, SCHEMA_GENRE) ?? '',
      episodeCount: getInteger(thing, SCHEMA_NUMBER_OF_EPISODES) ?? 0,
    };
  }
}
