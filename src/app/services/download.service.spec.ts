import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Episode } from '../models/podcast.model';
import { DownloadService } from './download.service';
import { PersistenceService } from './persistence.service';
import { StorageService } from './storage.service';

function episode(id: string, audioUrl: string): Episode {
  return {
    id,
    podcastId: 'p1',
    podcastTitle: 'Show',
    title: id,
    description: '',
    audioUrl,
    artworkUrl: '',
    duration: 0,
    pubDate: new Date(0),
    downloaded: true,
  };
}

/** Lets the fire-and-forget `init()` chain settle before we assert on it. */
function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('DownloadService reconciliation', () => {
  const kept = episode('kept', 'https://cdn.test/kept.mp3');
  const orphan = episode('orphan', 'https://cdn.test/orphan.mp3');

  let stored: Episode[];
  let deleted: string[];

  function setup(opts: { sw: boolean; cached: string[] | 'never-answers' }) {
    spyOn(DownloadService.prototype as unknown as { getSW(): Promise<unknown> }, 'getSW')
      .and.resolveTo(opts.sw ? ({} as ServiceWorker) : null);

    spyOn(DownloadService.prototype, 'listDownloadedUrls').and.callFake(() =>
      opts.cached === 'never-answers'
        ? new Promise<string[]>(() => {})
        : Promise.resolve(opts.cached),
    );

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: PersistenceService,
          useValue: {
            getDownloadedEpisodes: () => Promise.resolve(stored),
            deleteDownloadMeta: (id: string) => {
              deleted.push(id);
              return Promise.resolve();
            },
          },
        },
        { provide: StorageService, useValue: { claimPersistence: () => Promise.resolve(true) } },
      ],
    });
  }

  beforeEach(() => {
    stored = [kept, orphan];
    deleted = [];
  });

  it('drops metadata whose audio is no longer in the cache', async () => {
    setup({ sw: true, cached: [kept.audioUrl] });

    const service = TestBed.inject(DownloadService);
    await flush();

    expect(deleted).toEqual([orphan.id]);
    expect(service.downloadedEpisodes().map(e => e.id)).toEqual([kept.id]);
  });

  it('keeps everything when the cache still holds it all', async () => {
    setup({ sw: true, cached: [kept.audioUrl, orphan.audioUrl] });

    const service = TestBed.inject(DownloadService);
    await flush();

    expect(deleted).toEqual([]);
    expect(service.downloadedEpisodes().length).toBe(2);
  });

  // Without a service worker the cache listing comes back empty, which looks
  // exactly like "everything was evicted". Deleting on that would wipe the
  // user's whole download list on a browser that simply has no SW.
  it('deletes nothing when there is no service worker to ask', async () => {
    setup({ sw: false, cached: [] });

    const service = TestBed.inject(DownloadService);
    await flush();

    expect(deleted).toEqual([]);
    expect(service.downloadedEpisodes().length).toBe(2);
  });

  it('deletes nothing when the service worker never answers', async () => {
    setup({ sw: true, cached: 'never-answers' });

    const service = TestBed.inject(DownloadService);
    await flush();

    expect(deleted).toEqual([]);
    expect(service.downloadedEpisodes().length).toBe(2);
  });
});
