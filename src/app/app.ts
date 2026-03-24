import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FolderDownIcon, HouseIcon, LucideAngularModule, SearchIcon, SettingsIcon, SquareLibraryIcon } from 'lucide-angular';
import { filter, map, startWith } from 'rxjs';
import { PlayerBarComponent } from './components/player-bar/player-bar.component';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, 
    LucideAngularModule, TranslateModule,
    RouterLink, RouterLinkActive, PlayerBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private router = inject(Router);  

  icons = {
    // home: HouseIcon,
    lib: SquareLibraryIcon,
    download: FolderDownIcon,
    search: SearchIcon,
    settings: SettingsIcon,
  }
  updateAvailable = signal(false);

  isNowPlaying = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects === '/now-playing'),
      startWith(this.router.url === '/now-playing'),
    ),
    { initialValue: false },
  );

    constructor() {
    const savedLang = localStorage.getItem('lang');
    if (savedLang) {
      inject(TranslateService).use(savedLang);
    }

    const swUpdate = inject(SwUpdate, { optional: true });
    if (swUpdate?.isEnabled) {
      swUpdate.versionUpdates.subscribe((event) => {
        if (event.type === 'VERSION_READY') {
          this.updateAvailable.set(true);
        }
      });
    }
  }

  reload() {
    window.location.reload();
  }
}
