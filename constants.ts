import { SongMetadata, ProjectState, ElementType, SimulationState, FontDefinition } from './types';

export const IPOD_SCREEN_WIDTH = 320;
export const IPOD_SCREEN_HEIGHT = 240;

export const ROCKBOX_STANDARD_FONTS: Record<string, FontDefinition> = {
    'Nimbus': {
        family: 'Nimbus',
        sizes: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 28, 30, 32],
        type: 'sans'
    },
    'Terminus': {
        family: 'Terminus',
        sizes: [12, 14, 16, 20, 22, 24, 28, 32],
        type: 'mono'
    },
    'Unifont': {
        family: 'Unifont',
        sizes: [16],
        type: 'pixel'
    },
    'Sys-Proportional': {
        family: 'Sys-Proportional',
        sizes: [12],
        type: 'sans'
    },
    'Sys-Fixed': {
        family: 'Sys-Fixed',
        sizes: [12],
        type: 'mono'
    },
    'Sazanami-Mincho': {
        family: 'Sazanami-Mincho',
        sizes: [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48],
        type: 'serif'
    },
    'Sazanami-Gothic': {
        family: 'Sazanami-Gothic',
        sizes: [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48],
        type: 'sans'
    },
    'WenQuanYiBitmap': {
        family: 'WenQuanYiBitmap',
        sizes: [12, 13, 15, 16, 20, 24],
        type: 'sans'
    },
    'Adobe-Helvetica': {
        family: 'Adobe-Helvetica',
        sizes: [12, 14, 18, 20, 22, 24],
        type: 'sans'
    },
    'Rockfont': {
        family: 'Rockfont',
        sizes: [16, 20, 24, 28, 32],
        type: 'sans'
    }
};

export const DEFAULT_SONG: SongMetadata = {
  title: "Computer Love",
  artist: "Kraftwerk",
  album: "Computer World",
  trackNum: 3,
  totalTracks: 7,
  currentSec: 144,
  totalSec: 435,
  format: "FLAC",
  kbps: 986,
  albumArt: "https://upload.wikimedia.org/wikipedia/en/a/a6/Kraftwerk_-_Computer_World.png"
};

export const DEFAULT_SIMULATION: SimulationState = {
  batteryLevel: 85,
  volume: -20,
  isCharging: false,
  playStatus: 'play',
  currentTime: "12:45",
  shuffle: false,
  repeat: 'off'
};

export const DEFAULT_PROJECT: ProjectState = {
  settings: {
    name: "New Theme",
    target: "ipod_video",
    backgroundColor: "#111111",
    statusBarTop: true,
    foregroundColor: "#FFFFFF",
    selectorColor: "#ff5800",
    selectorTextColor: "#FFFFFF",
    uiFont: "14-Nimbus.fnt",
    
    // New Defaults
    showIcons: true,
    scrollbar: 'right',
    scrollbarWidth: 6,
    volumeDisplay: 'graphic',
    batteryDisplay: 'graphic',
    lineSelectorType: 'bar_color',
    lineSelectorEndColor: "#ff5800"
  },
  selectedElementIds: [],
  assets: {},
  elements: [
    // --- WPS ELEMENTS ---
    {
      id: 'bg-rect',
      name: 'Header Background',
      type: ElementType.RECT,
      screen: 'wps',
      x: 0, y: 0, width: 320, height: 24,
      visible: true, locked: true,
      color: "#333333"
    },
    {
      id: 'title-txt',
      name: 'Song Title',
      type: ElementType.TEXT,
      screen: 'wps',
      x: 10, y: 40, width: 300, height: 20,
      visible: true, locked: false,
      content: "%s",
      fontId: "14-Nimbus.fnt",
      align: "center",
      color: "#FFFFFF"
    },
    {
      id: 'artist-txt',
      name: 'Artist',
      type: ElementType.TEXT,
      screen: 'wps',
      x: 10, y: 65, width: 300, height: 18,
      visible: true, locked: false,
      content: "%a",
      fontId: "14-Nimbus.fnt",
      align: "center",
      color: "#AAAAAA"
    },
    {
      id: 'status-txt',
      name: 'Status Logic',
      type: ElementType.TEXT,
      screen: 'wps',
      x: 10, y: 150, width: 300, height: 18,
      visible: true, locked: false,
      content: "%?mp<Stop|Play|Pause>",
      fontId: "16-Terminus.fnt",
      align: "center",
      color: "#ff9900"
    },
    {
      id: 'pb',
      name: 'Progress Bar',
      type: ElementType.PROGRESS_BAR,
      screen: 'wps',
      x: 10, y: 200, width: 300, height: 10,
      visible: true, locked: false,
      foreColor: "#FFFFFF",
      backColor: "#444444"
    },
    // --- SBS ELEMENTS ---
    // Status Bar Area
    {
      id: 'sbs-status',
      name: 'Top Status Bar',
      type: ElementType.TEXT,
      screen: 'sbs',
      x: 5, y: 0, width: 310, height: 20,
      visible: true, locked: false,
      content: "%?mp<Stop|Play|Pause> %ac%cH:%cM %ar%bl%%",
      fontId: "14-Nimbus.fnt",
      align: "center",
      color: "#FFFFFF"
    },
    // Menu Viewport (%Vi)
    {
      id: 'sbs-viewport',
      name: 'Menu Viewport',
      type: ElementType.VIEWPORT,
      screen: 'sbs',
      x: 0, y: 24, width: 320, height: 216,
      visible: true, locked: false,
      // Viewport elements don't need color/content props on the element itself
      // as they are simulated based on global settings.
    } as any
  ]
};
