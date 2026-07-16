import type { RockboxComponentDefinition } from './types';

const numeric = (key: string, label: string, defaultValue: number): RockboxComponentDefinition['editableProperties'][number] => ({
  key,
  label,
  type: 'number',
  defaultValue
});

const positioned = (width: number, height: number) => [
  numeric('x', 'X', 8),
  numeric('y', 'Y', 8),
  numeric('width', 'Width', width),
  numeric('height', 'Height', height)
];

const browserRule = {
  id: 'lossless-parse',
  description: 'Inserted source must parse without errors and retain exact surrounding source.',
  level: 'browser' as const
};

const officialRule = {
  id: 'checkwps',
  description: 'Generated source is checked against the pinned target-specific CheckWPS oracle.',
  level: 'official' as const
};

const textComponent = (
  definition: Omit<RockboxComponentDefinition, 'version' | 'assets' | 'editableProperties' | 'validationRules' | 'insertion' | 'sourceComplexity'> & {
    width?: number;
    height?: number;
    sourceComplexity?: RockboxComponentDefinition['sourceComplexity'];
  }
): RockboxComponentDefinition => ({
  ...definition,
  version: 1,
  assets: [],
  editableProperties: positioned(definition.width ?? 144, definition.height ?? 18),
  validationRules: [browserRule, officialRule],
  insertion: 'end',
  sourceComplexity: definition.sourceComplexity ?? 'simple'
});

const createBatteryStripBmp = () => {
  const width = 12;
  const frameHeight = 8;
  const frames = 10;
  const height = frameHeight * frames;
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelSize = rowSize * height;
  const bytes = new Uint8Array(54 + pixelSize);
  const view = new DataView(bytes.buffer);
  bytes[0] = 0x42;
  bytes[1] = 0x4d;
  view.setUint32(2, bytes.length, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, pixelSize, true);

  for (let frame = 0; frame < frames; frame += 1) {
    const filled = frame + 1;
    for (let y = 0; y < frameHeight; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const border = x === 0 || x === 10 || y === 0 || y === 7 || (x === 11 && y >= 3 && y <= 4);
        const fill = x >= 2 && x <= Math.min(9, 1 + filled) && y >= 2 && y <= 5;
        const value = border || fill ? 255 : 0;
        const logicalY = frame * frameHeight + y;
        const fileY = height - 1 - logicalY;
        const offset = 54 + fileY * rowSize + x * 3;
        bytes[offset] = value;
        bytes[offset + 1] = value;
        bytes[offset + 2] = value;
      }
    }
  }
  return bytes;
};

