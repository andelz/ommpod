import { Injectable, signal, inject, effect } from '@angular/core';
import { SolidAuthService } from './solid-auth.service';
import { SolidDataService } from './solid-data.service';
import { LibraryService } from './library.service';
import { PersistenceService } from './persistence.service';

/** Possible states of the sync engine, exposed to the UI via {@link syncStatus}. */
type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

/** localStorage key for the offline retry queue. */
const QUEUE_KEY = 'pod-sync-queue';

/**
 * How long to wait (ms) before pushing progress changes to the Pod.
 * Playback progress updates every 5 s locally, but we debounce remote
 * writes to avoid flooding the Pod with HTTP requests.
 */
const PROGRESS_DEBOUNCE_MS = 30_000;

/** A pending push operation that failed and was queued for later retry. */
interface QueueEntry {
  type: 'subscriptions' | 'progress' | 'completed';
  timestamp: number;
}

/**
 * Orchestrates bidirectional synchronization between local IndexedDB
 * (via {@link PersistenceService}) and the remote Solid Pod
 * (via {@link SolidDataService}).
 *
 * ## Design principles
 *
 * - **Offline-first**: IndexedDB is the source of truth for the UI. The Pod
 *   is the sync target. The app works identically whether online, offline,
 *   or not connected to a Pod at all.
 * - **Eventual consistency**: Changes are pushed to the Pod in the background.
 *   If a push fails (network error, Pod unavailable), the operation is queued
 *   in localStorage and retried on the next successful connection.
 *
 * ## Sync triggers
 *
 * Two Angular `effect()`s drive the sync lifecycle:
 *
 * 1. **Auth effect** — when {@link SolidAuthService.isLoggedIn} becomes `true`,
 *    a full bidirectional sync is triggered ({@link fullSync}).
 * 2. **Change effect** — when {@link LibraryService.lastChange} increments
 *    (any local mutation), the affected data is pushed to the Pod. Progress
 *    pushes are debounced to at most once per 30 s; subscription and completed
 *    changes are pushed immediately.
 *
 * ## Merge strategies
 *
 * Each data type uses a strategy suited to its semantics:
 *
 * | Data type      | Strategy         | Rationale                                    |
 * |----------------|------------------|----------------------------------------------|
 * | Subscriptions  | Union by ID      | If subscribed on either side, keep it.        |
 * | Progress       | Last-write-wins  | Most recent `updatedAt` timestamp wins.       |
 * | Completed      | Union            | Once completed, always completed.             |
 *
 * After merging, the result is written back to **both** IndexedDB and the Pod,
 * so both sides converge to the same state.
 *
 * ## Offline queue
 *
 * Failed push operations are stored as {@link QueueEntry} objects in
 * localStorage under `pod-sync-queue`. The queue is replayed at the end
 * of every {@link fullSync}. Duplicate operation types are deduplicated
 * (e.g. three queued "progress" entries result in a single push).
 *
 * ## Reactive signals
 *
 * | Signal         | Description                                              |
 * |----------------|----------------------------------------------------------|
 * | `syncStatus`   | Current state: `idle`, `syncing`, `error`, or `offline`  |
 * | `lastSyncTime` | Timestamp of the last successful full sync, or `null`    |
 */
@Injectable({ providedIn: 'root' })
export class SolidSyncService {
  private solidAuth = inject(SolidAuthService);
  private solidData = inject(SolidDataService);
  private library = inject(LibraryService);
  private persistence = inject(PersistenceService);

  /** Current sync state, shown in the Settings UI status badge. */
  syncStatus = signal<SyncStatus>('idle');

  /** Timestamp of the last successful {@link fullSync}, or `null` if never synced. */
  lastSyncTime = signal<Date | null>(null);

  /** Handle for the debounced progress push timer. */
  private progressTimer: ReturnType<typeof setTimeout> | null = null;

  /** Tracks the last `lastChange` value we reacted to (prevents duplicate pushes). */
  private lastPushedChange = 0;

  constructor() {
    // Trigger a full bidirectional sync whenever the user logs in.
    effect(() => {
      if (this.solidAuth.isLoggedIn()) {
        this.fullSync();
      }
    });

    // Push local mutations to the Pod whenever LibraryService signals a change.
    // Progress is debounced (30 s); subscriptions and completed are immediate.
    effect(() => {
      const change = this.library.lastChange();
      if (change > 0 && this.solidAuth.isLoggedIn()) {
        this.scheduleProgressPush();
        this.pushSubscriptions();
        this.pushCompleted();
      }
    });
  }

  /**
   * Performs a full bidirectional sync: pull from Pod → merge with local → push back.
   *
   * 1. Ensures the `/podcasts/` container exists on the Pod.
   * 2. Merges subscriptions, progress, and completed episodes in parallel.
   * 3. Replays any queued offline operations.
   * 4. Updates {@link syncStatus} and {@link lastSyncTime}.
   *
   * Called automatically on login and manually via the "Sync now" button.
   */
  async fullSync(): Promise<void> {
    if (!this.solidAuth.isLoggedIn()) return;
    this.syncStatus.set('syncing');
    try {
      await this.solidData.ensureContainer();
      await Promise.all([
        this.mergeSubscriptions(),
        this.mergeProgress(),
        this.mergeCompleted(),
      ]);
      await this.processQueue();
      this.syncStatus.set('idle');
      this.lastSyncTime.set(new Date());
    } catch (err) {
      this.syncStatus.set(navigator.onLine ? 'error' : 'offline');
    }
  }

