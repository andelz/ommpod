# Decisions — pod

Architectural decisions and rationale. Each entry: **date · decision · why**.

---

## ADR-001 · Zoneless Angular with signals
**Date:** pre-setup
**Decision:** Use `provideZonelessChangeDetection()` with Angular signals instead of zone.js
**Why:** Simpler mental model, better performance, aligns with Angular's future direction
**Consequence:** All state must be managed via signals; no zone-based automatic change detection

## ADR-002 · localStorage for all persistence
**Date:** pre-setup
**Decision:** Store subscriptions, progress, completed episodes, and download metadata in localStorage
**Why:** No backend needed — keeps the app fully client-side and offline-capable
**Consequence:** Data is per-browser, no sync across devices

## ADR-003 · Service worker for offline audio
**Date:** pre-setup
**Decision:** Use a custom service worker (`audio-sw.js`) to cache downloaded episodes
**Why:** Enables true offline playback without a backend; SW intercepts audio URLs transparently
**Consequence:** Download/playback logic depends on SW registration; fallback to native download when SW unavailable

## ADR-004 · CORS proxy fallback chain for RSS
**Date:** pre-setup
**Decision:** Try direct fetch → corsproxy.io → allorigins when loading RSS feeds
**Why:** Many podcast RSS feeds lack CORS headers; multiple proxies improve reliability
**Consequence:** Depends on third-party proxy services for feeds without CORS

## ADR-005 · Home screen as default route
**Date:** 2026-03-23
**Decision:** Replace `/library` with `/home` as the default landing page; home shows genre-based recommendations derived from subscriptions
**Why:** Provides a discovery surface that encourages exploration rather than dropping users straight into their existing library
**Consequence:** Users with no subscriptions see an empty home screen — needs an onboarding/empty-state to remain useful for new users

## ADR-006 · Layout design tokens with mobile media query
**Date:** 2026-03-23
**Decision:** Centralize layout dimensions (touch targets, artwork sizes, padding, progress bar heights) as CSS custom properties in `:root`, overridden at `max-width: 480px`
**Why:** Ensures consistent sizing across all components and makes mobile responsiveness a single-point-of-change
**Consequence:** All component SCSS must use tokens instead of hardcoded values

## ADR-007 · Remove Solid Pod integration
**Date:** 2026-04-22
**Decision:** Drop `SolidAuthService` / `SolidDataService` / `SolidSyncService`, the `@inrupt/*` packages, and the Solid Pod section of the Settings UI. The `LibraryService.lastChange` hook (only consumed by sync) is removed with them.
**Why:** The Solid-based remote sync didn't pan out; a different persistence / sync layer will be introduced later.
**Consequence:** The app is back to IndexedDB-only (via `PersistenceService`) — no cross-device sync until the replacement lands. Stale localStorage keys `pod-solid-issuer` and `pod-sync-queue` may linger in users' browsers; they're harmless and will be overwritten by whatever comes next.

<!-- Add new decisions below -->
