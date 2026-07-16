import { describe, expect, it } from 'vitest';
import { DEFAULT_SIMULATION, DEFAULT_SONG } from '../../constants';
import { getDeviceProfile } from '../../rockbox/devices';
import { interpretSkin } from '../../rockbox/semantics';
import {
  createScenarioSession,
  enforceTargetCapabilities,
  getSimulatorScenario,
  scenarioAvailability,
  scenarioFromSearch,
  scenarioShareUrl,
  simulatorScenarios,
  transitionSimulator
} from '../../rockbox/simulator';
import { parseRockbox } from '../../rockbox/syntax';

const video = getDeviceProfile('apple-ipod-video-5g');
const classic = getDeviceProfile('apple-ipod-classic-6g');

const renderedText = (
  source: string,
  session = createScenarioSession('normal-playback'),
  profile = video
) => interpretSkin(parseRockbox(source), {
  width: profile.mainScreen.width,
  height: profile.mainScreen.height,
  defaultFont: '14-Nimbus.fnt',
  foreground: '#ffffff',
  background: '#000000',
  sim: session.simulation,
  song: session.song,
  screen: session.activeScreen === 'usb' ? 'wps' : session.activeScreen,
  capabilities: profile.capabilities
}).operations
  .filter(operation => operation.type === 'drawText')
  .map(operation => operation.text)
  .join(' ');

describe('Phase 5 deterministic scenarios', () => {
  it('creates every preset deterministically and gives it a stable share link', () => {
    for (const scenario of simulatorScenarios) {
      expect(createScenarioSession(scenario.id)).toEqual(createScenarioSession(scenario.id));
      const link = scenarioShareUrl('https://designer.example/studio?project=demo', scenario.id);
      expect(new URL(link).searchParams.get('project')).toBe('demo');
      expect(scenarioFromSearch(new URL(link).search)).toBe(scenario.id);
    }
    expect(scenarioFromSearch('?play=not-a-scenario')).toBeNull();
  });

  it('honors target restrictions instead of offering unsupported simulations', () => {
    expect(scenarioAvailability(getSimulatorScenario('fm-preset'), video).available).toBe(true);
    expect(scenarioAvailability(getSimulatorScenario('fm-preset'), classic)).toEqual({
      available: false,
      reason: `${classic.model} does not expose FM radio.`
    });
    expect(scenarioAvailability(getSimulatorScenario('touch-input'), video).available).toBe(false);
    expect(scenarioAvailability(getSimulatorScenario('remote-screen'), video).available).toBe(false);

    const constrained = enforceTargetCapabilities(createScenarioSession('fm-preset'), classic);
    expect(constrained.activeScreen).toBe('wps');
    expect(constrained.simulation.fmAvailable).toBe(false);
    expect(constrained.simulation.fmRdsAvailable).toBe(false);
  });

  it('advances playback, seeking, tracks, RTC, and momentary state without wall-clock time', () => {
    const normal = createScenarioSession('normal-playback');
    const advanced = transitionSimulator(normal, { type: 'advance', milliseconds: 1_000 }, video);
    expect(advanced.simulation.timelineMs).toBe(1_000);
    expect(advanced.simulation.currentTime).toBe('13:30:01');
    expect(advanced.song.currentSec).toBe(normal.song.currentSec + 1);

    const paused = transitionSimulator(createScenarioSession('paused-low-battery'), { type: 'advance', milliseconds: 5_000 }, video);
    expect(paused.song.currentSec).toBe(DEFAULT_SONG.currentSec);

    const seeking = transitionSimulator(createScenarioSession('seeking-forward'), { type: 'advance', milliseconds: 2_000 }, video);
    expect(seeking.song.currentSec).toBe(DEFAULT_SONG.currentSec + 10);

    const changed = transitionSimulator(normal, { type: 'track', direction: 'next' }, video);
    expect(changed.song.title).toBe('Pocket Calculator');
    expect(changed.song.currentSec).toBe(0);
    expect(changed.simulation.diskActivity).toBe(true);

    const stopped = transitionSimulator(normal, { type: 'playback', status: 'stop' }, video);
    expect(stopped.song.currentSec).toBe(0);

    const menu = transitionSimulator(normal, { type: 'shell', control: 'menu' }, video);
    expect(menu.activeScreen).toBe('sbs');
    const menuMoved = transitionSimulator(menu, { type: 'shell', control: 'next' }, video);
    expect(menuMoved.simulation.menuSelectedIndex).toBe(DEFAULT_SIMULATION.menuSelectedIndex + 1);
    const nowPlaying = transitionSimulator(
      { ...menu, simulation: { ...menu.simulation, menuSelectedIndex: 2 } },
      { type: 'shell', control: 'select' },
      video
    );
    expect(nowPlaying.activeScreen).toBe('wps');
    expect(nowPlaying.simulation.currentActivity).toBe(2);
  });

  it('drives real Rockbox conditional branches for playback, power, USB, hold, art, RTL, RTC, FM, and touch', () => {
    const source = [
      '%?mp<STOP|PLAY|PAUSE|FFWD|REW>',
      '%?bc<CHARGING|NOT CHARGING>',
      '%?bp<POWER|NO POWER>',
      '%?bu<USB|NO USB>',
      '%?mh<HOLD|NO HOLD>',
      '%?C<ART|NO ART>',
      '%?Sr<RTL|LTR>',
      '%?cc<RTC|NO RTC>',
      '%?tp<FM|NO FM>'
    ].join('\n');

    expect(renderedText(source, createScenarioSession('charging-over-usb'))).toContain('PLAY CHARGING POWER USB');
    expect(renderedText(source, createScenarioSession('paused-low-battery'))).toContain('PAUSE NOT CHARGING NO POWER NO USB');
    expect(renderedText(source, createScenarioSession('hold-active'))).toContain('HOLD');
    expect(renderedText(source, createScenarioSession('missing-album-art'))).toContain('NO ART');
    expect(renderedText(source, createScenarioSession('rtl-language'))).toContain('RTL');
    expect(renderedText(source, createScenarioSession('normal-playback'), classic)).toContain('RTC NO FM');

    const touchProfile = {
      ...video,
      capabilities: { ...video.capabilities, touchscreen: true }
    };
    expect(renderedText('%?Tp<TOUCH TARGET|NO TOUCH>\n%?Tl(2)<RECENT TOUCH|OLD TOUCH>', createScenarioSession('touch-input'), touchProfile))
      .toContain('TOUCH TARGET RECENT TOUCH');
  });

  it('uses simulator time for the momentary volume branch', () => {
    const initial = createScenarioSession('volume-overlay');
    expect(renderedText('%?mv(2)<VISIBLE|HIDDEN>', initial)).toContain('VISIBLE');
    const expired = transitionSimulator(initial, { type: 'advance', milliseconds: 2_000 }, video);
    expect(renderedText('%?mv(2)<VISIBLE|HIDDEN>', expired)).toContain('HIDDEN');
    expect(DEFAULT_SIMULATION.timelineMs).toBe(0);
  });
});
