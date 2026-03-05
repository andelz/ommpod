import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { Podcast } from './models/podcast.model';
import { SearchComponent } from './components/search/search.component';
import { EpisodeListComponent } from './components/episode-list/episode-list.component';
import { LibraryComponent } from './components/library/library.component';
import { DownloadsComponent } from './components/downloads/downloads.component';
import { NowPlayingComponent } from './components/now-playing/now-playing.component';
import { PlayerBarComponent } from './components/player-bar/player-bar.component';

type View = 'search' | 'library' | 'downloads';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    SearchComponent,
    EpisodeListComponent,
    LibraryComponent,
    DownloadsComponent,
    NowPlayingComponent,
    PlayerBarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  activeView = signal<View>('library');
  selectedPodcast = signal<Podcast | null>(null);
  nowPlayingOpen = signal(false);

  setView(view: View): void {
    this.activeView.set(view);
    this.selectedPodcast.set(null);
    this.nowPlayingOpen.set(false);
  }

  openPodcast(podcast: Podcast): void {
    this.selectedPodcast.set(podcast);
    this.nowPlayingOpen.set(false);
  }

  closePodcast(): void {
    this.selectedPodcast.set(null);
  }

  openNowPlaying(): void {
    this.nowPlayingOpen.set(true);
  }

  closeNowPlaying(): void {
    this.nowPlayingOpen.set(false);
  }
}
