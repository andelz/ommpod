import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { Episode, PlayerState } from '../models/podcast.model';
import { DownloadService } from './download.service';

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private audio = new Audio();
  private downloadService = inject(DownloadService);

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

  constructor() {
    this.audio.addEventListener('timeupdate', () => {
      this.currentTime.set(this.audio.currentTime);
    });
    this.audio.addEventListener('durationchange', () => {
      this.duration.set(this.audio.duration || 0);
    });
    this.audio.addEventListener('ended', () => {
      this.isPlaying.set(false);
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

    const src = await this.downloadService.getPlaybackUrl(episode);
    this.audio.src = src;
    this.audio.playbackRate = this.playbackRate();
    this.audio.load();
    await this.audio.play();
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

  setPlaybackRate(rate: number): void {
    this.playbackRate.set(rate);
    this.audio.playbackRate = rate;
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
