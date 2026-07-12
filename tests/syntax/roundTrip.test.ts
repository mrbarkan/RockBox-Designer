import { describe, expect, it } from 'vitest';
import { parseRockbox, serializeNode, serializeRockbox } from '../../rockbox/syntax';
import { roundTripFixtures } from '../fixtures/syntax/roundTripFixtures';

describe('lossless Rockbox source round trips', () => {
  for (const fixture of roundTripFixtures) {
    it(`preserves ${fixture.name}`, () => {
      const document = parseRockbox(fixture.source);
      expect(serializeRockbox(document)).toBe(fixture.source);
      expect(document.nodes.map(serializeNode).join('')).toBe(fixture.source);
    });
  }
});
