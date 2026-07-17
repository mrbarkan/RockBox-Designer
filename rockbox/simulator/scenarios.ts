import { DEFAULT_SIMULATION, DEFAULT_SONG } from '../../constants';
import { canAuthorRemoteScreens, type DeviceProfile } from '../devices';
import type {
  ScenarioAvailability,
  SimulatorScenario,
  SimulatorScenarioId,
  SimulatorSession
} from './types';

export const simulatorScenarios: SimulatorScenario[] = [
  {
    id: 'normal-playback',
    name: 'Normal playback',
    description: 'Playing with typical metadata, album art, power, and clock state.',
    activeScreen: 'wps'
  },
  {
    id: 'paused-low-battery',
    name: 'Paused · low battery',
    description: 'Paused playback at 8% battery.',
    activeScreen: 'wps',
    simulation: { playStatus: 'pause', batteryLevel: 8 }
  },
  {
    id: 'stopped',
    name: 'Stopped',
    description: 'Stopped playback with elapsed time reset.',
    activeScreen: 'wps',
    simulation: { playStatus: 'stop' },
    song: { currentSec: 0 }
  },
  {
    id: 'seeking-forward',
    name: 'Seeking forward',
    description: 'Fast-forward playback state with deterministic seek motion.',
    activeScreen: 'wps',
    simulation: { playStatus: 'ffwd' }
  },
  {
    id: 'track-change',
    name: 'Track change',
    description: 'The next track with fresh metadata and disk activity.',
    activeScreen: 'wps',
    simulation: { diskActivity: true },
    song: {
      title: 'Pocket Calculator',
      artist: 'Kraftwerk',
      album: 'Computer World',
      trackNum: 2,
      currentSec: 0,
      totalSec: 294,
      format: 'FLAC',
      kbps: 921
    }
  },
  {
    id: 'charging-over-usb',
    name: 'Charging over USB',
    description: 'Charging, external power, and USB-inserted conditionals together.',
    activeScreen: 'wps',
    simulation: { batteryLevel: 64, isCharging: true, externalPower: true, isUsb: true }
  },
  {
    id: 'usb-connected',
    name: 'USB connected',
    description: 'Theme-authored SBS presentation at Rockbox USB activity 21, with the compiled fallback logo confined to the selected UI viewport.',
    activeScreen: 'usb',
    simulation: { currentActivity: 21, isUsb: true, externalPower: true }
  },
  {
    id: 'volume-overlay',
    name: 'Volume overlay',
    description: 'Momentary %mv state at -12 dB.',
    activeScreen: 'wps',
    simulation: { volume: -12, volumeLastChanged: 0 }
  },
  {
    id: 'missing-album-art',
    name: 'Missing album art',
    description: 'Album-art presence conditionals evaluate false.',
    activeScreen: 'wps',
    song: { albumArt: undefined }
  },
  {
    id: 'long-scrolling-title',
    name: 'Long scrolling title',
    description: 'Long metadata exercises viewport clipping and scrolling.',
    activeScreen: 'wps',
    song: {
      title: 'The Robots (Maximum Length Metadata Stress Test Edition)',
      artist: 'Kraftwerk — Die Mensch-Maschine',
      album: 'The Man-Machine / Die Mensch-Maschine'
    }
  },
  {
    id: 'fm-preset',
    name: 'FM preset',
    description: 'Tuned stereo preset with RDS data.',
    activeScreen: 'fms',
    requiredCapabilities: ['fmRadio'],
    simulation: {
      fmAvailable: true,
      fmFrequency: 101.7,
      fmPresetName: 'ROCK FM',
      fmSignalStrength: 78,
      fmStereo: true,
      fmTuned: true,
      fmScanMode: false,
      fmRdsAvailable: true,
      fmRdsName: 'ROCK FM',
      fmRdsText: 'Deterministic RDS preview'
    }
  },
  {
    id: 'weak-fm-signal',
    name: 'Weak FM signal',
    description: 'Untuned mono FM state with weak signal and no RDS.',
    activeScreen: 'fms',
    requiredCapabilities: ['fmRadio'],
    simulation: {
      fmAvailable: true,
      fmSignalStrength: 12,
      fmStereo: false,
      fmTuned: false,
      fmScanMode: true,
      fmRdsAvailable: false,
      fmRdsName: '',
      fmRdsText: ''
    }
  },
  {
    id: 'hold-active',
    name: 'Hold active',
    description: 'The main hold switch conditional evaluates true.',
    activeScreen: 'wps',
    simulation: { isHold: true }
  },
  {
    id: 'rtl-language',
    name: 'Right-to-left language',
    description: 'RTL language state with Arabic metadata; native bidi parity remains separately validated.',
    activeScreen: 'wps',
    simulation: { textDirection: 'rtl' },
    song: {
      title: 'الحب الإلكتروني',
      artist: 'كرافتفيرك',
      album: 'عالم الحاسوب'
    }
  },
  {
    id: 'touch-input',
    name: 'Touch input',
    description: 'A recent target-coordinate touch for %Tp and %Tl conditions.',
    activeScreen: 'wps',
    requiredCapabilities: ['touchscreen'],
    simulation: { touchActive: true, touchX: 160, touchY: 120, lastTouchAt: 0 }
  },
  {
    id: 'remote-screen',
    name: 'Remote display',
    description: 'Remote LCD simulation is available only when the target and source model expose remote screens.',
    activeScreen: 'wps',
    surface: 'remote',
    requiredCapabilities: ['remoteLcd']
  }
];

