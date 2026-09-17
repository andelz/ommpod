# Execution Plan — pod

> This file is **updated** at the end of every session by `/wrap-up`.

## Status legend
- `[ ]` pending
- `[~]` in progress
- `[x]` done
- `[!]` blocked (reason noted inline)

---

## Epic: i18n / Translations

- [x] Install @ngx-translate/core and @ngx-translate/http-loader
- [x] Wire `provideTranslateService` + `provideTranslateHttpLoader` in `app.config.ts`
- [x] Create `public/i18n/en.json` and `de.json` with base component keys
- [x] Migrate all component templates to `| translate` pipe
- [~] Complete i18n files — missing home/update keys (`home.welcome.*`, `home.loading`, `home.subscribe`, `home.empty.*`, `home.update.*`)
- [ ] Add language switcher UI (nav or settings)
- [ ] Fix typo: `app.html` `class="home.update-banner"` → `class="update-banner"`

## Epic: Home Screen

- [x] Create `HomeComponent` (ts, scss)
- [x] Wire home route as default landing page
- [x] Add home nav icon to top bar
- [x] Design `home.component.html` template (subscription episode feed)
- [x] Internationalize home template
- [x] Remove `DiscoveryService` — home is the subscription feed only (ADR-008)
- [x] Welcome state for users with no subscriptions (points at search)
- [ ] Unit tests for HomeComponent

## Epic: PWA / Service Worker

- [x] Add SW update detection (`SwUpdate.versionUpdates`) with `updateAvailable` signal
- [x] Show update banner in `app.html` when update is ready
- [ ] Fix update banner CSS class typo
- [ ] Add `reload()` method to `App` (currently referenced in template but may be missing)

## Epic: Responsive / Mobile Polish

- [x] Add layout design tokens to `styles.scss`
- [x] Add mobile media query (`max-width: 480px`) with touch-friendly overrides
- [x] Refactor all component SCSS to use layout tokens
- [ ] Test on real mobile devices / emulators
- [ ] Accessibility audit (touch targets, contrast, focus indicators)

---

## Completed epics

_None yet._
