import type { DeviceCapabilities } from '../devices';
import type { ScreenType, SimulationState, SongMetadata } from '../../types';

export type SimulatorSurface = 'main' | 'remote';

export type SimulatorScenarioId =
  | 'normal-playback'
  | 'paused-low-battery'
  | 'stopped'
  | 'seeking-forward'
  | 'track-change'
  | 'charging-over-usb'
  | 'usb-connected'
  | 'volume-overlay'
  | 'missing-album-art'
  | 'long-scrolling-title'
  | 'fm-preset'
  | 'weak-fm-signal'
  | 'hold-active'
  | 'rtl-language'
  | 'touch-input'
  | 'remote-screen';

export type ActiveSimulatorScenario = SimulatorScenarioId | 'custom';

export type SimulatorScenario = {
  id: SimulatorScenarioId;
  name: string;
  description: string;
  activeScreen: ScreenType;
  surface?: SimulatorSurface;
  requiredCapabilities?: Array<keyof DeviceCapabilities>;
  simulation?: Partial<SimulationState>;
  song?: Partial<SongMetadata>;
};

export type SimulatorSession = {
  simulation: SimulationState;
  song: SongMetadata;
  activeScreen: ScreenType;
  surface: SimulatorSurface;
};

export type SimulatorAction =
  | { type: 'advance'; milliseconds: number }
  | { type: 'activity'; activity: number }
  | { type: 'playback'; status: SimulationState['playStatus'] }
  | { type: 'seek'; seconds: number }
  | { type: 'track'; direction: 'next' | 'previous' }
  | { type: 'simulation'; updates: Partial<SimulationState> }
  | { type: 'song'; updates: Partial<SongMetadata> }
  | { type: 'surface'; surface: SimulatorSurface }
  | { type: 'touch'; x: number; y: number }
  | { type: 'shell'; control: 'menu' | 'select' | 'previous' | 'next' | 'play-pause' };

export type ScenarioAvailability = {
  available: boolean;
  reason?: string;
};