const scenariosById = new Map(simulatorScenarios.map(scenario => [scenario.id, scenario]));

export const isSimulatorScenarioId = (value: unknown): value is SimulatorScenarioId =>
  typeof value === 'string' && scenariosById.has(value as SimulatorScenarioId);

export const getSimulatorScenario = (id: SimulatorScenarioId) =>
  scenariosById.get(id)!;

export const scenarioAvailability = (
  scenario: SimulatorScenario,
  profile: DeviceProfile
): ScenarioAvailability => {
  const unavailableCapability = scenario.requiredCapabilities?.find(
    capability => !profile.capabilities[capability]
  );
  if (unavailableCapability) {
    const labels: Record<keyof DeviceProfile['capabilities'], string> = {
      touchscreen: 'touchscreen input',
      fmRadio: 'FM radio',
      recording: 'recording',
      remoteLcd: 'a remote LCD',
      usbHid: 'USB HID',
      rtc: 'an RTC',
      albumArt: 'album art'
    };
    return {
      available: false,
      reason: `${profile.model} does not expose ${labels[unavailableCapability]}.`
    };
  }
  if (scenario.surface === 'remote' && !canAuthorRemoteScreens(profile)) {
    return {
      available: false,
      reason: `${profile.model} has no verified remote-screen file support.`
    };
  }
  if (scenario.activeScreen === 'fms' && !profile.supportedScreenFiles.includes('fms')) {
    return {
      available: false,
      reason: `${profile.model} does not support an FMS file.`
    };
  }
  return { available: true };
};

export const createScenarioSession = (id: SimulatorScenarioId): SimulatorSession => {
  const scenario = getSimulatorScenario(id);
  return {
    simulation: {
      ...DEFAULT_SIMULATION,
      timelineMs: 0,
      currentTime: '13:30:00',
      volumeLastChanged: -10_000,
      lastTouchAt: -10_000,
      menuItems: [...DEFAULT_SIMULATION.menuItems],
      menuIconIds: [...DEFAULT_SIMULATION.menuIconIds],
      ...scenario.simulation
    },
    song: { ...DEFAULT_SONG, ...scenario.song },
    activeScreen: scenario.activeScreen,
    surface: scenario.surface ?? 'main'
  };
};
