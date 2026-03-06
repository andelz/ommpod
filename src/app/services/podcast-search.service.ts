import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Podcast, Episode } from '../models/podcast.model';

interface ItunesResult {
  collectionId: number;
  collectionName: string;
  artistName: string;
  feedUrl: string;
  artworkUrl600: string;
  primaryGenreName: string;
  trackCount: number;
}

interface ItunesResponse {
  resultCount: number;
  results: ItunesResult[];
}

@Injectable({ providedIn: 'root' })
export class PodcastSearchService {
  private http = inject(HttpClient);

  search(term: string): Observable<Podcast[]> {
    const url = `https://itunes.apple.com/search?media=podcast&term=${encodeURIComponent(term)}&limit=20`;
    return this.http.get<ItunesResponse>(url).pipe(
      map(res => res.results
        .filter(r => r.feedUrl)
        .map(r => ({
          id: String(r.collectionId),
          title: r.collectionName,
          author: r.artistName,
          feedUrl: r.feedUrl,
          artworkUrl: r.artworkUrl600,
          genre: r.primaryGenreName,
          episodeCount: r.trackCount,
        }))
      )
    );
  }

  async fetchEpisodes(podcast: Podcast): Promise<Episode[]> {
    const xml = await fetchRssFeed(podcast.feedUrl);
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    if (doc.querySelector('parsererror')) {
      throw new Error('invalid feed xml');
    }
    const items = Array.from(doc.querySelectorAll('item'));
    return items.slice(0, 50).map((item, i) => {
      const enclosure = item.querySelector('enclosure');
      const audioUrl = enclosure?.getAttribute('url') ?? '';
      const durationStr = item.querySelector('duration')?.textContent ?? '0';
      const duration = parseDuration(durationStr);
      const pubDateStr = item.querySelector('pubDate')?.textContent ?? '';
      const episodeArtwork =
        item.querySelector('image')?.getAttribute('href') ??
        item.querySelector('image href')?.textContent ??
        item.getElementsByTagNameNS('http://www.itunes.com/dtds/podcast-1.0.dtd', 'image')[0]?.getAttribute('href') ??
        item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'content')[0]?.getAttribute('url') ??
        item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'thumbnail')[0]?.getAttribute('url') ??
        '';
      return {
        id: `${podcast.id}-${i}`,
        podcastId: podcast.id,
        podcastTitle: podcast.title,
        title: item.querySelector('title')?.textContent?.trim() ?? `Episode ${i + 1}`,
        description: item.querySelector('description')?.textContent?.trim() ?? '',
        audioUrl,
        artworkUrl: episodeArtwork || podcast.artworkUrl,
        duration,
        pubDate: pubDateStr ? new Date(pubDateStr) : new Date(),
        downloaded: false,
      };
    }).filter(e => e.audioUrl);
  }
}

function parseDuration(s: string): number {
  if (!s) return 0;
  const parts = s.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(s) || 0;
}

async function fetchRssFeed(feedUrl: string): Promise<string> {
  // 1. Try direct fetch (works if the feed has CORS headers)
  try {
    const res = await fetch(feedUrl, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const text = await res.text();
      if (text.includes('<rss') || text.includes('<feed')) return text;
    }
  } catch { /* fall through */ }

  // 2. corsproxy.io
  try {
    const res = await fetch(
      `https://corsproxy.io/?url=${encodeURIComponent(feedUrl)}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (res.ok) return res.text();
  } catch { /* fall through */ }

  // 3. allorigins (json wrapper)
  try {
    const res = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(feedUrl)}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.contents) return data.contents as string;
    }
  } catch { /* fall through */ }

  throw new Error('could not load feed');
}
