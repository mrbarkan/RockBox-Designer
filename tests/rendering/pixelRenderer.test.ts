import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPhase2Golden } from '../fixtures/phase2/golden';

describe('deterministic native-pixel rendering', () => {
  it('matches the checked-in 320x240 WPS golden screenshot', () => {
    expect(buildPhase2Golden()).toEqual(new Uint8Array(readFileSync('tests/golden/phase2-wps.ppm')));
  });

  it('uses exactly one RGB triplet per native target pixel', () => {
    const ppm = buildPhase2Golden();
    const header = new TextEncoder().encode('P6\n320 240\n255\n');
    expect(ppm.length).toBe(header.length + 320 * 240 * 3);
  });
});
