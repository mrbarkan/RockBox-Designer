import React, { useState } from 'react';
import type { DeviceProfile } from '../rockbox/devices';
import {
  getSimulatorScenario,
  scenarioAvailability,
  scenarioShareUrl,
  simulatorScenarios,
  type ActiveSimulatorScenario,
  type SimulatorAction,
  type SimulatorScenarioId,
  type SimulatorSession
} from '../rockbox/simulator';
import type { ProjectState } from '../types';
import type { SemanticResult } from '../rockbox/semantics';
import { DeviceShell } from './DeviceShell';
import { EditorCanvas } from './EditorCanvas';

type PlayModeProps = {
  project: ProjectState;
  profile: DeviceProfile;
  session: SimulatorSession;
  activeScenario: ActiveSimulatorScenario;
  semanticResult: SemanticResult | null;
  onClose: () => void;
  onApplyScenario: (scenario: SimulatorScenarioId) => void;
  onAction: (action: SimulatorAction) => void;
};

const Toggle = ({
  label,
  checked,
  disabled = false,
  onChange
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onChange}
    className={`flex items-center justify-between border-2 border-black px-3 py-2 text-[10px] font-black uppercase disabled:cursor-not-allowed disabled:opacity-35 ${
      checked ? 'bg-orange-600 text-white' : 'bg-white hover:bg-[#fff4e8]'
    }`}
  >
    <span>{label}</span>
    <span aria-hidden="true">{checked ? '●' : '○'}</span>
  </button>
);

const secondsLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.max(0, seconds % 60)).padStart(2, '0')}`;

export const PlayMode: React.FC<PlayModeProps> = ({
  project,
  profile,
  session,
  activeScenario,
  semanticResult,
  onClose,
  onApplyScenario,
  onAction
}) => {
  const [shareStatus, setShareStatus] = useState('');
  const { simulation: sim, song } = session;
  const fmEnabled = profile.capabilities.fmRadio && profile.supportedScreenFiles.includes('fms');
  const remoteEnabled = profile.capabilities.remoteLcd && Boolean(profile.remoteScreen);
  const touchEnabled = profile.capabilities.touchscreen;

  const copyScenarioLink = async () => {
    if (activeScenario === 'custom') return;
    const link = scenarioShareUrl(window.location.href, activeScenario);
    try {
      await navigator.clipboard.writeText(link);
      setShareStatus('Scenario link copied');
    } catch {
      window.prompt('Copy scenario link', link);
      setShareStatus('Scenario link ready');
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#e7e7e7] text-[#171717]" role="dialog" aria-modal="true" aria-label="Play mode">
      <header className="flex min-h-16 items-center gap-4 border-b-2 border-black bg-[#242424] px-5 text-white">
        <button type="button" onClick={onClose} className="border-2 border-white px-3 py-2 text-xs font-black uppercase hover:bg-white hover:text-black">← Edit</button>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] font-black uppercase tracking-[0.25em] text-[#20bd8b]">Level A · Browser state simulator</div>
          <h1 className="truncate text-lg font-black uppercase tracking-wide">{project.settings.name} · Play</h1>
        </div>
        <label className="flex items-center gap-2 font-mono text-[10px] font-black uppercase">
          Scenario
          <select
            aria-label="Scenario"
            value={activeScenario}
            onChange={event => event.target.value !== 'custom' && onApplyScenario(event.target.value as SimulatorScenarioId)}
            className="max-w-64 border-2 border-white bg-black p-2 text-white"
          >
            {activeScenario === 'custom' && <option value="custom">Custom state</option>}
            {simulatorScenarios.map(scenario => {
              const availability = scenarioAvailability(scenario, profile);
              return <option key={scenario.id} value={scenario.id} disabled={!availability.available}>{scenario.name}{availability.available ? '' : ' — unavailable'}</option>;
            })}
          </select>
        </label>
        <button
          type="button"
          disabled={activeScenario === 'custom'}
          onClick={copyScenarioLink}
          className="border-2 border-white px-3 py-2 text-xs font-black uppercase disabled:opacity-35"
        >
          Copy scenario link
        </button>
        <span role="status" className="min-w-24 font-mono text-[9px] text-[#20bd8b]">{shareStatus}</span>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(390px,1fr)_minmax(520px,1.2fr)]">
        <main className="flex min-h-0 items-center justify-center overflow-auto border-r-2 border-black bg-[#3a3a3a] p-8">
          <DeviceShell
            model={profile.model}
            screenWidth={profile.mainScreen.width}
            screenHeight={profile.mainScreen.height}
            surface={session.surface}
            touchEnabled={touchEnabled}
            onTouch={(x, y) => onAction({ type: 'touch', x, y })}
            onControl={control => onAction({ type: 'shell', control })}
          >
            <EditorCanvas
              project={project}
              activeScreen={session.activeScreen}
              song={song}
              sim={sim}
              scale={1}
              showGrid={false}
              showGuides={false}
              debugMode={false}
              useAstPreview
              readOnly
              onSelectElement={() => undefined}
              onUpdateElement={() => undefined}
              semanticResult={semanticResult}
            />
          </DeviceShell>
        </main>

        <aside className="min-h-0 overflow-y-auto p-5 font-mono">
          <section className="mb-4 border-2 border-black bg-white p-4 shadow-[4px_4px_0_#111]">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.22em] text-[#666]">Active scenario</div>
                <h2 className="text-lg font-black uppercase">{activeScenario === 'custom' ? 'Custom state' : getSimulatorScenario(activeScenario).name}</h2>
                <p className="mt-1 max-w-2xl text-xs text-[#555]">{activeScenario === 'custom' ? 'Controls have changed the selected preset.' : getSimulatorScenario(activeScenario).description}</p>
              </div>
              <div className="grid shrink-0 grid-cols-2 gap-1 text-[9px] font-black uppercase">
                <span className={`border border-black px-2 py-1 ${fmEnabled ? 'bg-[#20bd8b]' : 'bg-[#ddd]'}`}>FM {fmEnabled ? 'yes' : 'no'}</span>
                <span className={`border border-black px-2 py-1 ${touchEnabled ? 'bg-[#20bd8b]' : 'bg-[#ddd]'}`}>Touch {touchEnabled ? 'yes' : 'no'}</span>
                <span className={`border border-black px-2 py-1 ${remoteEnabled ? 'bg-[#20bd8b]' : 'bg-[#ddd]'}`}>Remote {remoteEnabled ? 'yes' : 'no'}</span>
                <span className={`border border-black px-2 py-1 ${profile.capabilities.rtc ? 'bg-[#20bd8b]' : 'bg-[#ddd]'}`}>RTC {profile.capabilities.rtc ? 'yes' : 'no'}</span>
              </div>
            </div>
            <div className="border-t border-[#aaa] pt-3 text-[10px] text-[#555]">
              Browser state preview only. Official skin-engine validation remains Level B; the pinned external Rockbox simulator is Level C.
            </div>
          </section>

          <div className="grid grid-cols-2 gap-4">
            <section className="border-2 border-black bg-[#f7f7f7] p-4">
              <h3 className="mb-3 text-xs font-black uppercase tracking-widest">Playback</h3>
              <div className="mb-3 grid grid-cols-5 gap-1">
                {(['stop', 'play', 'pause', 'rew', 'ffwd'] as const).map(status => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => onAction({ type: 'playback', status })}
                    className={`border-2 border-black p-2 text-[9px] font-black uppercase ${sim.playStatus === status ? 'bg-orange-600 text-white' : 'bg-white'}`}
                  >
                    {status}
                  </button>
                ))}
              </div>
              <div className="mb-3 flex items-center gap-2">
                <button type="button" onClick={() => onAction({ type: 'track', direction: 'previous' })} className="border-2 border-black bg-white px-3 py-2 font-black">|◀</button>
                <input
                  aria-label="Elapsed time"
                  type="range"
                  min={0}
                  max={Math.max(1, song.totalSec)}
                  value={song.currentSec}
                  onChange={event => onAction({ type: 'seek', seconds: Number(event.target.value) })}
                  className="min-w-0 flex-1"
                />
                <button type="button" onClick={() => onAction({ type: 'track', direction: 'next' })} className="border-2 border-black bg-white px-3 py-2 font-black">▶|</button>
              </div>
              <div className="mb-3 flex justify-between text-[10px] font-black"><span>{secondsLabel(song.currentSec)}</span><span>{secondsLabel(song.totalSec)}</span></div>
              <label className="mb-3 block text-[9px] font-black uppercase">
                Volume {sim.volume} dB
                <input type="range" min={-60} max={0} value={sim.volume} onChange={event => onAction({ type: 'simulation', updates: { volume: Number(event.target.value) } })} className="mt-1 block w-full" />
              </label>
              <button type="button" onClick={() => onAction({ type: 'simulation', updates: { volumeLastChanged: sim.timelineMs } })} className="mb-3 w-full border-2 border-black bg-[#222] p-2 text-[10px] font-black uppercase text-white">Trigger volume overlay</button>
              <div className="grid grid-cols-2 gap-2">
                <Toggle label="Shuffle" checked={sim.shuffle} onChange={() => onAction({ type: 'simulation', updates: { shuffle: !sim.shuffle } })} />
                <label className="border-2 border-black bg-white px-3 py-2 text-[10px] font-black uppercase">
                  Repeat
                  <select value={sim.repeat} onChange={event => onAction({ type: 'simulation', updates: { repeat: event.target.value as typeof sim.repeat } })} className="ml-2 bg-transparent">
                    <option value="off">Off</option><option value="all">All</option><option value="one">One</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="border-2 border-black bg-[#f7f7f7] p-4">
              <h3 className="mb-3 text-xs font-black uppercase tracking-widest">Power & device</h3>
              <label className="mb-3 block text-[9px] font-black uppercase">
                Battery {sim.batteryLevel}%
                <input type="range" min={0} max={100} value={sim.batteryLevel} onChange={event => onAction({ type: 'simulation', updates: { batteryLevel: Number(event.target.value) } })} className="mt-1 block w-full" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Toggle label="Charging" checked={sim.isCharging} onChange={() => onAction({ type: 'simulation', updates: { isCharging: !sim.isCharging } })} />
                <Toggle label="External power" checked={sim.externalPower} onChange={() => onAction({ type: 'simulation', updates: { externalPower: !sim.externalPower } })} />
                <Toggle label="Hold" checked={sim.isHold} onChange={() => onAction({ type: 'simulation', updates: { isHold: !sim.isHold } })} />
                <Toggle label="USB inserted" checked={sim.isUsb} onChange={() => onAction({ type: 'simulation', updates: { isUsb: !sim.isUsb } })} />
                <Toggle label="Disk activity" checked={sim.diskActivity} onChange={() => onAction({ type: 'simulation', updates: { diskActivity: !sim.diskActivity } })} />
                <Toggle label="12-hour clock" checked={sim.clock12Hour} disabled={!profile.capabilities.rtc} onChange={() => onAction({ type: 'simulation', updates: { clock12Hour: !sim.clock12Hour } })} />
              </div>
              <label className="mt-3 block text-[9px] font-black uppercase">
                RTC
                <input aria-label="RTC time" type="time" step={1} disabled={!profile.capabilities.rtc} value={sim.currentTime} onChange={event => onAction({ type: 'simulation', updates: { currentTime: event.target.value } })} className="mt-1 w-full border-2 border-black bg-white p-2" />
              </label>
              <div className="mt-3 border border-[#999] bg-[#eee] p-2 text-[9px]">
                Touch: {touchEnabled ? `${sim.touchX}, ${sim.touchY}${sim.touchActive ? ' active' : ''}` : `unavailable on ${profile.model}`}
                <br />
                Remote: {remoteEnabled ? session.surface : `unavailable on ${profile.model}`}
              </div>
            </section>

            <section className="border-2 border-black bg-[#f7f7f7] p-4">
              <h3 className="mb-3 text-xs font-black uppercase tracking-widest">Track metadata</h3>
              {(['title', 'artist', 'album'] as const).map(field => (
                <label key={field} className="mb-2 block text-[9px] font-black uppercase">
                  {field}
                  <input value={song[field]} onChange={event => onAction({ type: 'song', updates: { [field]: event.target.value } })} className="mt-1 w-full border-2 border-black bg-white p-2 text-xs" />
                </label>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[9px] font-black uppercase">Track<input type="number" min={1} value={song.trackNum} onChange={event => onAction({ type: 'song', updates: { trackNum: Number(event.target.value) } })} className="mt-1 w-full border-2 border-black p-2" /></label>
                <label className="text-[9px] font-black uppercase">Duration<input type="number" min={1} value={song.totalSec} onChange={event => onAction({ type: 'song', updates: { totalSec: Number(event.target.value) } })} className="mt-1 w-full border-2 border-black p-2" /></label>
              </div>
              <Toggle
                label="Album art present"
                checked={Boolean(song.albumArt)}
                disabled={!profile.capabilities.albumArt}
                onChange={() => onAction({ type: 'song', updates: { albumArt: song.albumArt ? undefined : 'PLACEHOLDER' } })}
              />
              <div className="mt-2 flex gap-2">
                <Toggle label="RTL language" checked={sim.textDirection === 'rtl'} onChange={() => onAction({ type: 'simulation', updates: { textDirection: sim.textDirection === 'rtl' ? 'ltr' : 'rtl' } })} />
              </div>
            </section>

            <section className="border-2 border-black bg-[#f7f7f7] p-4">
              <h3 className="mb-3 text-xs font-black uppercase tracking-widest">FM & RDS</h3>
              {fmEnabled ? (
                <>
                  <label className="mb-2 block text-[9px] font-black uppercase">Frequency MHz<input type="number" step="0.1" value={sim.fmFrequency} onChange={event => onAction({ type: 'simulation', updates: { fmFrequency: Number(event.target.value) } })} className="mt-1 w-full border-2 border-black p-2" /></label>
                  <label className="mb-2 block text-[9px] font-black uppercase">Preset name<input value={sim.fmPresetName} onChange={event => onAction({ type: 'simulation', updates: { fmPresetName: event.target.value } })} className="mt-1 w-full border-2 border-black p-2 text-xs" /></label>
                  <label className="mb-2 block text-[9px] font-black uppercase">Signal {sim.fmSignalStrength}%<input type="range" min={0} max={100} value={sim.fmSignalStrength} onChange={event => onAction({ type: 'simulation', updates: { fmSignalStrength: Number(event.target.value) } })} className="mt-1 block w-full" /></label>
                  <div className="grid grid-cols-2 gap-2">
                    <Toggle label="Tuned" checked={sim.fmTuned} onChange={() => onAction({ type: 'simulation', updates: { fmTuned: !sim.fmTuned } })} />
                    <Toggle label="Stereo" checked={sim.fmStereo} onChange={() => onAction({ type: 'simulation', updates: { fmStereo: !sim.fmStereo } })} />
                    <Toggle label="Scanning" checked={sim.fmScanMode} onChange={() => onAction({ type: 'simulation', updates: { fmScanMode: !sim.fmScanMode } })} />
                    <Toggle label="RDS available" checked={sim.fmRdsAvailable} onChange={() => onAction({ type: 'simulation', updates: { fmRdsAvailable: !sim.fmRdsAvailable } })} />
                  </div>
                  <input aria-label="RDS name" value={sim.fmRdsName} onChange={event => onAction({ type: 'simulation', updates: { fmRdsName: event.target.value } })} className="mt-2 w-full border-2 border-black p-2 text-xs" />
                  <input aria-label="RDS text" value={sim.fmRdsText} onChange={event => onAction({ type: 'simulation', updates: { fmRdsText: event.target.value } })} className="mt-2 w-full border-2 border-black p-2 text-xs" />
                </>
              ) : (
                <div className="border-2 border-dashed border-[#777] bg-[#eee] p-4 text-xs">
                  FM and RDS are unavailable on {profile.model}. Source remains preserved, but this target cannot simulate an FMS.
                </div>
              )}
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
};
