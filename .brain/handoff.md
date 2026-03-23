# Handoff — pod

> Overwritten at session end by /wrap-up.

## Session date
2026-03-23

## What was done this session
- Added **@ngx-translate/core** i18n support — installed package, wired `provideTranslateService` + `provideTranslateHttpLoader` in `app.config.ts`, added `TranslateModule` to `App`
- Created **`public/i18n/en.json`** and **`public/i18n/de.json`** with translations for all components (downloads, episode-list, home, library, now-playing, search)
- Migrated all component templates to use `| translate` pipe instead of hardcoded English strings
- Added **SW update banner** — `updateAvailable` signal in `App`, listens to `SwUpdate.versionUpdates`, shows dismissible banner with reload button (keys: `home.update.message`, `home.update.reload`)
- Added home screen welcome state i18n keys (`home.welcome.*`, `home.loading`, `home.genre-label`, `home.subscribe`, `home.empty.*`)

## Current state
- Branch: `master` (3 commits ahead of origin, all changes unstaged/uncommitted)
- In-progress PR / ticket: None
- Files actively being changed:
  - `public/i18n/en.json` (new — English translations)
  - `public/i18n/de.json` (new — German translations)
  - `src/app/app.config.ts` (ngx-translate provider setup)
  - `src/app/app.ts` (TranslateModule import, SW update signal)
  - `src/app/app.html` (SW update banner)
  - All component HTML templates (translate pipe migration)

## Open questions / blockers
- `en.json` is missing newer home-screen keys added this session: `home.welcome.*`, `home.loading`, `home.genre-label`, `home.subscribe`, `home.empty.*`, `home.update.*` — need to be added
- SW update banner CSS class has a typo: `class="home.update-banner"` should be `class="update-banner"`
- No language switcher UI yet — language is hardcoded to `'en'`
- Changes are unstaged and uncommitted

## What to do next
1. Complete `en.json` and `de.json` with the missing home/update keys discovered during template migration
2. Fix the typo in `app.html` (`home.update-banner` → `update-banner`)
3. Commit the current batch of work
4. Add a language switcher (e.g., toggle in nav or settings) to let users switch between `en` and `de`
5. Unit tests for DiscoveryService and HomeComponent
6. Empty-state for users with no subscriptions (curated/trending)
