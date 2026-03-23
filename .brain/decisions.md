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

<!-- Add new decisions below -->
