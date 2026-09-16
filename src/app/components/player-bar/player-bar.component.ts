import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PlayerService } from '../../services/player.service';
import { DurationPipe } from '../../pipes/duration.pipe';

@Component({
  selector: 'app-player-bar',
  standalone: true,
  imports: [CommonModule, DurationPipe, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './player-bar.component.html',
  styleUrl: './player-bar.component.scss',
})
export class PlayerBarComponent {
  player = inject(PlayerService);
  private router = inject(Router);

  openNowPlaying(): void {
    this.router.navigate(['/now-playing']);
  }

  progressPct = computed(() => this.player.progressPct());

  onProgressClick(event: MouseEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.player.seekToRatio((event.clientX - rect.left) / rect.width);
  }

  skip(delta: number): void {
    this.player.seekRelative(delta);
  }
}
