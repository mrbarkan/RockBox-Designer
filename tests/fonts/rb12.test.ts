import { describe, expect, it } from 'vitest';
import { decodeRb12Font, getRb12Glyph, measureRb12Text, parseRb12Font } from '../../rockbox/fonts';
import { rb12Fixture as fixture } from './rb12Fixture';

describe('RB12 font metrics', () => {
  it('reads the exact Rockbox font header layout', () => {
    expect(parseRb12Font(fixture())).toEqual({
      format: 'RB12', maxWidth: 13, height: 16, ascent: 13, depth: 1,
      firstCharacter: 32, defaultCharacter: 32, glyphCount: 95,
      bitmapBytes: 8, offsetCount: 95, widthCount: 95, fileBytes: 329
    });
  });

  it('rejects non-RB12 and truncated binary data', () => {
    expect(() => parseRb12Font(new Uint8Array(35))).toThrow(/36-byte/);
    const bytes = fixture();
    bytes[0] = 0;
    expect(() => parseRb12Font(bytes)).toThrow(/signature/);
  });

  it('decodes alpha glyph pixels and measures the firmware fallback width', () => {
    const font = decodeRb12Font(fixture());
    const glyph = getRb12Glyph(font, 65);
    expect(glyph).toMatchObject({ width: 1, height: 16, outsideRange: false, aliasesDefaultGlyph: true });
    expect([...glyph.alpha]).toEqual(Array(16).fill(0));
    expect(measureRb12Text(font, 'A🙂')).toMatchObject({
      width: 2,
      height: 16,
      outsideRange: [0x1f642]
    });
  });

  it('decodes Rockbox monochrome glyph row blocks in firmware bitmap order', () => {
    const bytes = new Uint8Array(40);
    bytes.set(new TextEncoder().encode('RB12'));
    const view = new DataView(bytes.buffer);
    view.setUint16(4, 3, true);
    view.setUint16(6, 3, true);
    view.setUint16(8, 3, true);
    view.setUint16(10, 0, true);
    view.setUint32(12, 65, true);
    view.setUint32(16, 65, true);
    view.setUint32(20, 1, true);
    view.setUint32(24, 3, true);
    bytes.set([6, 5, 6], 36);
    const glyph = getRb12Glyph(decodeRb12Font(bytes), 65);
    expect([...glyph.alpha]).toEqual([
      0, 255, 0,
      255, 0, 255,
      255, 255, 255
    ]);
  });

  it('rejects truncated tables and glyphs that extend past bitmap data', () => {
    expect(() => parseRb12Font(fixture().subarray(0, 100))).toThrow(/table extends/);
    const bytes = fixture();
    bytes[36 + 8 + 95 * 2] = 13;
    expect(() => parseRb12Font(bytes)).toThrow(/glyph 0 extends/);
  });
});
