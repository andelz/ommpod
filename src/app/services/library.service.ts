import { Injectable, signal } from '@angular/core';
import { Podcast, Episode } from '../models/podcast.model';

const STORAGE_KEY_PODCASTS = 'pod-subscriptions';
const STORAGE_KEY_PROGRESS = 'pod-playback-progress';
const STORAGE_KEY_COMPLETED = 'pod-completed-episodes';

@Injectable({ providedIn: 'root' })
export class LibraryService {
  subscriptions = signal<Podcast[]>(this.loadSubscriptions());
  completedEpisodes = signal<Set<string>>(this.loadCompleted());

  subscribe(podcast: Podcast): void {
    const current = this.subscriptions();
    if (current.some(p => p.id === podcast.id)) return;
    const updated = [...current, podcast];
    this.subscriptions.set(updated);
    localStorage.setItem(STORAGE_KEY_PODCASTS, JSON.stringify(updated));
  }

  unsubscribe(podcastId: string): void {
    const updated = this.subscriptions().filter(p => p.id !== podcastId);
    this.subscriptions.set(updated);
    localStorage.setItem(STORAGE_KEY_PODCASTS, JSON.stringify(updated));
  }

  isSubscribed(podcastId: string): boolean {
    return this.subscriptions().some(p => p.id === podcastId);
  }

  saveProgress(episodeId: string, time: number): void {
    const all = this.loadAllProgress();
    all[episodeId] = time;
    localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(all));
  }

  getProgress(episodeId: string): number {
    return this.loadAllProgress()[episodeId] ?? 0;
  }

  markCompleted(episodeId: string): void {
    const ids = new Set(this.completedEpisodes());
    ids.add(episodeId);
    this.completedEpisodes.set(ids);
    localStorage.setItem(STORAGE_KEY_COMPLETED, JSON.stringify([...ids]));
    // Clear saved progress once completed
    const all = this.loadAllProgress();
    delete all[episodeId];
    localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(all));
  }

  isCompleted(episodeId: string): boolean {
    return this.completedEpisodes().has(episodeId);
  }

  private loadSubscriptions(): Podcast[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_PODCASTS) ?? '[]');
    } catch {
      return [];
    }
  }

  private loadAllProgress(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_PROGRESS) ?? '{}');
    } catch {
      return {};
    }
  }

  private loadCompleted(): Set<string> {
    try {
      const ids: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY_COMPLETED) ?? '[]');
      return new Set(ids);
    } catch {
      return new Set();
    }
  }
}
