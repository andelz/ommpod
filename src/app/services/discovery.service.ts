import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Podcast } from '../models/podcast.model';
import { LibraryService } from './library.service';
import { PodcastSearchService } from './podcast-search.service';

export interface GenreRecommendations {
  genre: string;
  podcasts: Podcast[];
}

@Injectable({ providedIn: 'root' })
export class DiscoveryService {
  private library = inject(LibraryService);
  private search = inject(PodcastSearchService);

  recommendations = signal<GenreRecommendations[]>([]);
  loading = signal(false);
  error = signal('');

  private cache: { key: string; data: GenreRecommendations[]; ts: number } | null = null;
  private readonly CACHE_TTL = 10 * 60 * 1000;

  async loadRecommendations(): Promise<void> {
    const subs = this.library.subscriptions();
    if (subs.length === 0) {
      this.recommendations.set([]);
      return;
    }

    const genres = [...new Set(subs.map(p => p.genre))].filter(Boolean).slice(0, 5);
    if (genres.length === 0) {
      this.recommendations.set([]);
      return;
    }

    const cacheKey = subs.map(p => p.id).sort().join(',') + '|' + genres.join(',');
    if (this.cache && this.cache.key === cacheKey && Date.now() - this.cache.ts < this.CACHE_TTL) {
      this.recommendations.set(this.cache.data);
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      const subscribedIds = new Set(subs.map(p => p.id));
      const results = await Promise.allSettled(
        genres.map(genre => firstValueFrom(this.search.search(genre)))
      );

      const sections: GenreRecommendations[] = [];
      for (let i = 0; i < genres.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled' && result.value) {
          const filtered = result.value.filter(p => !subscribedIds.has(p.id));
          if (filtered.length > 0) {
            sections.push({ genre: genres[i], podcasts: filtered });
          }
        }
      }

      this.recommendations.set(sections);
      this.cache = { key: cacheKey, data: sections, ts: Date.now() };
    } catch {
      this.error.set('could not load recommendations');
    } finally {
      this.loading.set(false);
    }
  }
}
