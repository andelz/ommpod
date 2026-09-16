import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { Episode, PlayerState } from '../models/podcast.model';
import { DownloadService } from './download.service';
import { LibraryService } from './library.service';

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private audio = new Audio();
  private downloadService = inject(DownloadService);
  private libraryService = inject(LibraryService);
  private lastSavedTime = 0;

  episode = signal<Episode | null>(null);
  isPlaying = signal(false);
  currentTime = signal(0);
  duration = signal(0);
  playbackRate = signal(1);
  loading = signal(false);

  state = computed<PlayerState>(() => ({
    episode: this.episode(),
    isPlaying: this.isPlaying(),
    currentTime: this.currentTime(),
    duration: this.duration(),
    playbackRate: this.playbackRate(),
    loading: this.loading(),
  }));

  /** Selectable playback speeds, in the order the rate control shows them. */
  static readonly RATES: readonly number[] = [1, 1.25, 1.5, 1.75, 2];

  /** How far through the episode we are, 0-100. Both the mini bar and the
   *  full player render a progress track from this. */
  progressPct = computed(() => {
    const total = this.duration();
    return total ? (this.currentTime() / total) * 100 : 0;
  });

  constructor() {
    this.audio.addEventListener('timeupdate', () => {
      const t = this.audio.currentTime;
      this.currentTime.set(t);
      // Save progress every 5 seconds
      if (t - this.lastSavedTime >= 5) {
        this.lastSavedTime = t;
        const ep = this.episode();
        if (ep) {
          this.libraryService.saveProgress(ep.id, t);
        }
      }
    });
    this.audio.addEventListener('durationchange', () => {
      this.duration.set(this.audio.duration || 0);
    });
    this.audio.addEventListener('ended', () => {
      this.isPlaying.set(false);
      const ep = this.episode();
      if (ep) {
        this.libraryService.markCompleted(ep.id);
      }
    });
    this.audio.addEventListener('playing', () => {
      this.isPlaying.set(true);
      this.loading.set(false);
    });
    this.audio.addEventListener('waiting', () => {
      this.loading.set(true);
    });
    this.audio.addEventListener('canplay', () => {
      this.loading.set(false);
    });
    this.audio.addEventListener('error', () => {
      this.loading.set(false);
      this.isPlaying.set(false);
    });

    // Register media session
    this.setupMediaSession();

    effect(() => {
      const ep = this.episode();
      if (ep) {
        this.updateMediaSessionMetadata(ep);
      }
    });
  }

  async play(episode: Episode): Promise<void> {
    const current = this.episode();
    if (current?.id === episode.id) {
      await this.togglePlay();
      return;
    }

    this.episode.set(episode);
    this.loading.set(true);
    this.lastSavedTime = 0;

    const src = await this.downloadService.getPlaybackUrl(episode);
    this.audio.src = src;
    this.audio.playbackRate = this.playbackRate();
    this.audio.load();

    const savedTime = await this.libraryService.getProgress(episode.id);
    if (savedTime > 0) {
      this.audio.currentTime = savedTime;
    }

    await this.audio.play();
  }

  async loadEpisode(episode: Episode): Promise<void> {
    const current = this.episode();
    if (current?.id === episode.id) return;

    this.episode.set(episode);
    this.loading.set(true);
    this.lastSavedTime = 0;

    const src = await this.downloadService.getPlaybackUrl(episode);
    this.audio.src = src;
    this.audio.playbackRate = this.playbackRate();
    this.audio.load();

    const savedTime = await this.libraryService.getProgress(episode.id);
    if (savedTime > 0) {
      this.audio.currentTime = savedTime;
    }

    this.loading.set(false);
  }

  async togglePlay(): Promise<void> {
    if (this.isPlaying()) {
      this.audio.pause();
      this.isPlaying.set(false);
    } else {
      await this.audio.play();
    }
  }

  seek(seconds: number): void {
    this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration || 0));
  }

  seekRelative(delta: number): void {
    this.seek(this.audio.currentTime + delta);
  }

  stop(): void {
    this.audio.pause();
    this.audio.src = '';
    this.episode.set(null);
    this.isPlaying.set(false);
    this.currentTime.set(0);
    this.duration.set(0);
    this.loading.set(false);
    this.lastSavedTime = 0;
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate.set(rate);
    this.audio.playbackRate = rate;
  }

  /** Step to the next speed, wrapping. Used by the mini bar, which has no
   *  room for a segmented control. */
  cycleRate(): void {
    const rates = PlayerService.RATES;
    const next = rates[(rates.indexOf(this.playbackRate()) + 1) % rates.length];
    this.setPlaybackRate(next);
  }

  /** Seek to a fraction (0-1) of the episode — what a click on a progress
   *  track resolves to. */
  seekToRatio(ratio: number): void {
    this.seek(Math.max(0, Math.min(1, ratio)) * this.duration());
  }

  private setupMediaSession(): void {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => this.togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => this.togglePlay());
    navigator.mediaSession.setActionHandler('seekbackward', () => this.seekRelative(-15));
    navigator.mediaSession.setActionHandler('seekforward', () => this.seekRelative(30));
  }

  private updateMediaSessionMetadata(episode: Episode): void {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: episode.title,
      artist: episode.podcastTitle,
    });
  }
}
