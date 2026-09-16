import { Injectable, signal, inject } from '@angular/core';
import { Podcast } from '../models/podcast.model';
import { PersistenceService } from './persistence.service';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private persistence = inject(PersistenceService);
  private storage = inject(StorageService);

  subscriptions = signal<Podcast[]>([]);
  completedEpisodes = signal<Set<string>>(new Set());
  ready = signal(false);

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    const [subs, completedIds] = await Promise.all([
      this.persistence.getSubscriptions(),
      this.persistence.getCompletedIds(),
    ]);
    this.subscriptions.set(subs);
    this.completedEpisodes.set(new Set(completedIds));
    this.ready.set(true);
  }

  async subscribe(podcast: Podcast): Promise<void> {
    const current = this.subscriptions();
    if (current.some(p => p.id === podcast.id)) return;
    this.subscriptions.set([...current, podcast]);
    await this.persistence.putSubscription(podcast);
    // A first subscription is the earliest point the user has data worth keeping,
    // and so the best moment to ask the browser not to evict it.
    void this.storage.claimPersistence();
  }

  async unsubscribe(podcastId: string): Promise<void> {
    this.subscriptions.set(this.subscriptions().filter(p => p.id !== podcastId));
    await this.persistence.deleteSubscription(podcastId);
  }

  isSubscribed(podcastId: string): boolean {
    return this.subscriptions().some(p => p.id === podcastId);
  }

  async saveProgress(episodeId: string, time: number): Promise<void> {
    await this.persistence.putProgress(episodeId, time);
  }

  async getProgress(episodeId: string): Promise<number> {
    return this.persistence.getProgress(episodeId);
  }

  async markCompleted(episodeId: string): Promise<void> {
    const ids = new Set(this.completedEpisodes());
    ids.add(episodeId);
    this.completedEpisodes.set(ids);
    await this.persistence.putCompleted(episodeId);
    await this.persistence.deleteProgress(episodeId);
  }

  isCompleted(episodeId: string): boolean {
    return this.completedEpisodes().has(episodeId);
  }
}
