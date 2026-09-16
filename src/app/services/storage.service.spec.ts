import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
  });

  it('reports an already-durable origin without asking again', async () => {
    spyOn(navigator.storage, 'persisted').and.resolveTo(true);
    const persist = spyOn(navigator.storage, 'persist').and.resolveTo(true);

    const service = TestBed.inject(StorageService);

    expect(await service.claimPersistence()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
    expect(service.persisted()).toBe(true);
  });

  it('requests persistence when the origin is still evictable', async () => {
    spyOn(navigator.storage, 'persisted').and.resolveTo(false);
    const persist = spyOn(navigator.storage, 'persist').and.resolveTo(true);

    const service = TestBed.inject(StorageService);

    expect(await service.claimPersistence()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(service.persisted()).toBe(true);
  });

  // Firefox prompts the user for this. Asking again on every subscribe and
  // every download would turn one refusal into a pestering loop.
  it('does not re-request after a refusal', async () => {
    spyOn(navigator.storage, 'persisted').and.resolveTo(false);
    const persist = spyOn(navigator.storage, 'persist').and.resolveTo(false);

    const service = TestBed.inject(StorageService);

    expect(await service.claimPersistence()).toBe(false);
    expect(await service.claimPersistence()).toBe(false);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('reads back usage and quota', async () => {
    spyOn(navigator.storage, 'estimate').and.resolveTo({
      usage: 1024,
      quota: 4096,
      usageDetails: { caches: 900 },
    } as StorageEstimate);

    const usage = await TestBed.inject(StorageService).estimate();

    expect(usage).toEqual(
      jasmine.objectContaining({ usage: 1024, quota: 4096, details: { caches: 900 } }),
    );
  });

  // Reporting storage is a nicety; it must never take the settings page down.
  it('returns null when the browser refuses to estimate', async () => {
    spyOn(navigator.storage, 'estimate').and.rejectWith(new Error('nope'));

    expect(await TestBed.inject(StorageService).estimate()).toBeNull();
  });
});
