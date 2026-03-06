import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';
import { PlayerService } from '../../services/player.service';
import { DurationPipe } from '../../pipes/duration.pipe';

@Component({
  selector: 'app-now-playing',
  standalone: true,
  imports: [CommonModule, DurationPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './now-playing.component.html',
  styleUrl: './now-playing.component.scss',
})
export class NowPlayingComponent {
  player = inject(PlayerService);
  private location = inject(Location);

  goBack(): void {
    this.location.back();
  }

  get progressPct(): number {
    const d = this.player.duration();
    if (!d) return 0;
    return (this.player.currentTime() / d) * 100;
  }

  onProgressClick(event: MouseEvent): void {
    const bar = event.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const pct = (event.clientX - rect.left) / rect.width;
    this.player.seek(pct * this.player.duration());
  }

  cycleRate(): void {
    const rates = [1, 1.25, 1.5, 1.75, 2];
    const current = this.player.playbackRate();
    const next = rates[(rates.indexOf(current) + 1) % rates.length];
    this.player.setPlaybackRate(next);
  }
}
