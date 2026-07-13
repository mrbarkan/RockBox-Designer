import { describe, expect, it } from 'vitest';
import { parseRb12Font } from '../../rockbox/fonts';

const fixture = () => {
  const bytes = new Uint8Array(40);
  bytes.set(new TextEncoder().encode('RB12'));
  const view = new DataView(bytes.buffer);
  view.setUint16(4, 13, true);
  view.setUint16(6, 16, true);
  view.setUint16(8, 13, true);
  view.setUint16(10, 1, true);
  view.setUint32(12, 32, true);
  view.setUint32(16, 32, true);
  view.setUint32(20, 95, true);
  view.setUint32(24, 4, true);
  view.setUint32(28, 95, true);
  view.setUint32(32, 95, true);
  return bytes;
};

describe('RB12 font metrics', () => {
  it('reads the exact Rockbox font header layout', () => {
    expect(parseRb12Font(fixture())).toEqual({
      format: 'RB12', maxWidth: 13, height: 16, ascent: 13, depth: 1,
      firstCharacter: 32, defaultCharacter: 32, glyphCount: 95,
      bitmapBytes: 4, offsetCount: 95, widthCount: 95, fileBytes: 40
    });
  });

  it('rejects non-RB12 and truncated binary data', () => {
    expect(() => parseRb12Font(new Uint8Array(35))).toThrow(/36-byte/);
    const bytes = fixture();
    bytes[0] = 0;
    expect(() => parseRb12Font(bytes)).toThrow(/signature/);
  });
});
