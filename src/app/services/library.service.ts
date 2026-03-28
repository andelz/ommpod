import { Injectable, signal, inject } from '@angular/core';
import { Podcast } from '../models/podcast.model';
import { PersistenceService } from './persistence.service';

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private persistence = inject(PersistenceService);

  subscriptions = signal<Podcast[]>([]);
  completedEpisodes = signal<Set<string>>(new Set());
  ready = signal(false);
  lastChange = signal(0);

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
    this.lastChange.update(v => v + 1);
  }

  async unsubscribe(podcastId: string): Promise<void> {
    this.subscriptions.set(this.subscriptions().filter(p => p.id !== podcastId));
    await this.persistence.deleteSubscription(podcastId);
    this.lastChange.update(v => v + 1);
  }

  isSubscribed(podcastId: string): boolean {
    return this.subscriptions().some(p => p.id === podcastId);
  }

  async saveProgress(episodeId: string, time: number): Promise<void> {
    await this.persistence.putProgress(episodeId, time);
    this.lastChange.update(v => v + 1);
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
    this.lastChange.update(v => v + 1);
  }

  isCompleted(episodeId: string): boolean {
    return this.completedEpisodes().has(episodeId);
  }
}
