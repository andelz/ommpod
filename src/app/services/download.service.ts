import { Injectable, signal, inject } from '@angular/core';
import { Episode } from '../models/podcast.model';
import { PersistenceService } from './persistence.service';
import { StorageService } from './storage.service';

const SW_PATH = '/audio-sw.js';
const RECONCILE_TIMEOUT_MS = 5000;

@Injectable({ providedIn: 'root' })
export class DownloadService {
  private persistence = inject(PersistenceService);
  private storage = inject(StorageService);

  progress = signal<Record<string, number>>({});
  downloadedEpisodes = signal<Episode[]>([]);

  private swReady: Promise<ServiceWorker | null>;

  constructor() {
    this.swReady = this.registerSW();
    this.init();
  }

  private async init(): Promise<void> {
    const episodes = await this.persistence.getDownloadedEpisodes();
    this.downloadedEpisodes.set(episodes);
    await this.reconcile(episodes);
  }

  /**
   * Episode bytes live in the service worker's cache while the metadata rows
   * live in IndexedDB, and nothing keeps the two in step. An evicted cache
   * leaves rows pointing at audio that is gone, so the UI offers an offline
   * play that fails. Drop those orphans at startup.
   *
   * Only the SW can answer what is actually cached, and only a real answer is
   * safe to act on: with no SW `listDownloadedUrls()` returns an empty list,
   * which is indistinguishable from "every download was evicted".
   */
  private async reconcile(episodes: Episode[]): Promise<void> {
    if (episodes.length === 0) return;
    if (!(await this.getSW())) return;

    const urls = await this.withTimeout(this.listDownloadedUrls(), RECONCILE_TIMEOUT_MS);
    if (!urls) return;

    const cached = new Set(urls);
    const orphans = episodes.filter(e => !cached.has(e.audioUrl));
    if (orphans.length === 0) return;

    this.downloadedEpisodes.set(episodes.filter(e => cached.has(e.audioUrl)));
    await Promise.all(orphans.map(e => this.persistence.deleteDownloadMeta(e.id)));
  }

  /** Resolves `null` rather than hanging when the SW never answers. */
  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
    return Promise.race([p, new Promise<null>(resolve => setTimeout(() => resolve(null), ms))]);
  }

  private async registerSW(): Promise<ServiceWorker | null> {
    if (!('serviceWorker' in navigator)) return null;
    try {
      const reg = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
      await navigator.serviceWorker.ready;
      return reg.active ?? reg.installing ?? reg.waiting;
    } catch {
      return null;
    }
  }

  private async getSW(): Promise<ServiceWorker | null> {
    const sw = await this.swReady;
    if (sw) return sw;
    const reg = await navigator.serviceWorker.getRegistration('/');
    return reg?.active ?? null;
  }

  async isDownloaded(episode: Episode): Promise<boolean> {
    const urls = await this.listDownloadedUrls();
    return urls.includes(episode.audioUrl);
  }

  async getPlaybackUrl(episode: Episode): Promise<string> {
    return episode.audioUrl;
  }

  async download(episode: Episode): Promise<void> {
    // Downloads are the heaviest thing this app stores, so make sure the origin
    // is durable before filling it up.
    void this.storage.claimPersistence();
    const sw = await this.getSW();
    if (sw) {
      await this.downloadViaSW(sw, episode);
    } else {
      this.triggerNativeDownload(episode);
      this.setProgress(episode.id, 100);
      await this.addMeta(episode);
      setTimeout(() => this.clearProgress(episode.id), 2000);
    }
  }

  private downloadViaSW(sw: ServiceWorker, episode: Episode): Promise<void> {
    this.setProgress(episode.id, 0);
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();

      channel.port1.onmessage = (event) => {
        const msg = event.data;
        if (msg.type === 'progress') {
          this.setProgress(episode.id, msg.pct);
        } else if (msg.type === 'done') {
          this.setProgress(episode.id, 100);
          this.addMeta(episode);
          setTimeout(() => this.clearProgress(episode.id), 2000);
          resolve();
        } else if (msg.type === 'error') {
          this.clearProgress(episode.id);
          reject(new Error(msg.message));
        }
      };

      sw.postMessage(
        { type: 'DOWNLOAD', id: episode.id, url: episode.audioUrl, title: episode.title },
        [channel.port2]
      );
    });
  }

  private triggerNativeDownload(episode: Episode): void {
    const a = document.createElement('a');
    a.href = episode.audioUrl;
    a.download = `${episode.title}.mp3`;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async deleteDownload(episode: Episode): Promise<void> {
    const sw = await this.getSW();
    if (sw) {
      await new Promise<void>((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve();
        sw.postMessage({ type: 'DELETE', url: episode.audioUrl }, [channel.port2]);
      });
    }
    await this.removeMeta(episode.id);
  }

  async listDownloadedUrls(): Promise<string[]> {
    const sw = await this.getSW();
    if (!sw) return [];
    return new Promise<string[]>((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => resolve(event.data.urls ?? []);
      sw.postMessage({ type: 'LIST_CACHED' }, [channel.port2]);
    });
  }

  private setProgress(id: string, value: number): void {
    this.progress.update(p => ({ ...p, [id]: value }));
  }

  private clearProgress(id: string): void {
    this.progress.update(p => {
      const next = { ...p };
      delete next[id];
      return next;
    });
  }

  private async addMeta(episode: Episode): Promise<void> {
    const list = this.downloadedEpisodes();
    if (list.some(e => e.id === episode.id)) return;
    this.downloadedEpisodes.set([episode, ...list]);
    await this.persistence.putDownloadMeta(episode);
  }

  private async removeMeta(episodeId: string): Promise<void> {
    this.downloadedEpisodes.set(this.downloadedEpisodes().filter(e => e.id !== episodeId));
    await this.persistence.deleteDownloadMeta(episodeId);
  }
}
