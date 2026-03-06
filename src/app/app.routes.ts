import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'library', pathMatch: 'full' },
  {
    path: 'library',
    loadComponent: () =>
      import('./components/library/library.component').then(m => m.LibraryComponent),
  },
  {
    path: 'library/:podcastId',
    loadComponent: () =>
      import('./components/episode-list/episode-list.component').then(
        m => m.EpisodeListComponent,
      ),
  },
  {
    path: 'search',
    loadComponent: () =>
      import('./components/search/search.component').then(m => m.SearchComponent),
  },
  {
    path: 'search/:podcastId',
    loadComponent: () =>
      import('./components/episode-list/episode-list.component').then(
        m => m.EpisodeListComponent,
      ),
  },
  {
    path: 'downloads',
    loadComponent: () =>
      import('./components/downloads/downloads.component').then(m => m.DownloadsComponent),
  },
  {
    path: 'now-playing',
    loadComponent: () =>
      import('./components/now-playing/now-playing.component').then(m => m.NowPlayingComponent),
  },
  { path: '**', redirectTo: 'library' },
];
