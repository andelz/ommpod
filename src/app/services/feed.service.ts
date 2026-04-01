import { Injectable, inject, signal } from '@angular/core';
import { Episode } from '../models/podcast.model';
import { LibraryService } from './library.service';
import { PodcastSearchService } from './podcast-search.service';
import { PersistenceService } from './persistence.service';

export interface FeedEntry {
  episode: Episode;
  podcastArtworkUrl: string;
}

const MAX_FEED_ENTRIES = 30;
const MEMORY_CACHE_TTL = 10 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class FeedService {
  private library = inject(LibraryService);
  private search = inject(PodcastSearchService);
  private persistence = inject(PersistenceService);

  entries = signal<FeedEntry[]>([]);
  loading = signal(false);
  refreshing = signal(false);
  error = signal('');

  private cache: { key: string; data: FeedEntry[]; ts: number } | null = null;

  async loadFeed(): Promise<void> {
    const subs = this.library.subscriptions();
    if (subs.length === 0) {
      this.entries.set([]);
      return;
    }

    const subsKey = subs.map(p => p.id).sort().join(',');

    // Fast path: in-memory cache
    if (this.cache && this.cache.key === subsKey && Date.now() - this.cache.ts < MEMORY_CACHE_TTL) {
      this.entries.set(this.cache.data);
      return;
    }

    // Try IndexedDB cache
    let cachedEntries: FeedEntry[] | null = null;
    let cachedAt: string | null = null;
    try {
      const record = await this.persistence.getFeedCache('home');
      if (record && record.subsKey === subsKey) {
        cachedEntries = this.deserializeEntries(record.entries);
        cachedAt = record.cachedAt;
        this.entries.set(cachedEntries);
      }
    } catch {
      // IndexedDB read failed, proceed with network fetch
    }

    if (cachedEntries) {
      this.refreshing.set(true);
    } else {
      this.loading.set(true);
    }
    this.error.set('');

    try {
      const results = await Promise.allSettled(
        subs.map(async podcast => {
          const episodes = await this.search.fetchEpisodes(podcast);
          return episodes.map(ep => ({
            episode: ep,
            podcastArtworkUrl: podcast.artworkUrl,
          }));
        })
      );

      const fetched: FeedEntry[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          fetched.push(...result.value);
        }
      }

      let merged: FeedEntry[];
      if (cachedEntries && cachedAt) {
        // Filter fetched to only new episodes (published after cache date)
        const cutoff = new Date(cachedAt).getTime();
        const newEntries = fetched.filter(e => new Date(e.episode.pubDate).getTime() > cutoff);

        // Merge new + cached, deduplicate by audioUrl
        const seen = new Set<string>();
        const combined: FeedEntry[] = [];
        for (const entry of [...newEntries, ...cachedEntries]) {
          if (!seen.has(entry.episode.audioUrl)) {
            seen.add(entry.episode.audioUrl);
            combined.push(entry);
          }
        }
        merged = combined;
      } else {
        merged = fetched;
      }

      merged.sort((a, b) => new Date(b.episode.pubDate).getTime() - new Date(a.episode.pubDate).getTime());
      merged = merged.slice(0, MAX_FEED_ENTRIES);

      this.entries.set(merged);
      this.cache = { key: subsKey, data: merged, ts: Date.now() };

      // Persist to IndexedDB
      try {
        await this.persistence.putFeedCache({
          id: 'home',
          entries: this.serializeEntries(merged),
          cachedAt: new Date().toISOString(),
          subsKey,
        });
      } catch {
        // IndexedDB write failed, non-critical
      }
    } catch {
      if (!cachedEntries) {
        this.error.set('could not load feed');
      }
    } finally {
      this.loading.set(false);
      this.refreshing.set(false);
    }
  }

  private serializeEntries(entries: FeedEntry[]): { episode: Record<string, unknown>; podcastArtworkUrl: string }[] {
    return entries.map(e => ({
      episode: { ...e.episode, pubDate: new Date(e.episode.pubDate).toISOString() },
      podcastArtworkUrl: e.podcastArtworkUrl,
    }));
  }

  private deserializeEntries(entries: { episode: Record<string, unknown>; podcastArtworkUrl: string }[]): FeedEntry[] {
    return entries.map(e => ({
      episode: { ...e.episode, pubDate: new Date(e.episode['pubDate'] as string) } as Episode,
      podcastArtworkUrl: e.podcastArtworkUrl,
    }));
  }
}