export const ROCKBOX_COMPONENT_CATALOG: RockboxComponentDefinition[] = [
  textComponent({
    id: 'battery-percentage',
    name: 'Battery percentage',
    description: 'A compact numeric battery readout.',
    category: 'battery',
    preview: '85%',
    supportedScreens: ['wps', 'sbs', 'fms'],
    requiredCapabilities: [],
    requiredTags: ['V', 'bl'],
    sourceTemplate: '%V({{x}},{{y}},{{width}},{{height}},-)\n%bl%%'
  }),
  {
    id: 'battery-ten-frame-strip',
    version: 1,
    name: 'Ten-frame battery strip',
    description: 'A source-linked bitmap strip driven by the battery level tag.',
    category: 'battery',
    preview: '▰▰▰▰▱',
    supportedScreens: ['wps', 'sbs', 'fms'],
    requiredCapabilities: [],
    requiredTags: ['xl', 'xd', 'bl'],
    sourceTemplate: '%xl({{handle}},{{assetPath}},{{x}},{{y}},10)\n%xd({{handle}},%bl)',
    assets: [{
      id: 'battery-strip',
      filename: 'rbd-battery-10.bmp',
      bytes: createBatteryStripBmp(),
      description: '12×80 24-bit BMP with ten 12×8 battery frames.'
    }],
    editableProperties: [numeric('x', 'X', 8), numeric('y', 'Y', 8)],
    validationRules: [browserRule, officialRule],
    insertion: 'start',
    sourceComplexity: 'composite'
  },
  textComponent({
    id: 'charging-state',
    name: 'Charging state',
    description: 'Shows a clear charging or battery label.',
    category: 'charging',
    preview: '⚡ CHARGING',
    supportedScreens: ['wps', 'sbs', 'fms'],
    requiredCapabilities: [],
    requiredTags: ['V', 'bc'],
    sourceTemplate: '%V({{x}},{{y}},{{width}},{{height}},-)\n%?bc<Charging|Battery>',
    sourceComplexity: 'conditional'
  }),
  textComponent({
    id: 'playback-state',
    name: 'Playback state',
    description: 'Displays stop, play, pause, and seek states.',
    category: 'playback',
    preview: '▶ PLAYING',
    supportedScreens: ['wps'],
    requiredCapabilities: [],
    requiredTags: ['V', 'mp'],
    sourceTemplate: '%V({{x}},{{y}},{{width}},{{height}},-)\n%?mp<Stopped|Playing|Paused|Seeking forward|Seeking back>',
    sourceComplexity: 'conditional'
  }),
  textComponent({
    id: 'shuffle-state',
    name: 'Shuffle state',
    description: 'Shows whether playlist shuffle is active.',
    category: 'shuffle',
    preview: '⇄ SHUFFLE',
    supportedScreens: ['wps'],
    requiredCapabilities: [],
    requiredTags: ['V', 'ps'],
    sourceTemplate: '%V({{x}},{{y}},{{width}},{{height}},-)\n%?ps<Shuffle|Sequential>',
    sourceComplexity: 'conditional'
  }),
  textComponent({
    id: 'repeat-state',
    name: 'Repeat state',
    description: 'Labels the active repeat mode.',
    category: 'repeat',
    preview: '↻ REPEAT',
    supportedScreens: ['wps'],
    requiredCapabilities: [],
    requiredTags: ['V', 'mm'],
    sourceTemplate: '%V({{x}},{{y}},{{width}},{{height}},-)\n%?mm<Repeat off|Repeat all|Repeat one>',
    sourceComplexity: 'conditional'
  }),
  textComponent({
    id: 'volume-db',
    name: 'Volume in decibels',
    description: 'Displays the current Rockbox volume value.',
    category: 'volume',
    preview: '−20 dB',
    supportedScreens: ['wps', 'sbs', 'fms'],
    requiredCapabilities: [],
    requiredTags: ['V', 'pv'],
    sourceTemplate: '%V({{x}},{{y}},{{width}},{{height}},-)\n%pv dB'
  }),
  textComponent({
    id: 'track-progress',
    name: 'Track progress bar',
    description: 'A native Rockbox progress bar.',
    category: 'progress',
    preview: '━━━━━━────',
    supportedScreens: ['wps'],
    requiredCapabilities: [],
    requiredTags: ['V', 'pb'],
    sourceTemplate: '%V({{x}},{{y}},{{width}},{{height}},-)\n%pb(0,0,{{width}},{{height}},-)',
    width: 220,
    height: 8
  }),
  textComponent({
    id: 'elapsed-total-time',
    name: 'Elapsed and total time',
    description: 'Pairs elapsed playback time with track length.',
    category: 'time',
    preview: '1:42 / 3:25',
    supportedScreens: ['wps'],
    requiredCapabilities: [],
    requiredTags: ['V', 'pc', 'pt'],
    sourceTemplate: '%V({{x}},{{y}},{{width}},{{height}},-)\n%pc / %pt'
  }),
  textComponent({
    id: 'metadata-stack',
    name: 'Metadata stack',
    description: 'Title, artist, and album in one source-linked viewport.',
    category: 'metadata',
    preview: 'TITLE\nARTIST\nALBUM',
    supportedScreens: ['wps'],
    requiredCapabilities: [],
    requiredTags: ['V', 'it', 'ia', 'id'],
    sourceTemplate: '%V({{x}},{{y}},{{width}},{{height}},-)\n%it\n%ia\n%id',
    width: 200,
    height: 54,
    sourceComplexity: 'composite'
  }),
  textComponent({
    id: 'album-art-square',
    name: 'Square album art',
    description: 'A centered square album-art region.',
    category: 'album-art',
    preview: '▣ ALBUM ART',
    supportedScreens: ['wps'],
    requiredCapabilities: ['albumArt'],
    requiredTags: ['Cl', 'Cd'],
    sourceTemplate: '%Cl({{x}},{{y}},{{width}},{{height}},c,c)\n%Cd',
    width: 120,
    height: 120,
    sourceComplexity: 'composite'
  }),
  textComponent({
    id: 'codec-bitrate',
    name: 'Codec and bitrate',
    description: 'Shows file codec and bitrate together.',
    category: 'codec',
    preview: 'FLAC · 986 kbps',
    supportedScreens: ['wps'],
    requiredCapabilities: [],
    requiredTags: ['V', 'fc', 'fb'],
    sourceTemplate: '%V({{x}},{{y}},{{width}},{{height}},-)\n%fc · %fb kbps'
  }),
  textComponent({
    id: 'playlist-position',
    name: 'Playlist position',
    description: 'Current item and total playlist entries.',
    category: 'playlist',
    preview: '1 OF 10',
    supportedScreens: ['wps'],
    requiredCapabilities: [],
    requiredTags: ['V', 'pp', 'pe'],
    sourceTemplate: '%V({{x}},{{y}},{{width}},{{height}},-)\n%pp of %pe'
  }),
  textComponent({
    id: 'next-track-title',
    name: 'Next track title',
    description: 'Displays metadata for the next playlist entry.',
    category: 'next-track',
    preview: 'NEXT · THE MODEL',
    supportedScreens: ['wps'],
    requiredCapabilities: [],
    requiredTags: ['V', 'It'],
    sourceTemplate: '%V({{x}},{{y}},{{width}},{{height}},-)\nNext: %It'
  }),
  textComponent({
    id: 'clock-24-hour',
    name: '24-hour clock',
    description: 'A zero-padded real-time clock.',
    category: 'clock',
    preview: '13:30',
    supportedScreens: ['wps', 'sbs', 'fms'],
    requiredCapabilities: ['rtc'],
    requiredTags: ['V', 'cH', 'cM'],
    sourceTemplate: '%V({{x}},{{y}},{{width}},{{height}},-)\n%cH:%cM'
  }),
  textComponent({
    id: 'status-cluster',
    name: 'Status cluster',
    description: 'Hold, battery, and volume in a compact conditional group.',
    category: 'status',
    preview: '🔒 85% −20 dB',
    supportedScreens: ['wps', 'sbs', 'fms'],
    requiredCapabilities: [],
    requiredTags: ['Vl', 'Vd', 'mh', 'bl', 'pv'],
    sourceTemplate: '%Vd({{viewport}})\n%Vl({{viewport}},{{x}},{{y}},{{width}},{{height}},-)\n%?mh<Hold |>%bl%% · %pv dB',
    sourceComplexity: 'composite'
  }),
  textComponent({
    id: 'touch-play-region',
    name: 'Touch play region',
    description: 'A target-gated touch region for the Rockbox play action.',
    category: 'touch',
    preview: 'TAP ▶',
    supportedScreens: ['wps'],
    requiredCapabilities: ['touchscreen'],
    requiredTags: ['T'],
    sourceTemplate: '%T({{x}},{{y}},{{width}},{{height}},play)',
    width: 80,
    height: 40
  }),
  textComponent({
    id: 'fm-station',
    name: 'FM station',
    description: 'Frequency, stereo state, and RDS station name.',
    category: 'fm',
    preview: '101.7 · STEREO',
    supportedScreens: ['fms'],
    supportedTargets: ['apple-ipod-video-5g'],
    requiredCapabilities: ['fmRadio'],
    requiredTags: ['V', 'tf', 'ts', 'tx', 'ty'],
    sourceTemplate: '%V({{x}},{{y}},{{width}},{{height}},-)\n%tf MHz\n%?ts<Stereo|Mono>\n%?tx<%ty|No RDS>',
    width: 180,
    height: 54,
    sourceComplexity: 'conditional'
  }),
  textComponent({
    id: 'menu-list-viewport',
    name: 'Firmware list viewport',
    description: 'Positions the firmware-owned list; it does not create menu rows.',
    category: 'list-menu',
    preview: 'FILES\nNOW PLAYING\nSETTINGS',
    supportedScreens: ['sbs'],
    requiredCapabilities: [],
    requiredTags: ['Vi'],
    sourceTemplate: '%Vi({{viewport}},{{x}},{{y}},{{width}},{{height}},-)',
    width: 304,
    height: 208
  })
];

export const getRockboxComponent = (id: string) =>
  ROCKBOX_COMPONENT_CATALOG.find(component => component.id === id);
