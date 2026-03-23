import {
  Component, inject, signal, OnInit, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Podcast, Episode } from '../../models/podcast.model';
import { PodcastSearchService } from '../../services/podcast-search.service';
import { PlayerService } from '../../services/player.service';
import { DownloadService } from '../../services/download.service';
import { LibraryService } from '../../services/library.service';
import { DurationPipe } from '../../pipes/duration.pipe';

@Component({
  selector: 'app-episode-list',
  standalone: true,
  imports: [CommonModule, DurationPipe, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './episode-list.component.html',
  styleUrl: './episode-list.component.scss',
})
export class EpisodeListComponent implements OnInit {
  private searchSvc = inject(PodcastSearchService);
  private location = inject(Location);
  private router = inject(Router);
  player = inject(PlayerService);
  download = inject(DownloadService);
  library = inject(LibraryService);

  podcast = signal<Podcast | null>((this.router.getCurrentNavigation()?.extras.state ?? history.state)?.podcast ?? null);

  episodes = signal<Episode[]>([]);
  loading = signal(false);
  error = signal('');
  downloadedUrls = signal<Set<string>>(new Set());

  async ngOnInit(): Promise<void> {
    if (!this.podcast()) {
      this.location.back();
      return;
    }
    await this.loadEpisodes();
  }

  goBack(): void {
    this.location.back();
  }

  async loadEpisodes(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const eps = await this.searchSvc.fetchEpisodes(this.podcast()!);
      this.episodes.set(eps);
      const urls = await this.download.listDownloadedUrls();
      this.downloadedUrls.set(new Set(urls));
    } catch {
      this.error.set('failed to load episodes');
    } finally {
      this.loading.set(false);
    }
  }

  playEpisode(ep: Episode): void {
    this.player.play(ep);
  }

  isPlaying(ep: Episode): boolean {
    return this.player.episode()?.id === ep.id && this.player.isPlaying();
  }

  isActive(ep: Episode): boolean {
    return this.player.episode()?.id === ep.id;
  }

  isDownloaded(ep: Episode): boolean {
    return this.downloadedUrls().has(ep.audioUrl);
  }

  isCompleted(ep: Episode): boolean {
    return this.library.isCompleted(ep.id);
  }

  listenProgressRatio(ep: Episode): number {
    if (!ep.duration) return 0;
    // If this episode is currently playing, use live currentTime
    if (this.player.episode()?.id === ep.id) {
      return Math.min(this.player.currentTime() / ep.duration, 1);
    }
    const saved = this.library.getProgress(ep.id);
    return saved > 0 ? Math.min(saved / ep.duration, 1) : 0;
  }

  downloadProgress(ep: Episode): number | undefined {
    return this.download.progress()[ep.id];
  }

  async toggleDownload(ep: Episode, event: Event): Promise<void> {
    event.stopPropagation();
    if (this.isDownloaded(ep)) {
      await this.download.deleteDownload(ep);
      const urls = this.downloadedUrls();
      urls.delete(ep.audioUrl);
      this.downloadedUrls.set(new Set(urls));
    } else {
      try {
        await this.download.download(ep);
        const urls = this.downloadedUrls();
        urls.add(ep.audioUrl);
        this.downloadedUrls.set(new Set(urls));
      } catch {
        // download.service already cleans up progress on error
      }
    }
  }

  toggleSubscribe(event: Event): void {
    event.stopPropagation();
    const p = this.podcast();
    if (!p) return;
    if (this.library.isSubscribed(p.id)) {
      this.library.unsubscribe(p.id);
    } else {
      this.library.subscribe(p);
    }
  }
}
