import { SongMetadata, ProjectState, ElementType, SimulationState } from './types';

export const IPOD_SCREEN_WIDTH = 320;
export const IPOD_SCREEN_HEIGHT = 240;

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
    statusBarTop: true
  },
  selectedElementIds: [],
  assets: {},
  elements: [
    {
      id: 'bg-rect',
      name: 'Header Background',
      type: ElementType.RECT,
      x: 0, y: 0, width: 320, height: 24,
      visible: true, locked: true,
      color: "#333333"
    },
    {
      id: 'title-txt',
      name: 'Song Title',
      type: ElementType.TEXT,
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
      x: 10, y: 200, width: 300, height: 10,
      visible: true, locked: false,
      foreColor: "#FFFFFF",
      backColor: "#444444"
    }
  ]
};
