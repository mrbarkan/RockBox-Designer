import { describe, expect, it } from 'vitest';
import { DEFAULT_SIMULATION, DEFAULT_SONG } from '../../constants';
import { interpretWps } from '../../rockbox/semantics';
import { parseRockbox } from '../../rockbox/syntax';

const options = {
  width: 320,
  height: 240,
  defaultFont: '14-Nimbus.fnt',
  foreground: '#ffffff',
  background: '#000000',
  sim: DEFAULT_SIMULATION,
  song: DEFAULT_SONG
};

describe('source-linked WPS interpreter', () => {
  it('interprets viewports, colors, metadata, bars, album art, touch, and scrolling text', () => {
    const document = parseRockbox([
      '%V(10,20,200,100,14-Nimbus.fnt)',
      '%Vf(ff5800)%al%s%it',
      '%pb(0,20,100,6,-)',
      '%pv(0,30,100,6,-)',
      '%Cl(110,10,40,40,c,c)%Cd',
      '%T(0,70,80,20,play)'
    ].join('\n'));
    const result = interpretWps(document, options);

    expect(result.valid).toBe(true);
    expect(result.operations.map(operation => operation.type)).toEqual(expect.arrayContaining([
      'setViewport', 'drawText', 'drawProgress', 'drawAlbumArt', 'debugOverlay'
    ]));
    const title = result.operations.find(operation => operation.type === 'drawText');
    expect(title).toMatchObject({ text: DEFAULT_SONG.title, color: '#ff5800', scroll: true });
    expect(title?.source.nodeId).toMatch(/^tag:/);
    expect(result.layers.some(layer => layer.label === 'Track progress' && layer.properties.length >= 4)).toBe(true);
  });

  it('evaluates playback branches and accepts explicit branch preview overrides', () => {
    const document = parseRockbox('%?mp<Stopped|Playing|Paused|Forward|%zzInactive(alpha)>');
    const playing = interpretWps(document, {
      ...options,
      sim: { ...DEFAULT_SIMULATION, playStatus: 'play' }
    });
    const conditional = playing.layers.find(layer => layer.kind === 'conditional');
    expect(conditional?.selectedBranch).toBe(1);
    expect(playing.operations.find(operation => operation.type === 'drawText')).toMatchObject({ text: 'Playing' });

    const overridden = interpretWps(document, {
      ...options,
      sim: { ...DEFAULT_SIMULATION, playStatus: 'play' },
      branchOverrides: { [conditional!.sourceNodeId]: 4 }
    });
    expect(overridden.layers.some(layer => layer.label.includes('zzInactive') && layer.active)).toBe(true);
    expect(playing.layers.some(layer => layer.label.includes('zzInactive') && !layer.active)).toBe(true);
  });

  it('renders preloaded sprite state while preserving unsupported nodes in the layer model', () => {
    const result = interpretWps(parseRockbox('%xl(B,battery.bmp,2,3,10)\n%xd(B,%bl)\n%zzFuture(alpha)'), {
      ...options,
      sim: { ...DEFAULT_SIMULATION, batteryLevel: 55 }
    });
    expect(result.operations.find(operation => operation.type === 'drawBitmap')).toMatchObject({
      assetPath: 'battery.bmp', frameCount: 10, frame: 4
    });
    expect(result.layers.some(layer => layer.kind === 'unsupported' && layer.label.includes('zzFuture'))).toBe(true);
  });

  it('reports invalid syntax without discarding the partial semantic model', () => {
    const result = interpretWps(parseRockbox('%V(0,0,320,240,-)\n%?mp<Play|Pause'), options);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some(diagnostic => diagnostic.severity === 'error')).toBe(true);
    expect(result.layers.some(layer => layer.kind === 'conditional')).toBe(true);
  });
});
