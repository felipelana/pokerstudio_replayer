import { describe, expect, it } from 'vitest';
import {
  AVAILABLE_ROOMS,
  COMING_SOON_ROOMS,
  isRoomAvailable,
  roomForSite,
  roomName,
  ROOMS,
} from '@pokerstudio/shared';
import { parsers } from './registry';
import { NotImplementedError } from './types';
import type { Site } from '@/domain/model/types';

/**
 * The room catalogue is a promise to the reader: the landing page grid, the
 * importer's refusal and the nicknames form all read this list. These tests
 * hold it to what the parsers can actually do, so the promise cannot drift out
 * of step with the code that has to keep it.
 */
describe('the room catalogue', () => {
  it('says a room is available only when a parser really reads it', () => {
    for (const room of AVAILABLE_ROOMS) {
      expect(room.site, `${room.name} is available but has no parser key`).toBeDefined();
      const parser = parsers.find((p) => p.site === room.site)!;
      expect(parser, `no parser registered for ${room.name}`).toBeDefined();
      // A parser that throws NotImplementedError is a stub, whatever the
      // catalogue claims.
      expect(() => {
        try {
          parser.parse('not a hand');
        } catch (e) {
          if (e instanceof NotImplementedError) throw e;
        }
      }, `${room.name} is a stub`).not.toThrow(NotImplementedError);
    }
  });

  it('lists exactly the two rooms with a grammar derived from real hands', () => {
    expect(AVAILABLE_ROOMS.map((r) => r.id).sort()).toEqual(['chico', 'pokerstars']);
  });

  it('marks every room the importer cannot read as coming soon', () => {
    for (const room of COMING_SOON_ROOMS) {
      if (!room.site) continue;
      const parser = parsers.find((p) => p.site === room.site);
      if (!parser) continue;
      // Recognised but not read: the parser must refuse rather than guess.
      expect(
        () => parser.parse('not a hand'),
        `${room.name} claims coming-soon but parses`,
      ).toThrow();
    }
  });

  it('gives every parser key a room to be named by', () => {
    for (const parser of parsers) {
      expect(roomName(parser.site), `parser ${parser.site} has no catalogue entry`).toBeDefined();
      expect(roomForSite(parser.site as Site)).toBeDefined();
    }
  });

  it('answers plainly whether a room can be read', () => {
    expect(isRoomAvailable('pokerstars')).toBe(true);
    expect(isRoomAvailable('chico')).toBe(true);
    expect(isRoomAvailable('ggpoker')).toBe(false);
    expect(isRoomAvailable('wpn')).toBe(false);
  });

  it('keeps ids unique and every entry complete', () => {
    expect(new Set(ROOMS.map((r) => r.id)).size).toBe(ROOMS.length);
    for (const room of ROOMS) {
      expect(room.name.trim()).not.toBe('');
      expect(room.monogram.trim()).not.toBe('');
      expect(['available', 'coming-soon']).toContain(room.status);
    }
  });

  it('includes the rooms the settings screen has to offer a nickname for', () => {
    // Ignition has no parser yet and still needs a field: the nickname is kept
    // for when it does.
    const ids = ROOMS.map((r) => r.id);
    for (const expected of [
      'pokerstars',
      'chico',
      'ggpoker',
      '888poker',
      'ipoker',
      'wpn',
      'coinpoker',
      'ignition',
    ]) {
      expect(ids, `${expected} missing from the catalogue`).toContain(expected);
    }
    expect(roomForSite('pokerstars')?.status).toBe('available');
    expect(ROOMS.find((r) => r.id === 'ignition')?.site).toBeUndefined();
  });
});
