import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PlayerService } from './player.service';

describe('PlayerService rate and progress', () => {
  let player: PlayerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    player = TestBed.inject(PlayerService);
  });

  it('exposes the rates the segmented control renders', () => {
    expect([...PlayerService.RATES]).toEqual([1, 1.25, 1.5, 1.75, 2]);
  });

  it('cycles through every rate and wraps back to the start', () => {
    const seen: number[] = [player.playbackRate()];
    for (let i = 0; i < PlayerService.RATES.length; i++) {
      player.cycleRate();
      seen.push(player.playbackRate());
    }
    // starts at 1, walks the list, returns to 1
    expect(seen).toEqual([1, 1.25, 1.5, 1.75, 2, 1]);
  });

  it('sets an arbitrary rate directly, as the segmented control does', () => {
    player.setPlaybackRate(1.75);
    expect(player.playbackRate()).toBe(1.75);

    // and cycling continues from there rather than resetting
    player.cycleRate();
    expect(player.playbackRate()).toBe(2);
  });

  it('reports progress as a percentage, and 0 when duration is unknown', () => {
    expect(player.progressPct()).toBe(0);

    player.duration.set(200);
    player.currentTime.set(50);
    expect(player.progressPct()).toBe(25);

    player.duration.set(0);
    expect(player.progressPct()).toBe(0);
  });
});
