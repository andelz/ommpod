import {
  Component, inject, signal, ChangeDetectionStrategy
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PodcastSearchService } from '../../services/podcast-search.service';
import { LibraryService } from '../../services/library.service';
import { Podcast } from '../../models/podcast.model';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent {
  private searchSvc = inject(PodcastSearchService);
  private router = inject(Router);
  library = inject(LibraryService);

  query = signal('');
  results = signal<Podcast[]>([]);
  loading = signal(false);
  error = signal('');

  async search(): Promise<void> {
    const q = this.query().trim();
    if (!q) return;
    this.loading.set(true);
    this.error.set('');
    this.results.set([]);
    try {
      const res = await this.searchSvc.search(q).toPromise();
      this.results.set(res ?? []);
    } catch {
      this.error.set('search failed');
    } finally {
      this.loading.set(false);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.search();
  }

  select(podcast: Podcast): void {
    this.router.navigate(['/search', podcast.id], { state: { podcast } });
  }

  toggleSubscribe(podcast: Podcast, event: Event): void {
    event.stopPropagation();
    if (this.library.isSubscribed(podcast.id)) {
      this.library.unsubscribe(podcast.id);
    } else {
      this.library.subscribe(podcast);
    }
  }
}
