import {
  Component, inject, signal, input, output, OnChanges, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Podcast, Episode } from '../../models/podcast.model';
import { PodcastSearchService } from '../../services/podcast-search.service';
import { PlayerService } from '../../services/player.service';
import { DownloadService } from '../../services/download.service';
import { LibraryService } from '../../services/library.service';
import { DurationPipe } from '../../pipes/duration.pipe';

@Component({
  selector: 'app-episode-list',
  standalone: true,
  imports: [CommonModule, DurationPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './episode-list.component.html',
  styleUrl: './episode-list.component.scss',
})
export class EpisodeListComponent implements OnChanges {
  private searchSvc = inject(PodcastSearchService);
  player = inject(PlayerService);
  download = inject(DownloadService);
  library = inject(LibraryService);

  podcast = input.required<Podcast>();
  back = output<void>();

  episodes = signal<Episode[]>([]);
  loading = signal(false);
  error = signal('');
  downloadedUrls = signal<Set<string>>(new Set());

  async ngOnChanges(): Promise<void> {
    await this.loadEpisodes();
  }

  async loadEpisodes(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const eps = await this.searchSvc.fetchEpisodes(this.podcast());
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
    if (this.library.isSubscribed(p.id)) {
      this.library.unsubscribe(p.id);
    } else {
      this.library.subscribe(p);
    }
  }
}
