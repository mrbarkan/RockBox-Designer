import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPhase2Golden } from '../fixtures/phase2/golden';
import { buildPhase3FmsGolden, buildPhase3SbsGolden } from '../fixtures/phase3/golden';
import { renderToPixelImage } from '../../rockbox/rendering';

describe('deterministic native-pixel rendering', () => {
  it('matches the checked-in 320x240 WPS golden screenshot', () => {
    expect(buildPhase2Golden()).toEqual(new Uint8Array(readFileSync('tests/golden/phase2-wps.ppm')));
  });

  it('uses exactly one RGB triplet per native target pixel', () => {
    const ppm = buildPhase2Golden();
    const header = new TextEncoder().encode('P6\n320 240\n255\n');
    expect(ppm.length).toBe(header.length + 320 * 240 * 3);
  });

  it('matches the checked-in 320x240 SBS menu golden screenshot', () => {
    expect(buildPhase3SbsGolden()).toEqual(new Uint8Array(readFileSync('tests/golden/phase3-sbs.ppm')));
  });

  it('matches the checked-in 320x240 FMS state golden screenshot', () => {
    expect(buildPhase3FmsGolden()).toEqual(new Uint8Array(readFileSync('tests/golden/phase3-fms.ppm')));
  });

  it('does not paint a firmware fallback hidden by a 1x1 SBS UI viewport', () => {
    const source = { nodeId: 'usb-ui', span: { start: 0, end: 1, startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 } };
    const hidden = renderToPixelImage(4, 4, [{
      type: 'drawFirmwareFallback',
      rect: { x: 0, y: 0, width: 1, height: 1 },
      feature: 'usb-logo',
      source
    }], '#000000');
    const visible = renderToPixelImage(4, 4, [{
      type: 'drawFirmwareFallback',
      rect: { x: 0, y: 0, width: 4, height: 4 },
      feature: 'usb-logo',
      source
    }], '#000000');

    expect([...hidden.pixels]).toEqual(new Array(4 * 4 * 3).fill(0));
    expect([...visible.pixels]).not.toEqual(new Array(4 * 4 * 3).fill(0));
  });
});
