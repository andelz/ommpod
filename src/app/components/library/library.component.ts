import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LibraryService } from '../../services/library.service';
import { Podcast } from '../../models/podcast.model';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './library.component.html',
  styleUrl: './library.component.scss',
})
export class LibraryComponent {
  library = inject(LibraryService);
  private router = inject(Router);

  select(podcast: Podcast): void {
    this.router.navigate(['/library', podcast.id], { state: { podcast } });
  }

  unsubscribe(podcast: Podcast, event: Event): void {
    event.stopPropagation();
    this.library.unsubscribe(podcast.id);
  }
}
