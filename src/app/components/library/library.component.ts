import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmService } from 'omm-ui';
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
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);

  select(podcast: Podcast): void {
    this.router.navigate(['/library', podcast.id], { state: { podcast } });
  }

  async unsubscribe(podcast: Podcast, event: Event): Promise<void> {
    event.stopPropagation();
    const message = this.translate.instant('library.unsubscribe.confirm', {
      title: podcast.title,
    });
    if (await this.confirm.confirm(message)) {
      this.library.unsubscribe(podcast.id);
    }
  }
}
