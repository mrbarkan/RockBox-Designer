import { describe, expect, it } from 'vitest';
import { applyRockboxTransparency } from '../../rockbox/rendering/canvasRenderer';

describe('Rockbox canvas bitmap handling', () => {
  it('turns the Rockbox magenta color key transparent without changing other colors', () => {
    const pixels = new Uint8ClampedArray([
      255, 0, 255, 255,
      37, 88, 228, 255,
      252, 4, 251, 255
    ]);

    expect(applyRockboxTransparency(pixels)).toBe(true);
    expect([...pixels]).toEqual([
      255, 0, 255, 0,
      37, 88, 228, 255,
      252, 4, 251, 255
    ]);
  });
});
