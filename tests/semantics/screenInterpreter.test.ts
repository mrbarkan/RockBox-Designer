import { describe, expect, it } from 'vitest';
import { DEFAULT_SIMULATION, DEFAULT_SONG } from '../../constants';
import { interpretSkin } from '../../rockbox/semantics';
import { parseRockbox, serializeRockbox } from '../../rockbox/syntax';

const options = {
  width: 320,
  height: 240,
  defaultFont: '16-Cantarell-Regular.fnt',
  foreground: '#202020',
  background: '#f7f7f7',
  sim: DEFAULT_SIMULATION,
  song: DEFAULT_SONG,
  settings: {
    'selector color': '#d8d8d8',
    'selector text color': '#202020',
    'line selector': 'bar_color',
    scrollbar: 'right',
    'scrollbar width': 6,
    'show icons': false
  }
};

describe('Phase 3 screen interpreter', () => {
  it('projects the active SBS UI viewport as a menu without changing source', () => {
    const source = [
      '# menu source stays exact',
      '%V(0,0,-,-,-)',
      '%?if(%cs, =, 10)<%VI(Quick)|%VI(Menu)>',
      '%Vi(Menu,4,28,-4,-4,-)',
      '%Vi(Quick,20,40,-20,-40,-)'
    ].join('\n');
    const document = parseRockbox(source);
    const result = interpretSkin(document, { ...options, screen: 'sbs' });

    expect(serializeRockbox(document)).toBe(source);
    expect(result.screen).toBe('sbs');
    expect(result.layers.some(layer => layer.label.includes('Rockbox menu list in Menu'))).toBe(true);
    expect(result.operations.some(operation => operation.type === 'drawText' && operation.text === 'Now Playing')).toBe(true);
    expect(result.operations.some(operation => operation.type === 'drawRect' && operation.color === '#d8d8d8')).toBe(true);
  });

  it('uses Rockbox numeric playback and clock branches for two-way SBS conditionals', () => {
    const document = parseRockbox([
      '%V(0,0,-,-,-)',
      '%?mp<Stopped|Playing>',
      '%?cf<%cH:%cM|%cl:%cM %cP>'
    ].join('\n'));
    const result = interpretSkin(document, {
      ...options,
      screen: 'sbs',
      sim: { ...DEFAULT_SIMULATION, playStatus: 'play', currentTime: '16:25', clock12Hour: false }
    });
    const renderedText = result.operations
      .filter(operation => operation.type === 'drawText')
      .map(operation => operation.text)
      .join(' ');

    expect(renderedText).toContain('Playing');
    expect(renderedText).not.toContain('Stopped');
    expect(renderedText).toContain('16:25');
    expect(renderedText).not.toContain('PM');
  });

  it('uses Rockbox firmware icon IDs with the full themeable icon strip', () => {
    const document = parseRockbox('%V(0,0,-,-,-)\n%VI(Menu)\n%Vi(Menu,4,28,-4,-4,-)');
    const result = interpretSkin(document, {
      ...options,
      screen: 'sbs',
      settings: { ...options.settings, 'show icons': true, iconset: '/.rockbox/icons/theme.bmp' }
    });

    const firstMenuIcon = result.operations.find(operation =>
      operation.type === 'drawBitmap' && operation.assetPath === '/.rockbox/icons/theme.bmp'
    );
    expect(firstMenuIcon).toMatchObject({ type: 'drawBitmap', frame: DEFAULT_SIMULATION.menuIconIds[0], frameCount: 32 });
  });

  it('labels the firmware-controlled quick-screen layout instead of inventing a theme file', () => {
    const document = parseRockbox('%V(0,0,-,-,-)\n%VI(Quick)\n%Vi(Quick,10,20,-10,-20,-)');
    const result = interpretSkin(document, {
      ...options,
      screen: 'sbs',
      sim: { ...DEFAULT_SIMULATION, currentActivity: 10 }
    });

    expect(result.layers.some(layer => layer.label.includes('firmware controlled'))).toBe(true);
    expect(result.operations.some(operation => operation.type === 'drawText' && operation.text.includes('Brightness'))).toBe(true);
    expect(result.layers.some(layer => layer.label.includes('menu list'))).toBe(false);
  });

  it('renders FMS tuner, preset, RDS, stereo, and signal state', () => {
    const document = parseRockbox([
      '%V(0,0,-,-,-)',
      '%Tn',
      '%tf MHz',
      '%?ts<Stereo|Mono>',
      '%?tx<%ty - %tz|No RDS>',
      '%tr(10,100,200,8,-)'
    ].join('\n'));
    const result = interpretSkin(document, { ...options, screen: 'fms' });

    const renderedText = result.operations
      .filter(operation => operation.type === 'drawText')
      .map(operation => operation.text)
      .join(' ');
    expect(renderedText).toContain(DEFAULT_SIMULATION.fmPresetName);
    expect(renderedText).toContain(DEFAULT_SIMULATION.fmFrequency.toFixed(1));
    expect(renderedText).toContain('Stereo');
    expect(renderedText).toContain(DEFAULT_SIMULATION.fmRdsName);
    expect(result.operations.some(operation => operation.type === 'drawProgress' && operation.mode === 'signal')).toBe(true);
    expect(result.layers.some(layer => layer.label === 'FM signal bar')).toBe(true);
  });
});
