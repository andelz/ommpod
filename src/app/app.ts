import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FolderDownIcon, Grid2x2Icon, Grid2x2XIcon, HouseIcon, LucideAngularModule, SearchIcon, SettingsIcon, SquareLibraryIcon } from 'lucide-angular';
import { EnvironmentService, ThemeService } from 'omm-ui';
import { filter, map, startWith } from 'rxjs';
import { PlayerBarComponent } from './components/player-bar/player-bar.component';
import { UpdateService } from './services/update.service';
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
    home: Grid2x2Icon,
    lib: SquareLibraryIcon,
    download: FolderDownIcon,
    search: SearchIcon,
    settings: SettingsIcon,
  }
  updateService = inject(UpdateService);

  isNowPlaying = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects === '/now-playing'),
      startWith(this.router.url === '/now-playing'),
    ),
    { initialValue: false },
  );

  constructor() {
    // Both are opt-in: their signals never update until init() is called.
    // ThemeService takes over the data-theme attribute on <html> (and keeps
    // the theme-color meta in sync), so index.html no longer pins it.
    inject(ThemeService).init();
    inject(EnvironmentService).init();

    const savedLang = localStorage.getItem('lang');
    if (savedLang) {
      inject(TranslateService).use(savedLang);
    }
  }
}
