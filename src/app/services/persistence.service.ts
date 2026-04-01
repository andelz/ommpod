import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';
import { Podcast, Episode } from '../models/podcast.model';

const DB_NAME = 'pod-db';
const DB_VERSION = 2;

interface ProgressEntry {
  episodeId: string;
  currentTime: number;
  updatedAt: number;
}

interface CompletedEntry {
  episodeId: string;
  completedAt: number;
}

export interface FeedCacheRecord {
  id: string;
  entries: { episode: Record<string, unknown>; podcastArtworkUrl: string }[];
  cachedAt: string;
  subsKey: string;
}

@Injectable({ providedIn: 'root' })
export class PersistenceService {
  private db: Promise<IDBPDatabase>;

  constructor() {
    this.db = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('subscriptions')) {
          db.createObjectStore('subscriptions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'episodeId' });
        }
        if (!db.objectStoreNames.contains('completed')) {
          db.createObjectStore('completed', { keyPath: 'episodeId' });
        }
        if (!db.objectStoreNames.contains('downloads')) {
          db.createObjectStore('downloads', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('feed-cache')) {
          db.createObjectStore('feed-cache', { keyPath: 'id' });
        }
      },
    });
  }

  // ── Subscriptions ──

  async getSubscriptions(): Promise<Podcast[]> {
    return (await this.db).getAll('subscriptions');
  }

  async putSubscription(podcast: Podcast): Promise<void> {
    await (await this.db).put('subscriptions', podcast);
  }

  async deleteSubscription(podcastId: string): Promise<void> {
    await (await this.db).delete('subscriptions', podcastId);
  }

  async replaceAllSubscriptions(podcasts: Podcast[]): Promise<void> {
    const db = await this.db;
    const tx = db.transaction('subscriptions', 'readwrite');
    await tx.store.clear();
    for (const p of podcasts) {
      await tx.store.put(p);
    }
    await tx.done;
  }

  // ── Playback progress ──

  async getProgress(episodeId: string): Promise<number> {
    const entry: ProgressEntry | undefined = await (await this.db).get('progress', episodeId);
    return entry?.currentTime ?? 0;
  }

  async getAllProgress(): Promise<Record<string, number>> {
    const entries: ProgressEntry[] = await (await this.db).getAll('progress');
    const result: Record<string, number> = {};
    for (const e of entries) {
      result[e.episodeId] = e.currentTime;
    }
    return result;
  }

  async putProgress(episodeId: string, currentTime: number): Promise<void> {
    const entry: ProgressEntry = { episodeId, currentTime, updatedAt: Date.now() };
    await (await this.db).put('progress', entry);
  }

  async deleteProgress(episodeId: string): Promise<void> {
    await (await this.db).delete('progress', episodeId);
  }

  async replaceAllProgress(progress: Record<string, number>): Promise<void> {
    const db = await this.db;
    const tx = db.transaction('progress', 'readwrite');
    await tx.store.clear();
    const now = Date.now();
    for (const [episodeId, currentTime] of Object.entries(progress)) {
      await tx.store.put({ episodeId, currentTime, updatedAt: now } satisfies ProgressEntry);
    }
    await tx.done;
  }

  // ── Completed episodes ──

  async getCompletedIds(): Promise<string[]> {
    const entries: CompletedEntry[] = await (await this.db).getAll('completed');
    return entries.map(e => e.episodeId);
  }

  async putCompleted(episodeId: string): Promise<void> {
    const entry: CompletedEntry = { episodeId, completedAt: Date.now() };
    await (await this.db).put('completed', entry);
  }

  async replaceAllCompleted(ids: string[]): Promise<void> {
    const db = await this.db;
    const tx = db.transaction('completed', 'readwrite');
    await tx.store.clear();
    const now = Date.now();
    for (const episodeId of ids) {
      await tx.store.put({ episodeId, completedAt: now } satisfies CompletedEntry);
    }
    await tx.done;
  }

  // ── Download metadata ──

  async getDownloadedEpisodes(): Promise<Episode[]> {
    return (await this.db).getAll('downloads');
  }

  async putDownloadMeta(episode: Episode): Promise<void> {
    await (await this.db).put('downloads', episode);
  }

  async deleteDownloadMeta(episodeId: string): Promise<void> {
    await (await this.db).delete('downloads', episodeId);
  }

  // ── Feed cache ──

  async getFeedCache(id: string): Promise<FeedCacheRecord | undefined> {
    return (await this.db).get('feed-cache', id);
  }

  async putFeedCache(record: FeedCacheRecord): Promise<void> {
    await (await this.db).put('feed-cache', record);
  }

  async clearFeedCache(): Promise<void> {
    await (await this.db).clear('feed-cache');
  }
}
