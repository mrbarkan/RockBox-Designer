import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseRockbox, serializeRockbox } from '../../rockbox/syntax';

const safeFragments = [
  'plain text',
  ' ',
  '\n',
  '\r\n',
  '# comment\n',
  'Björk 日本語',
  '%%',
  '%it',
  '%V(0,0,320,240,-)',
  '%x|icon.bmp|',
  '%?mp<playing|paused>',
  '%?mh<hold|%?mp<playing|paused>>'
];

describe('property-based round trips', () => {
  it('preserves randomized combinations of known-safe fragments', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...safeFragments), { minLength: 0, maxLength: 80 }),
        fragments => {
          const source = fragments.join('');
          expect(serializeRockbox(parseRockbox(source))).toBe(source);
        }
      ),
      { numRuns: 300 }
    );
  });

  it('preserves randomized safe Unicode text', () => {
    const safeCharacters = Array.from('abcdefghijklmnopqrstuvwxyz 0123456789éø日本語🙂\n\r\t');
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...safeCharacters), { minLength: 0, maxLength: 300 }),
        characters => {
          const source = characters.join('');
          expect(serializeRockbox(parseRockbox(source))).toBe(source);
        }
      ),
      { numRuns: 200 }
    );
  });
});
