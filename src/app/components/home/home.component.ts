import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DiscoveryService } from '../../services/discovery.service';
import { LibraryService } from '../../services/library.service';
import { Podcast } from '../../models/podcast.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private discovery = inject(DiscoveryService);
  private library = inject(LibraryService);
  private router = inject(Router);

  recommendations = this.discovery.recommendations;
  loading = this.discovery.loading;
  error = this.discovery.error;
  hasSubscriptions = computed(() => this.library.subscriptions().length > 0);

  constructor() {
    this.discovery.loadRecommendations();
  }

  select(podcast: Podcast): void {
    this.router.navigate(['/search', podcast.id], { state: { podcast } });
  }

  subscribe(podcast: Podcast, event: Event): void {
    event.stopPropagation();
    this.library.subscribe(podcast);
  }

  goToSearch(): void {
    this.router.navigate(['/search']);
  }
}
