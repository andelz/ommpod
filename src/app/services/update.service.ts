import { inject, Injectable, NgZone, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

@Injectable({ providedIn: 'root' })
export class UpdateService {
  private swUpdate = inject(SwUpdate, { optional: true });
  private ngZone = inject(NgZone);

  updateAvailable = signal(false);
  checking = signal(false);

  constructor() {
    if (!this.swUpdate?.isEnabled) return;

    this.swUpdate.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') {
        this.updateAvailable.set(true);
      }
    });

    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.checkForUpdate();
        }
      });
    });
  }

  async checkForUpdate(): Promise<boolean> {
    if (!this.swUpdate?.isEnabled) return false;
    this.checking.set(true);
    try {
      return await this.swUpdate.checkForUpdate();
    } finally {
      this.checking.set(false);
    }
  }

  reload() {
    window.location.reload();
  }
}
