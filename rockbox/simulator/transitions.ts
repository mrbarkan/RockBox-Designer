import type { DeviceProfile } from '../devices';
import type {
  SimulatorAction,
  SimulatorSession
} from './types';

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const formatClock = (totalSeconds: number) => {
  const day = 24 * 60 * 60;
  const wrapped = ((totalSeconds % day) + day) % day;
  const hours = Math.floor(wrapped / 3600);
  const minutes = Math.floor((wrapped % 3600) / 60);
  const seconds = wrapped % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
};

const clockSeconds = (value: string) => {
  const [hours = 0, minutes = 0, seconds = 0] = value.split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 3600
    + (Number.isFinite(minutes) ? minutes : 0) * 60
    + (Number.isFinite(seconds) ? seconds : 0);
};

const trackCatalog = [
  {
    title: 'Computer Love',
    artist: 'Kraftwerk',
    album: 'Computer World',
    totalSec: 435,
    format: 'FLAC',
    kbps: 986
  },
  {
    title: 'Pocket Calculator',
    artist: 'Kraftwerk',
    album: 'Computer World',
    totalSec: 294,
    format: 'FLAC',
    kbps: 921
  },
  {
    title: 'Numbers',
    artist: 'Kraftwerk',
    album: 'Computer World',
    totalSec: 199,
    format: 'FLAC',
    kbps: 944
  }
] as const;

export const enforceTargetCapabilities = (
  session: SimulatorSession,
  profile: DeviceProfile
): SimulatorSession => {
  const simulation = { ...session.simulation };
  const song = { ...session.song };
  let activeScreen = session.activeScreen;
  let surface = session.surface;

  if (!profile.capabilities.fmRadio) {
    simulation.fmAvailable = false;
    simulation.fmTuned = false;
    simulation.fmScanMode = false;
    simulation.fmStereo = false;
    simulation.fmRdsAvailable = false;
    if (activeScreen === 'fms') activeScreen = 'wps';
  }
  if (!profile.capabilities.touchscreen) {
    simulation.touchActive = false;
    simulation.lastTouchAt = -10_000;
  }
  if (!profile.capabilities.remoteLcd || !profile.remoteScreen) surface = 'main';
  if (!profile.capabilities.albumArt) song.albumArt = undefined;

  return { simulation, song, activeScreen, surface };
};

const advance = (session: SimulatorSession, milliseconds: number): SimulatorSession => {
  const delta = Math.max(0, Math.round(milliseconds));
  if (delta === 0) return session;
  const previousSecond = Math.floor(session.simulation.timelineMs / 1000);
  const timelineMs = session.simulation.timelineMs + delta;
  const nextSecond = Math.floor(timelineMs / 1000);
  const elapsedSeconds = nextSecond - previousSecond;
  const simulation = {
    ...session.simulation,
    timelineMs,
    sublineCycle: timelineMs / 1000,
    currentTime: formatClock(clockSeconds(session.simulation.currentTime) + elapsedSeconds)
  };
  const song = { ...session.song };
  const rate = simulation.playStatus === 'play' ? 1
    : simulation.playStatus === 'ffwd' ? 5
      : simulation.playStatus === 'rew' ? -5
        : 0;
  if (rate !== 0 && elapsedSeconds > 0) {
    song.currentSec = clamp(song.currentSec + elapsedSeconds * rate, 0, song.totalSec);
  }
  if (simulation.touchActive && timelineMs - simulation.lastTouchAt >= 10_000) {
    simulation.touchActive = false;
  }
  return { ...session, simulation, song };
};

const changeTrack = (
  session: SimulatorSession,
  direction: 'next' | 'previous'
): SimulatorSession => {
  const catalogIndex = trackCatalog.findIndex(track =>
    track.title === session.song.title && track.artist === session.song.artist
  );
  const current = catalogIndex >= 0 ? catalogIndex : 0;
  const offset = direction === 'next' ? 1 : -1;
  const index = (current + offset + trackCatalog.length) % trackCatalog.length;
  const track = trackCatalog[index];
  return {
    ...session,
    simulation: { ...session.simulation, playStatus: 'play', diskActivity: true },
    song: {
      ...session.song,
      ...track,
      trackNum: index + 1,
      totalTracks: trackCatalog.length,
      currentSec: 0
    }
  };
};

export const transitionSimulator = (
  session: SimulatorSession,
  action: SimulatorAction,
  profile: DeviceProfile
): SimulatorSession => {
  let next = session;
  if (action.type === 'advance') {
    next = advance(session, action.milliseconds);
  } else if (action.type === 'playback') {
    next = {
      ...session,
      simulation: { ...session.simulation, playStatus: action.status },
      song: action.status === 'stop' ? { ...session.song, currentSec: 0 } : session.song
    };
  } else if (action.type === 'seek') {
    next = {
      ...session,
      song: { ...session.song, currentSec: clamp(Math.round(action.seconds), 0, session.song.totalSec) }
    };
  } else if (action.type === 'track') {
    next = changeTrack(session, action.direction);
  } else if (action.type === 'simulation') {
    next = { ...session, simulation: { ...session.simulation, ...action.updates } };
  } else if (action.type === 'song') {
    next = { ...session, song: { ...session.song, ...action.updates } };
  } else if (action.type === 'surface') {
    next = { ...session, surface: action.surface };
  } else if (action.type === 'touch') {
    if (profile.capabilities.touchscreen) {
      next = {
        ...session,
        simulation: {
          ...session.simulation,
          touchActive: true,
          touchX: Math.round(action.x),
          touchY: Math.round(action.y),
          lastTouchAt: session.simulation.timelineMs
        }
      };
    }
  } else if (action.type === 'shell') {
    const menuActive = session.activeScreen === 'sbs' && session.simulation.currentActivity === 1;
    if (action.control === 'previous' || action.control === 'next') {
      if (menuActive) {
        const offset = action.control === 'next' ? 1 : -1;
        next = {
          ...session,
          simulation: {
            ...session.simulation,
            menuSelectedIndex: clamp(
              session.simulation.menuSelectedIndex + offset,
              0,
              Math.max(0, session.simulation.menuItems.length - 1)
            )
          }
        };
      } else {
        next = changeTrack(session, action.control === 'next' ? 'next' : 'previous');
      }
    }
    else if (action.control === 'play-pause') {
      next = {
        ...session,
        simulation: {
          ...session.simulation,
          playStatus: session.simulation.playStatus === 'play' ? 'pause' : 'play'
        }
      };
    } else if (action.control === 'menu') {
      next = {
        ...session,
        activeScreen: 'sbs',
        simulation: { ...session.simulation, currentActivity: 1 }
      };
    } else if (action.control === 'select' && menuActive && session.simulation.menuSelectedIndex === 2) {
      next = {
        ...session,
        activeScreen: 'wps',
        simulation: { ...session.simulation, currentActivity: 2 }
      };
    }
  }
  return enforceTargetCapabilities(next, profile);
};
