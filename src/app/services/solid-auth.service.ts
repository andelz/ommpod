import { Injectable, signal } from '@angular/core';
import {
  Session,
  getDefaultSession,
  handleIncomingRedirect,
  login,
  logout,
} from '@inrupt/solid-client-authn-browser';
import {
  getSolidDataset,
  getThing,
  getUrl,
} from '@inrupt/solid-client';

/** localStorage key where the user's last-used OIDC issuer URL is persisted. */
const ISSUER_KEY = 'pod-solid-issuer';

/** RDF predicate used in a Solid WebID profile to declare the Pod storage root. */
const PIM_STORAGE = 'http://www.w3.org/ns/pim/space#storage';

/**
 * Manages Solid OIDC authentication and session state.
 *
 * ## Authentication flow
 *
 * Solid uses OpenID Connect (OIDC) with a redirect-based flow:
 *
 * 1. User enters their **Identity Provider** (IdP) URL (e.g. `https://login.inrupt.com`).
 * 2. {@link login} redirects the browser to the IdP for authentication.
 * 3. After login, the IdP redirects back to this app with auth parameters in the URL.
 * 4. {@link handleRedirectAfterLogin} (called via `provideAppInitializer` in `app.config.ts`)
 *    completes the handshake, restores the session, and populates the reactive signals.
 *
 * On subsequent page loads, `restorePreviousSession: true` silently re-establishes
 * the session from the browser's stored token — no redirect required.
 *
 * ## Reactive signals
 *
 * | Signal        | Description                                       |
 * |---------------|---------------------------------------------------|
 * | `isLoggedIn`  | `true` while a valid Solid session is active       |
 * | `webId`       | The user's WebID URI, or `null`                    |
 * | `podUrl`      | Root URL of the user's Pod storage, or `null`      |
 *
 * These signals are consumed by {@link SolidSyncService} to trigger sync
 * and by the Settings UI to display connection state.
 *
 * ## Pod URL discovery
 *
 * After login, the service fetches the user's WebID profile document and
 * reads the `pim:storage` triple to find the Pod root URL. This is where
 * {@link SolidDataService} stores its resources (under `<podUrl>/podcasts/`).
 */
@Injectable({ providedIn: 'root' })
export class SolidAuthService {
  /** Whether the user is currently authenticated with a Solid Pod. */
  isLoggedIn = signal(false);

  /** The authenticated user's WebID URI (e.g. `https://id.inrupt.com/alice`). */
  webId = signal<string | null>(null);

  /**
   * Root URL of the user's Solid Pod storage.
   * Discovered from the `pim:storage` triple in the WebID profile document.
   */
  podUrl = signal<string | null>(null);

  /**
   * Returns the singleton Solid session managed by `@inrupt/solid-client-authn-browser`.
   * The session's `fetch` method automatically attaches the user's access token
   * to outgoing HTTP requests, enabling authenticated reads/writes to the Pod.
   */
  get session(): Session {
    return getDefaultSession();
  }

  /**
   * Returns the OIDC issuer URL the user last connected with,
   * falling back to Inrupt's public identity provider.
   * Persisted in localStorage so the input field is pre-populated on return visits.
   */
  get savedIssuer(): string {
    return localStorage.getItem(ISSUER_KEY) ?? 'https://login.inrupt.com';
  }

  /**
   * Completes a pending OIDC redirect (if any) and restores an existing session.
   *
   * Must be called **once on app startup** before any routing occurs — it is
   * registered as an Angular app initializer in `app.config.ts`. The function
   * inspects the current URL for OIDC callback parameters and, if found,
   * exchanges them for an access token. With `restorePreviousSession: true`,
   * it also silently restores sessions from prior visits.
   */
  async handleRedirectAfterLogin(): Promise<void> {
    const info = await handleIncomingRedirect({ restorePreviousSession: true });
    if (info?.isLoggedIn && info.webId) {
      this.isLoggedIn.set(true);
      this.webId.set(info.webId);
      const pod = await this.discoverPodUrl(info.webId);
      this.podUrl.set(pod);
    }
  }

  /**
   * Initiates the Solid OIDC login flow.
   *
   * Persists the chosen issuer URL for future visits, then redirects the browser
   * to the identity provider. After successful authentication, the IdP redirects
   * back to this app, where {@link handleRedirectAfterLogin} completes the flow.
   *
   * @param issuer - The OIDC issuer URL (e.g. `https://login.inrupt.com`).
   */
  async login(issuer: string): Promise<void> {
    localStorage.setItem(ISSUER_KEY, issuer);
    await login({
      oidcIssuer: issuer,
      redirectUrl: window.location.href,
      clientName: 'POD — Pur Podcast Player',
    });
  }

  /**
   * Ends the current Solid session and resets all reactive signals.
   * Does not remove the saved issuer — the user can reconnect easily.
   */
  async logout(): Promise<void> {
    await logout();
    this.isLoggedIn.set(false);
    this.webId.set(null);
    this.podUrl.set(null);
  }

  /**
   * Fetches the user's WebID profile document and extracts the Pod storage URL
   * from the `pim:storage` predicate.
   *
   * @returns The Pod root URL, or `null` if the profile doesn't declare one.
   */
  private async discoverPodUrl(webId: string): Promise<string | null> {
    try {
      const dataset = await getSolidDataset(webId, { fetch: this.session.fetch });
      const profile = getThing(dataset, webId);
      if (!profile) return null;
      return getUrl(profile, PIM_STORAGE) ?? null;
    } catch {
      return null;
    }
  }
}
