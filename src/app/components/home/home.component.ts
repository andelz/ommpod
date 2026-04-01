import { Component, ChangeDetectionStrategy, inject, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeedService, FeedEntry } from '../../services/feed.service';
import { LibraryService } from '../../services/library.service';
import { PlayerService } from '../../services/player.service';
import { PersistenceService } from '../../services/persistence.service';
import { DownloadService } from '../../services/download.service';
import { Episode } from '../../models/podcast.model';
import { EpisodeRowComponent } from '../episode-row/episode-row.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [TranslateModule, EpisodeRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private feed = inject(FeedService);
  private library = inject(LibraryService);
  private persistence = inject(PersistenceService);
  private download = inject(DownloadService);
  private router = inject(Router);
  private player = inject(PlayerService);

  entries = this.feed.entries;
  loading = this.feed.loading;
  refreshing = this.feed.refreshing;
  error = this.feed.error;
  hasSubscriptions = computed(() => this.library.subscriptions().length > 0);

  downloadedUrls = signal<Set<string>>(new Set());
  private progressCache: Record<string, number> = {};

  constructor() {
    this.feed.loadFeed();
    this.loadData();
  }

  private async loadData(): Promise<void> {
    const [progress, urls] = await Promise.all([
      this.persistence.getAllProgress(),
      this.download.listDownloadedUrls(),
    ]);
    this.progressCache = progress;
    this.downloadedUrls.set(new Set(urls));
  }

  select(ep: Episode): void {
    this.player.loadEpisode(ep);
    this.router.navigate(['/now-playing']);
  }

  play(ep: Episode): void {
    this.player.play(ep);
  }

  openPodcast(ep: Episode): void {
    const podcast = this.library.subscriptions().find(p => p.id === ep.podcastId);
    if (podcast) {
      this.router.navigate(['/library', podcast.id], { state: { podcast } });
    }
  }

  isDownloaded(ep: Episode): boolean {
    return this.downloadedUrls().has(ep.audioUrl);
  }

  downloadProgress(ep: Episode): number | undefined {
    return this.download.progress()[ep.id];
  }

  async downloadEpisode(ep: Episode): Promise<void> {
    try {
      await this.download.download(ep);
      const urls = this.downloadedUrls();
      urls.add(ep.audioUrl);
      this.downloadedUrls.set(new Set(urls));
    } catch {
      // download.service handles cleanup
    }
  }

  async removeDownload(ep: Episode): Promise<void> {
    await this.download.deleteDownload(ep);
    const urls = this.downloadedUrls();
    urls.delete(ep.audioUrl);
    this.downloadedUrls.set(new Set(urls));
  }

  listenProgressRatio(ep: Episode): number {
    if (!ep.duration) return 0;
    if (this.player.episode()?.id === ep.id) {
      return Math.min(this.player.currentTime() / ep.duration, 1);
    }
    const saved = this.progressCache[ep.id] ?? 0;
    return saved > 0 ? Math.min(saved / ep.duration, 1) : 0;
  }

  goToSearch(): void {
    this.router.navigate(['/search']);
  }
}
