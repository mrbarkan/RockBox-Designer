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

  it('renders an Adwaitapod-style USB scene from SBS activity 21 and clips the firmware fallback', () => {
    const source = [
      '# USB comments remain source only',
      '%xl(NotificationIcon,NotificationIcons.bmp,4)',
      '%V(0,0,-,-,-)',
      '%?if(%cs, =, 21)<%VI(USB)%Vd(USB)>',
      '%Vi(USB,0,0,1,1,9)',
      '%Vl(USB,16,150,65,63,-)%xd(NotificationIcon,1)',
      '%Vl(USB,93,163,189,20,3)%Vf(ffffff)%alConnected to USB',
      '%Vl(USB,93,183,189,22,4)%Vf(ffffff)%alEject before disconnecting'
    ].join('\n');
    const document = parseRockbox(source);
    const result = interpretSkin(document, {
      ...options,
      screen: 'sbs',
      sim: { ...DEFAULT_SIMULATION, currentActivity: 21, isUsb: true, externalPower: true }
    });

    expect(serializeRockbox(document)).toBe(source);
    expect(result.layers.some(layer => /comment/i.test(layer.label))).toBe(false);
    expect(result.operations.some(operation => operation.type === 'drawBitmap' && operation.assetPath === 'NotificationIcons.bmp')).toBe(true);
    expect(result.operations.some(operation => operation.type === 'drawText' && operation.text === 'Connected to USB')).toBe(true);
    expect(result.operations.some(operation => operation.type === 'drawText' && operation.text === 'Eject before disconnecting')).toBe(true);
    expect(result.operations.find(operation => operation.type === 'drawFirmwareFallback')).toMatchObject({
      type: 'drawFirmwareFallback',
      feature: 'usb-logo',
      rect: { x: 0, y: 0, width: 1, height: 1 }
    });
    expect(result.layers.some(layer => layer.label.includes('menu list'))).toBe(false);
  });

  it('projects date, recording, sleep timer, and setting bars from deterministic state', () => {
    const source = [
      '%V(0,0,-,-,-)',
      '%?cu<Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday>',
      '%ca %cb %cd %cY',
      '%bs',
      '%?Re<WAV|AIFF|WavPack|MP3> %?Rf<96|88.2|64|48|44.1|32|24|22.05|16|12|11.025|8>',
      'rate=%Rf',
      '%Rh:%Rn:%Rs',
      '%St(0,20,100,8,-,setting,brightness)',
      '%pR(0,30,100,8,-)'
    ].join('\n');
    const result = interpretSkin(parseRockbox(source), {
      ...options,
      screen: 'sbs',
      sim: {
        ...DEFAULT_SIMULATION,
        currentActivity: 3,
        currentDate: '2026-07-17',
        sleepTimerSeconds: 305,
        brightness: 70,
        recordingFormat: 'wv',
        recordingFrequencyKhz: 44.1,
        recordingElapsedSeconds: 3723,
        recordingLevel: 0.62
      },
      settings: { ...options.settings, brightness: 70 }
    });
    const text = result.operations
      .filter(operation => operation.type === 'drawText')
      .map(operation => operation.text)
      .join(' ');
    const progress = result.operations.filter(operation => operation.type === 'drawProgress');

    expect(text).toContain('Friday');
    expect(text).toContain('Fri Jul 17 2026');
    expect(text).toContain('5:05');
    expect(text).toContain('WavPack 44.1');
    expect(text).toContain('rate=44.100');
    expect(text).toContain('01:62:03');
    expect(progress).toContainEqual(expect.objectContaining({ mode: 'setting', value: 0.7 }));
    expect(progress).toContainEqual(expect.objectContaining({ mode: 'recording', value: 0.62 }));
  });

  it('uses Rockbox one-based dynamic sprite selection and optional offsets', () => {
    const source = [
      '%xl(Sleep,Sleep.bmp,1)',
      '%xl(Home,Home.bmp,4)',
      '%V(0,0,-,-,-)',
      '%xd(Sleep,%bs)',
      '%xd(Home,%ps,2)'
    ].join('\n');
    const active = interpretSkin(parseRockbox(source), {
      ...options,
      sim: { ...DEFAULT_SIMULATION, sleepTimerSeconds: 60, shuffle: true }
    });
    const inactive = interpretSkin(parseRockbox(source), {
      ...options,
      sim: { ...DEFAULT_SIMULATION, sleepTimerSeconds: 0, shuffle: false }
    });

    expect(active.operations).toContainEqual(expect.objectContaining({ type: 'drawBitmap', assetPath: 'Sleep.bmp', frame: 0, frameCount: 1 }));
    expect(active.operations).toContainEqual(expect.objectContaining({ type: 'drawBitmap', assetPath: 'Home.bmp', frame: 2, frameCount: 4 }));
    expect(inactive.operations.some(operation => operation.type === 'drawBitmap' && operation.assetPath === 'Sleep.bmp')).toBe(false);
    expect(inactive.operations).toContainEqual(expect.objectContaining({ type: 'drawBitmap', assetPath: 'Home.bmp', frame: 3, frameCount: 4 }));
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
