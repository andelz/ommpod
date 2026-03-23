import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, filter, startWith } from 'rxjs';
import { PlayerBarComponent } from './components/player-bar/player-bar.component';
import { LucideAngularModule, FileIcon, SquareLibraryIcon, FolderDownIcon, SearchIcon, HouseIcon } from 'lucide-angular';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, 
    LucideAngularModule,
    RouterLink, RouterLinkActive, PlayerBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private router = inject(Router);  

  icons = {
    home: HouseIcon,
    lib: SquareLibraryIcon,
    download: FolderDownIcon,
    search: SearchIcon,
  }

  isNowPlaying = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects === '/now-playing'),
      startWith(this.router.url === '/now-playing'),
    ),
    { initialValue: false },
  );
}
