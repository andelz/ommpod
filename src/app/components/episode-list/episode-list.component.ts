import {
  Component, inject, signal, OnInit, ChangeDetectionStrategy
} from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Podcast, Episode } from '../../models/podcast.model';
import { PodcastSearchService } from '../../services/podcast-search.service';
import { PlayerService } from '../../services/player.service';
import { DownloadService } from '../../services/download.service';
import { LibraryService } from '../../services/library.service';
import { PersistenceService } from '../../services/persistence.service';
import { EpisodeRowComponent } from '../episode-row/episode-row.component';

@Component({
  selector: 'app-episode-list',
  standalone: true,
  imports: [TranslateModule, EpisodeRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './episode-list.component.html',
  styleUrl: './episode-list.component.scss',
})
export class EpisodeListComponent implements OnInit {
  private searchSvc = inject(PodcastSearchService);
  private location = inject(Location);
  private router = inject(Router);
  private player = inject(PlayerService);
  private download = inject(DownloadService);
  private persistence = inject(PersistenceService);
  library = inject(LibraryService);

  podcast = signal<Podcast | null>((this.router.getCurrentNavigation()?.extras.state ?? history.state)?.podcast ?? null);

  episodes = signal<Episode[]>([]);
  loading = signal(false);
  error = signal('');
  downloadedUrls = signal<Set<string>>(new Set());
  private progressCache = signal<Record<string, number>>({});

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
      const [urls, progress] = await Promise.all([
        this.download.listDownloadedUrls(),
        this.persistence.getAllProgress(),
      ]);
      this.downloadedUrls.set(new Set(urls));
      this.progressCache.set(progress);
    } catch {
      this.error.set('failed to load episodes');
    } finally {
      this.loading.set(false);
    }
  }

  playEpisode(ep: Episode): void {
    this.player.play(ep);
  }

  selectEpisode(ep: Episode): void {
    this.player.loadEpisode(ep);
    this.router.navigate(['/now-playing']);
  }

  isDownloaded(ep: Episode): boolean {
    return this.downloadedUrls().has(ep.audioUrl);
  }

  listenProgressRatio(ep: Episode): number {
    if (!ep.duration) return 0;
    if (this.player.episode()?.id === ep.id) {
      return Math.min(this.player.currentTime() / ep.duration, 1);
    }
    const saved = this.progressCache()[ep.id] ?? 0;
    return saved > 0 ? Math.min(saved / ep.duration, 1) : 0;
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
