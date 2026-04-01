import { Component, ChangeDetectionStrategy, input, output, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { DownloadIcon, LucideAngularModule, PlayIcon, Trash2Icon } from 'lucide-angular';
import { Episode } from '../../models/podcast.model';
import { PlayerService } from '../../services/player.service';
import { LibraryService } from '../../services/library.service';
import { DownloadService } from '../../services/download.service';
import { DurationPipe } from '../../pipes/duration.pipe';

@Component({
  selector: 'app-episode-row',
  standalone: true,
  imports: [CommonModule, TranslateModule, DurationPipe, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './episode-row.component.html',
  styleUrl: './episode-row.component.scss',
})
export class EpisodeRowComponent {
  private player = inject(PlayerService);
  private library = inject(LibraryService);
  private download = inject(DownloadService);

  episode = input.required<Episode>();
  progressRatio = input<number>(0);
  showPodcastTitle = input(false);
  downloaded = input(false);
  downloadProgress = input<number | undefined>(undefined);

  selected = output<Episode>();
  podcastClicked = output<Episode>();
  playClicked = output<Episode>();
  downloadClicked = output<Episode>();
  removeDownloadClicked = output<Episode>();

  icons = {
    play: PlayIcon,
    download: DownloadIcon,
    remove: Trash2Icon,
  };

  active = computed(() => this.player.episode()?.id === this.episode().id);
  playing = computed(() => this.active() && this.player.isPlaying());
  completed = computed(() => this.library.isCompleted(this.episode().id));

  select(): void {
    this.selected.emit(this.episode());
  }

  onPlay(event: Event): void {
    event.stopPropagation();
    this.playClicked.emit(this.episode());
  }

  onDownload(event: Event): void {
    event.stopPropagation();
    this.downloadClicked.emit(this.episode());
  }

  onRemoveDownload(event: Event): void {
    event.stopPropagation();
    this.removeDownloadClicked.emit(this.episode());
  }

  onPodcastClick(event: Event): void {
    event.stopPropagation();
    this.podcastClicked.emit(this.episode());
  }
}
