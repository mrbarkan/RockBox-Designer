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

  it('preserves comments in source without projecting them as visual layers', () => {
    const source = '# Header comment\n%V(0,0,320,240,-)\n# Element note\n%it\n%?mh<# Inactive note\nLocked|Unlocked>';
    const document = parseRockbox(source);
    const result = interpretWps(document, options);

    expect(document.source).toBe(source);
    expect(document.source).toContain('# Inactive note');
    expect(result.layers.some(layer => layer.label === 'Comment')).toBe(false);
    expect(result.layers.some(layer => layer.kind === 'viewport')).toBe(true);
    expect(result.layers.some(layer => layer.kind === 'element')).toBe(true);
  });

  it('reports invalid syntax without discarding the partial semantic model', () => {
    const result = interpretWps(parseRockbox('%V(0,0,320,240,-)\n%?mp<Play|Pause'), options);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some(diagnostic => diagnostic.severity === 'error')).toBe(true);
    expect(result.layers.some(layer => layer.kind === 'conditional')).toBe(true);
  });

  it('renders only enabled conditional viewports and resolves negative dimensions and font slots', () => {
    const result = interpretWps(parseRockbox([
      '%Fl(7,20-Cantarell-Bold.fnt)',
      '%V(0,0,-,-,-)%?if(%St(battery display), =, graphic)<%Vd(Player)>',
      '%Vl(Player,10,152,-10,28,7)',
      '%ac%it %ia',
      '%Vl(Hidden,0,0,-,-,-)',
      'This must stay hidden'
    ].join('\n')), { ...options, settings: { 'battery display': 'graphic' } });

    expect(result.operations.find(operation => operation.type === 'drawText')).toMatchObject({
      text: `${DEFAULT_SONG.title} ${DEFAULT_SONG.artist}`,
      rect: { x: 10, y: 152, width: 300, height: 20 },
      fontSize: 20,
      fontWeight: 'bold',
      align: 'center'
    });
    expect(result.operations.some(operation => operation.type === 'drawText' && operation.text.includes('hidden'))).toBe(false);
  });

  it('does not render a false single-branch conditional', () => {
    const result = interpretWps(parseRockbox('%?mh<Locked>'), {
      ...options,
      sim: { ...DEFAULT_SIMULATION, isHold: false }
    });
    expect(result.operations.some(operation => operation.type === 'drawText')).toBe(false);
    expect(result.layers.find(layer => layer.kind === 'conditional')?.selectedBranch).toBeUndefined();
  });

  it('does not choose a branch for an unsupported conditional unless explicitly overridden', () => {
    const document = parseRockbox('%?zzFuture<Assumed true|Assumed false>');
    const conditional = document.nodes[0];
    if (conditional.kind !== 'conditional') throw new Error('Missing conditional');
    const automatic = interpretWps(document, options);
    expect(automatic.layers.find(layer => layer.kind === 'conditional')?.selectedBranch).toBeUndefined();
    expect(automatic.operations).toHaveLength(0);

    const forced = interpretWps(document, { ...options, branchOverrides: { [conditional.id]: 0 } });
    expect(forced.layers.find(layer => layer.kind === 'conditional')?.selectedBranch).toBe(0);
    expect(forced.layers.some(layer => layer.label.includes('Assumed true') && layer.active)).toBe(true);
  });

  it('uses compact xl frame counts and resolves progress image handles', () => {
    const result = interpretWps(parseRockbox([
      '%xl(P,PlayStatus.bmp,9)',
      '%xl(S,PlayerSlider.bmp)',
      '%xl(B,SliderBackdrop.bmp)',
      '%xd(P,%mp)',
      '%pb(0,20,100,14,Slider.bmp,slider,S,backdrop,B)'
    ].join('\n')), options);

    expect(result.operations.find(operation => operation.type === 'drawBitmap')).toMatchObject({
      assetPath: 'PlayStatus.bmp', frameCount: 9, frame: 1
    });
    expect(result.operations.find(operation => operation.type === 'drawProgress')).toMatchObject({
      image: 'Slider.bmp', slider: 'PlayerSlider.bmp', backdrop: 'SliderBackdrop.bmp'
    });
  });

  it('selects one timed subline instead of painting alternatives over each other', () => {
    const source = '%t(6)%ia;%t(6)%id;%t(0)';
    const first = interpretWps(parseRockbox(source), { ...options, sim: { ...DEFAULT_SIMULATION, sublineCycle: 1 } });
    const second = interpretWps(parseRockbox(source), { ...options, sim: { ...DEFAULT_SIMULATION, sublineCycle: 7 } });
    expect(first.operations.find(operation => operation.type === 'drawText')).toMatchObject({ text: DEFAULT_SONG.artist });
    expect(second.operations.find(operation => operation.type === 'drawText')).toMatchObject({ text: DEFAULT_SONG.album });
  });
});
