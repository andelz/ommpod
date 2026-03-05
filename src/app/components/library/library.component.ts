import { Component, inject, ChangeDetectionStrategy, output } from '@angular/core';
import { LibraryService } from '../../services/library.service';
import { Podcast } from '../../models/podcast.model';

@Component({
  selector: 'app-library',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './library.component.html',
  styleUrl: './library.component.scss',
})
export class LibraryComponent {
  library = inject(LibraryService);
  podcastSelected = output<Podcast>();

  select(podcast: Podcast): void {
    this.podcastSelected.emit(podcast);
  }

  unsubscribe(podcast: Podcast, event: Event): void {
    event.stopPropagation();
    this.library.unsubscribe(podcast.id);
  }
}
