# Architecture — pod

## Overview
A standalone Angular 20 podcast player PWA that searches iTunes for podcasts, manages subscriptions via localStorage, streams/downloads episodes with a service-worker cache, and provides a media player with playback progress tracking.

**Root:** `./`
**Build:** `ng build`
**Test:** `ng test`
**Dev server:** `ng serve --port 4711`

---

## Key exports

| Export | Description |
|--------|-------------|
| `App` | Root component — bottom-tab navigation (library, search, downloads) + player bar |
| `LibraryComponent` | Shows subscribed podcasts |
| `EpisodeListComponent` | Episodes for a selected podcast (shared by library & search routes) |
| `SearchComponent` | iTunes podcast search |
| `DownloadsComponent` | Lists downloaded episodes |
| `NowPlayingComponent` | Full-screen player view |
| `PlayerBarComponent` | Mini player bar always visible at bottom |
| `PlayerService` | Central audio playback, media session integration, progress save every 5s |
| `PodcastSearchService` | iTunes search API + RSS feed parsing with CORS proxy fallback chain |
| `LibraryService` | Subscriptions & playback progress in localStorage |
| `DownloadService` | Service-worker-based episode caching with progress signals |
| `DurationPipe` | Formats seconds to HH:MM:SS |
| `Podcast` / `Episode` / `PlayerState` | Core data models |

---

## Key patterns

- **Zoneless** — uses `provideZonelessChangeDetection()`, all state via Angular signals
- **Standalone components** — no NgModules; every component is `standalone: true`
- **Lazy routes** — all page components loaded via `loadComponent()`
- **localStorage persistence** — subscriptions, playback progress, completed episodes, download metadata
- **Service worker for downloads** — `audio-sw.js` registered by `DownloadService`; communicates via `MessageChannel` for download progress
- **CORS proxy chain** — RSS fetching tries direct → corsproxy.io → allorigins as fallback
- **Lucide icons** — icon library via `lucide-angular`
- **OnPush / signal-driven** — `ChangeDetectionStrategy.OnPush` on root; signals drive all reactive state

---

## i18n / assets
- Static assets in `public/` (icons, manifest images)
- No i18n setup currently
