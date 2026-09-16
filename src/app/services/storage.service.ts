import { Injectable, signal } from '@angular/core';

export interface StorageUsage {
  usage: number;
  quota: number;
  /** Per-API breakdown. Non-standard and Chrome-only, so treat it as optional. */
  details?: { indexedDB?: number; caches?: number; fileSystem?: number };
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  /** Whether the origin sits in the durable bucket. `null` until first checked. */
  persisted = signal<boolean | null>(null);

  private claim: Promise<boolean> | null = null;

  constructor() {
    this.refresh();
  }

  /**
   * Ask the browser to move this origin into the durable storage bucket, where
   * eviction only happens when the user clears site data.
   *
   * Call this once the user has something worth protecting — a subscription, a
   * download — never on a cold first load. Chrome decides silently from
   * engagement heuristics and Firefox shows a prompt; both go better after the
   * user has data to lose. Memoised so a denial is never re-prompted.
   */
  claimPersistence(): Promise<boolean> {
    this.claim ??= this.requestPersistence();
    return this.claim;
  }

  async estimate(): Promise<StorageUsage | null> {
    if (!navigator.storage?.estimate) return null;
    try {
      const est = await navigator.storage.estimate();
      const details = (est as { usageDetails?: StorageUsage['details'] }).usageDetails;
      return { usage: est.usage ?? 0, quota: est.quota ?? 0, details };
    } catch {
      return null;
    }
  }

  private async requestPersistence(): Promise<boolean> {
    if (!navigator.storage?.persist) return false;
    try {
      const granted = (await navigator.storage.persisted()) || (await navigator.storage.persist());
      this.persisted.set(granted);
      return granted;
    } catch {
      return false;
    }
  }

  private async refresh(): Promise<void> {
    if (!navigator.storage?.persisted) {
      this.persisted.set(false);
      return;
    }
    try {
      this.persisted.set(await navigator.storage.persisted());
    } catch {
      this.persisted.set(false);
    }
  }
}
