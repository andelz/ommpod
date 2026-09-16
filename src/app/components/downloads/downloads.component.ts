import { Component, inject, ChangeDetectionStrategy, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmService } from 'omm-ui';
import { DownloadService } from '../../services/download.service';
import { PlayerService } from '../../services/player.service';
import { Episode } from '../../models/podcast.model';
import { DurationPipe } from '../../pipes/duration.pipe';

@Component({
  selector: 'app-downloads',
  standalone: true,
  imports: [CommonModule, DurationPipe, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './downloads.component.html',
  styleUrl: './downloads.component.scss',
})
export class DownloadsComponent {
  download = inject(DownloadService);
  player = inject(PlayerService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);

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
    const message = this.translate.instant('downloads.remove.confirm', { title: ep.title });
    if (await this.confirm.confirm(message)) {
      await this.download.deleteDownload(ep);
    }
  }
}
