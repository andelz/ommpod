import { Component, inject, ChangeDetectionStrategy, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DownloadService } from '../../services/download.service';
import { PlayerService } from '../../services/player.service';
import { Episode } from '../../models/podcast.model';
import { DurationPipe } from '../../pipes/duration.pipe';

@Component({
  selector: 'app-downloads',
  standalone: true,
  imports: [CommonModule, DurationPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './downloads.component.html',
  styleUrl: './downloads.component.scss',
})
export class DownloadsComponent {
  download = inject(DownloadService);
  player = inject(PlayerService);

  nowPlaying = output<void>();

  play(ep: Episode): void {
    this.player.play(ep);
  }

  isActive(ep: Episode): boolean {
    return this.player.episode()?.id === ep.id;
  }

  isPlaying(ep: Episode): boolean {
    return this.isActive(ep) && this.player.isPlaying();
  }

  async remove(ep: Episode, event: Event): Promise<void> {
    event.stopPropagation();
    await this.download.deleteDownload(ep);
  }
}
