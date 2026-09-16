import { CommonModule, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonToggle, ButtonToggleOption } from 'omm-ui';
import { DurationPipe } from '../../pipes/duration.pipe';
import { PlayerService } from '../../services/player.service';

@Component({
  selector: 'app-now-playing',
  standalone: true,
  imports: [CommonModule, DurationPipe, TranslateModule, ButtonToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './now-playing.component.html',
  styleUrl: './now-playing.component.scss',
})
export class NowPlayingComponent {
  player = inject(PlayerService);
  private location = inject(Location);

  /** The full player has room to show every speed at once, so it uses a
   *  segmented control rather than the mini bar's cycling button. */
  rateOptions: ButtonToggleOption<number>[] = PlayerService.RATES.map((rate) => ({
    value: rate,
    label: `${rate}x`,
  }));

  progressPct = computed(() => this.player.progressPct());

  goBack(): void {
    this.location.back();
  }

  onProgressClick(event: MouseEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.player.seekToRatio((event.clientX - rect.left) / rect.width);
  }
}