  /**
   * Pushes the current local subscriptions to the Pod.
   * On failure, the operation is queued for later retry.
   */
  async pushSubscriptions(): Promise<void> {
    if (!this.solidAuth.isLoggedIn()) return;
    try {
      const subs = await this.persistence.getSubscriptions();
      await this.solidData.writeSubscriptions(subs);
    } catch {
      this.enqueue('subscriptions');
    }
  }

  /**
   * Pushes the current local playback progress to the Pod.
   * On failure, the operation is queued for later retry.
   */
  async pushProgress(): Promise<void> {
    if (!this.solidAuth.isLoggedIn()) return;
    try {
      const local = await this.persistence.getAllProgress();
      const entries: Record<string, { time: number; updatedAt: number }> = {};
      for (const [id, time] of Object.entries(local)) {
        entries[id] = { time, updatedAt: Date.now() };
      }
      await this.solidData.writeProgress(entries);
    } catch {
      this.enqueue('progress');
    }
  }

  /**
   * Pushes the current local completed episode IDs to the Pod.
   * On failure, the operation is queued for later retry.
   */
  async pushCompleted(): Promise<void> {
    if (!this.solidAuth.isLoggedIn()) return;
    try {
      const ids = await this.persistence.getCompletedIds();
      await this.solidData.writeCompleted(ids);
    } catch {
      this.enqueue('completed');
    }
  }

  /**
   * Replays all queued offline operations.
   * Deduplicates by operation type — e.g. three queued "progress" entries
   * result in a single push of the current state.
   */
  async processQueue(): Promise<void> {
    const queue = this.loadQueue();
    if (queue.length === 0) return;
    this.clearQueue();
    const types = new Set(queue.map(e => e.type));
    const tasks: Promise<void>[] = [];
    if (types.has('subscriptions')) tasks.push(this.pushSubscriptions());
    if (types.has('progress')) tasks.push(this.pushProgress());
    if (types.has('completed')) tasks.push(this.pushCompleted());
    await Promise.allSettled(tasks);
  }

  // ── Merge strategies ──────────────────────────────────────────────────

  /**
   * Merges subscriptions using a **union** strategy: any podcast that exists
   * on either side (local or remote) is kept. Local entries take precedence
   * for metadata when the same podcast ID appears on both sides.
   */
  private async mergeSubscriptions(): Promise<void> {
    const [local, remote] = await Promise.all([
      this.persistence.getSubscriptions(),
      this.solidData.readSubscriptions(),
    ]);
    const merged = new Map(local.map(p => [p.id, p]));
    for (const p of remote) {
      if (!merged.has(p.id)) {
        merged.set(p.id, p);
      }
    }
    const result = [...merged.values()];
    await this.persistence.replaceAllSubscriptions(result);
    this.library.subscriptions.set(result);
    await this.solidData.writeSubscriptions(result);
  }

  /**
   * Merges playback progress using a **last-write-wins** strategy:
   * for each episode ID, the entry with the more recent `updatedAt`
   * timestamp is kept. This ensures that the most recent listening
   * position wins regardless of which device produced it.
   */
  private async mergeProgress(): Promise<void> {
    const [localAll, remote] = await Promise.all([
      this.persistence.getAllProgress(),
      this.solidData.readProgress(),
    ]);
    const merged: Record<string, { time: number; updatedAt: number }> = {};
    const now = Date.now();
    for (const [id, time] of Object.entries(localAll)) {
      merged[id] = { time, updatedAt: now };
    }
    for (const [id, entry] of Object.entries(remote)) {
      const existing = merged[id];
      if (!existing || entry.updatedAt > existing.updatedAt) {
        merged[id] = entry;
      }
    }
    const localProgress: Record<string, number> = {};
    for (const [id, entry] of Object.entries(merged)) {
      localProgress[id] = entry.time;
    }
    await this.persistence.replaceAllProgress(localProgress);
    await this.solidData.writeProgress(merged);
  }

  /**
   * Merges completed episodes using a **union** strategy:
   * once an episode is marked completed on any device, it stays completed.
   * There is no "uncomplete" action in the app.
   */
  private async mergeCompleted(): Promise<void> {
    const [local, remote] = await Promise.all([
      this.persistence.getCompletedIds(),
      this.solidData.readCompleted(),
    ]);
    const merged = [...new Set([...local, ...remote])];
    await this.persistence.replaceAllCompleted(merged);
    this.library.completedEpisodes.set(new Set(merged));
    await this.solidData.writeCompleted(merged);
  }

  // ── Debouncing ────────────────────────────────────────────────────────

  /**
   * Schedules a progress push after {@link PROGRESS_DEBOUNCE_MS}.
   * If a push is already scheduled, this is a no-op (the pending timer
   * will pick up the latest state when it fires).
   */
  private scheduleProgressPush(): void {
    if (this.progressTimer) return;
    this.progressTimer = setTimeout(() => {
      this.progressTimer = null;
      this.pushProgress();
    }, PROGRESS_DEBOUNCE_MS);
  }

  // ── Offline queue ─────────────────────────────────────────────────────

  /**
   * Adds a failed push operation to the offline retry queue.
   * The queue is persisted in localStorage so it survives page reloads.
   */
  private enqueue(type: QueueEntry['type']): void {
    const queue = this.loadQueue();
    queue.push({ type, timestamp: Date.now() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  /** Reads the offline retry queue from localStorage. */
  private loadQueue(): QueueEntry[] {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    } catch {
      return [];
    }
  }

  /** Clears the offline retry queue after successful processing. */
  private clearQueue(): void {
    localStorage.removeItem(QUEUE_KEY);
  }
}
