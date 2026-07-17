import React, { useEffect, useMemo, useState } from 'react';
import type { ProjectState, SimulationState } from '../types';
import type { DeviceProfile } from '../rockbox/devices';
import { collectLogicConditions, logicConditionCounts, type LogicCondition } from '../rockbox/logic';
import type { BranchOverrides, SemanticResult, SkinScreen } from '../rockbox/semantics';
import type { SourceSpan } from '../rockbox/syntax';
import { getProjectSyntaxDocument } from '../services/rockboxSyntaxAdapter';

type MutationNotice = { ok: boolean; message: string };

type LogicModeProps = {
  project: ProjectState;
  profile: DeviceProfile;
  screen: SkinScreen;
  semanticResult?: SemanticResult | null;
  branchOverrides: BranchOverrides;
  simulation: SimulationState;
  onScreenChange: (screen: SkinScreen) => void;
  onSetBranchOverride: (nodeId: string, branch: number | null) => void;
  onSimulationChange: (updates: Partial<SimulationState>) => void;
  onDuplicateBranch: (nodeId: string, branchIndex: number) => MutationNotice;
  onRevealCanvas: (nodeId: string) => void;
  onRevealSource: (screen: SkinScreen, span: SourceSpan) => void;
  onOpenPlay: () => void;
  onClose: () => void;
};

const screenLabel: Record<SkinScreen, string> = { wps: 'Now Playing', sbs: 'System / USB', fms: 'FM Radio' };

const Toggle = ({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) => (
  <label className="flex cursor-pointer items-center justify-between border border-black bg-white px-3 py-2 font-mono text-[9px] font-black uppercase">
    {label}
    <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="h-4 w-4 accent-violet-600" />
  </label>
);

const conditionStatus = (condition: LogicCondition) => {
  if (!condition.targetAvailable) return { label: 'Unavailable on target', className: 'bg-red-100 text-red-900 border-red-800' };
  if (!condition.supportedByBrowser) return { label: 'Preserved source', className: 'bg-amber-100 text-amber-900 border-amber-800' };
  return { label: 'Live browser state', className: 'bg-emerald-100 text-emerald-900 border-emerald-800' };
};

export const LogicMode: React.FC<LogicModeProps> = ({
  project,
  profile,
  screen,
  semanticResult,
  branchOverrides,
  simulation,
  onScreenChange,
  onSetBranchOverride,
  onSimulationChange,
  onDuplicateBranch,
  onRevealCanvas,
  onRevealSource,
  onOpenPlay,
  onClose
}) => {
  const documents = useMemo(() => ({
    wps: getProjectSyntaxDocument(project, 'wps'),
    sbs: getProjectSyntaxDocument(project, 'sbs'),
    fms: getProjectSyntaxDocument(project, 'fms')
  }), [project.wpsDocument, project.wpsAst, project.sbsDocument, project.sbsAst, project.fmsDocument, project.fmsAst]);
  const counts = useMemo(() => logicConditionCounts(documents), [documents]);
  const conditions = useMemo(
    () => documents[screen] ? collectLogicConditions(documents[screen]!, profile) : [],
    [documents, screen, profile.id]
  );
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<MutationNotice | null>(null);
  const selected = conditions.find(condition => condition.nodeId === selectedNodeId) ?? conditions[0];
  const selectedLayer = selected
    ? semanticResult?.layers.find(layer => layer.kind === 'conditional' && layer.sourceNodeId === selected.nodeId)
    : undefined;
  const forcedBranch = selected ? branchOverrides[selected.nodeId] : undefined;
  const activeBranch = selectedLayer?.selectedBranch;
  const filtered = conditions.filter(condition => `${condition.label} ${condition.expression} ${condition.source}`.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!selected || !conditions.some(condition => condition.nodeId === selectedNodeId)) {
      setSelectedNodeId(conditions[0]?.nodeId ?? '');
    }
  }, [screen, conditions, selectedNodeId, selected]);

  useEffect(() => setNotice(null), [screen]);

  const duplicateBranch = (index: number) => {
    if (!selected) return;
    if (!window.confirm(`Duplicate “${selected.branches[index]?.label ?? `Branch ${index + 1}`}” at the end of this Rockbox conditional? This intentionally changes source behavior.`)) return;
    setNotice(onDuplicateBranch(selected.nodeId, index));
  };

  return (
    <div className="fixed inset-0 z-[119] flex flex-col bg-[#cacac4] text-[#111]">
      <header className="flex min-h-16 shrink-0 items-center gap-4 border-b-2 border-black bg-[#242424] px-4 py-3 text-white">
        <div className="border-2 border-white bg-[#ffd23f] px-3 py-2 font-mono text-xl font-black text-black">IF</div>
        <div>
          <div className="font-mono text-[9px] font-black uppercase tracking-[0.28em] text-yellow-300">Pulp workspace · lossless source logic</div>
          <h1 className="text-lg font-black uppercase tracking-wider">Logic</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden border border-white/40 px-3 py-2 font-mono text-[9px] font-black uppercase text-white/70 md:block">{profile.model}</span>
          <button type="button" onClick={onOpenPlay} className="border-2 border-black bg-[#20bd8b] px-4 py-2 font-mono text-[10px] font-black uppercase text-black shadow-[3px_3px_0_#000]">▶ Play</button>
          <button type="button" onClick={onClose} className="border-2 border-white px-4 py-2 font-mono text-[10px] font-black uppercase hover:bg-white hover:text-black">Close</button>
        </div>
      </header>

      <nav aria-label="Logic screen" className="grid shrink-0 grid-cols-3 border-b-2 border-black bg-white">
        {(['wps', 'sbs', 'fms'] as const).map(candidate => {
          const unavailable = candidate === 'fms' && !profile.capabilities.fmRadio;
          return <button key={candidate} type="button" disabled={unavailable} onClick={() => onScreenChange(candidate)} className={`border-r-2 border-black px-3 py-3 text-left font-mono text-[10px] font-black uppercase last:border-r-0 ${screen === candidate ? 'bg-[#ffd23f]' : 'bg-white'} disabled:bg-[#ddd] disabled:text-[#888]`}><span className="block">{candidate.toUpperCase()} · {counts[candidate]}</span><span className="mt-1 block text-[8px] font-normal normal-case opacity-60">{unavailable ? 'Unavailable on this target' : screenLabel[candidate]}</span></button>;
        })}
      </nav>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[310px_minmax(0,1fr)_310px]">
        <aside className="flex min-h-0 flex-col border-r-2 border-black bg-[#ecece7]">
          <div className="border-b border-black p-3"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="SEARCH CONDITIONS" className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-xs outline-none focus:shadow-[3px_3px_0_#8b5cf6]" /></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {filtered.length ? filtered.map(condition => {
              const status = conditionStatus(condition);
              const layer = semanticResult?.layers.find(candidate => candidate.kind === 'conditional' && candidate.sourceNodeId === condition.nodeId);
              return <button key={condition.nodeId} type="button" onClick={() => { setSelectedNodeId(condition.nodeId); setNotice(null); }} className={`mb-2 w-full border-2 p-3 text-left ${selected?.nodeId === condition.nodeId ? 'border-black bg-[#242424] text-white shadow-[4px_4px_0_#8b5cf6]' : 'border-[#aaa] bg-white hover:border-black'}`} style={{ paddingLeft: 12 + condition.depth * 16 }}><span className="block truncate font-mono text-[10px] font-black uppercase">{condition.label}</span><span className="mt-1 block truncate font-mono text-[9px] opacity-60">{condition.expression}</span><span className="mt-2 flex flex-wrap gap-1 font-mono text-[8px] font-black uppercase"><span className="border border-current px-1">{condition.branches.length} branches</span>{layer?.selectedBranch !== undefined ? <span className="bg-[#20bd8b] px-1 text-black">Active {layer.selectedBranch + 1}</span> : <span className="bg-[#ddd] px-1 text-black">No active branch</span>}<span className={`border px-1 ${selected?.nodeId === condition.nodeId ? 'border-white/60' : status.className}`}>{condition.supportedByBrowser ? 'live' : 'raw'}</span></span></button>;
            }) : <div className="border-2 border-dashed border-black bg-white p-5 text-center font-mono text-[10px] uppercase text-[#666]">{conditions.length ? 'No condition matches the search.' : `No conditionals in ${screen.toUpperCase()}. Source remains available.`}</div>}
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto bg-[#c9c9c3] p-4 md:p-6">
          {selected ? <div className="mx-auto max-w-4xl space-y-4">
            <section className="border-2 border-black bg-[#f7f7f2] p-5 shadow-[6px_6px_0_#111]">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-mono text-[9px] font-black uppercase tracking-[0.25em] text-violet-700">{screen.toUpperCase()} conditional</div><h2 className="mt-1 text-2xl font-black">{selected.label}</h2></div><span className={`border px-2 py-1 font-mono text-[9px] font-black uppercase ${conditionStatus(selected).className}`}>{conditionStatus(selected).label}</span></div>
              <div className="mt-4 border-2 border-black bg-[#202020] p-3 font-mono text-xs text-[#a7f3d0]">{selected.expression}</div>
              {!selected.supportedByBrowser ? <div className="mt-3 border border-amber-800 bg-amber-50 p-3 text-sm"><b className="block font-mono text-[9px] uppercase">Advanced source condition · preserved exactly</b><p className="mt-1 text-xs">The browser does not claim to evaluate this expression. Inspect or edit it in Source; forced branches below are preview-only.</p></div> : null}
              {!selected.targetAvailable ? <div className="mt-3 border border-red-800 bg-red-50 p-3 text-xs text-red-900">{selected.targetReason} The source remains untouched for another target.</div> : null}
            </section>

            <section className="border-2 border-black bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-mono text-[10px] font-black uppercase">Branch preview</h3><p className="mt-1 text-[10px] text-[#666]">Auto follows the shared simulator. A forced branch never rewrites source.</p></div><button type="button" onClick={() => onSetBranchOverride(selected.nodeId, null)} className={`border-2 border-black px-3 py-2 font-mono text-[9px] font-black uppercase ${forcedBranch === undefined ? 'bg-[#20bd8b]' : 'bg-white'}`}>Auto {forcedBranch === undefined && activeBranch !== undefined ? `· ${activeBranch + 1}` : ''}</button></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">{selected.branches.map(branch => {
                const active = activeBranch === branch.index;
                const forced = forcedBranch === branch.index;
                return <article key={branch.index} className={`border-2 p-3 ${active ? 'border-black bg-[#fff4c7] shadow-[4px_4px_0_#8b5cf6]' : 'border-[#aaa] bg-[#f5f5f0]'}`}><div className="flex items-start justify-between gap-2"><div><span className="font-mono text-[8px] font-black uppercase text-[#666]">Branch {branch.index + 1}</span><h4 className="font-black">{branch.label}</h4></div>{active ? <span className="bg-[#20bd8b] px-2 py-1 font-mono text-[8px] font-black uppercase">{forced ? 'Forced' : 'Active'}</span> : null}</div><p className="mt-3 min-h-8 break-words font-mono text-[9px] text-[#555]">{branch.summary}</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => onSetBranchOverride(selected.nodeId, branch.index)} className="border border-black bg-white px-2 py-2 font-mono text-[8px] font-black uppercase hover:bg-[#ffd23f]">Preview branch</button><button type="button" disabled={!selected.supportedByBrowser} onClick={() => duplicateBranch(branch.index)} className="border border-black bg-white px-2 py-2 font-mono text-[8px] font-black uppercase hover:bg-[#8b5cf6] hover:text-white disabled:cursor-not-allowed disabled:opacity-40">Duplicate in source</button></div></article>;
              })}</div>
            </section>

            <section className="border-2 border-black bg-white p-4"><h3 className="font-mono text-[10px] font-black uppercase">Exact source block</h3><pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap break-words border border-black bg-[#202020] p-3 font-mono text-[9px] text-white">{selected.source}</pre><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => onRevealCanvas(selected.nodeId)} className="border-2 border-black bg-[#ffd23f] px-3 py-2 font-mono text-[9px] font-black uppercase shadow-[2px_2px_0_#111]">Reveal on canvas</button><button type="button" onClick={() => onRevealSource(screen, selected.span)} className="border-2 border-black bg-[#8b5cf6] px-3 py-2 font-mono text-[9px] font-black uppercase text-white shadow-[2px_2px_0_#111]">Reveal in source</button></div></section>
            {notice ? <div role={notice.ok ? 'status' : 'alert'} className={`border-2 p-3 font-mono text-[9px] ${notice.ok ? 'border-emerald-800 bg-emerald-50 text-emerald-900' : 'border-red-900 bg-red-50 text-red-900'}`}>{notice.message}</div> : null}
          </div> : <div className="mx-auto max-w-xl border-2 border-dashed border-black bg-white p-8 text-center"><b className="font-mono uppercase">No conditional selected</b><p className="mt-2 text-sm text-[#666]">Use Source to add advanced Rockbox logic without inventing a visual rule.</p></div>}
        </main>

        <aside className="min-h-0 overflow-y-auto border-l-2 border-black bg-[#ecece7] p-4">
          <section className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_#111]"><h2 className="font-mono text-[10px] font-black uppercase">Shared simulator state</h2><p className="mt-2 text-[10px] leading-relaxed text-[#555]">These controls drive the same deterministic state as Screens and Play.</p><label className="mt-3 block font-mono text-[8px] font-black uppercase">Playback<select value={simulation.playStatus} onChange={event => onSimulationChange({ playStatus: event.target.value as SimulationState['playStatus'] })} className="mt-1 w-full border border-black bg-white p-2 text-[10px]"><option value="stop">Stopped</option><option value="play">Playing</option><option value="pause">Paused</option><option value="ffwd">Fast forward</option><option value="rew">Rewind</option></select></label><label className="mt-3 block font-mono text-[8px] font-black uppercase">Repeat<select value={simulation.repeat} onChange={event => onSimulationChange({ repeat: event.target.value as SimulationState['repeat'] })} className="mt-1 w-full border border-black bg-white p-2 text-[10px]"><option value="off">Off</option><option value="all">All</option><option value="one">One</option></select></label><div className="mt-3 grid gap-2"><Toggle label="Main hold" checked={simulation.isHold} onChange={isHold => onSimulationChange({ isHold })} /><Toggle label="Charging" checked={simulation.isCharging} onChange={isCharging => onSimulationChange({ isCharging })} /><Toggle label="External power" checked={simulation.externalPower} onChange={externalPower => onSimulationChange({ externalPower })} /><Toggle label="USB inserted" checked={simulation.isUsb} onChange={isUsb => onSimulationChange({ isUsb })} /><Toggle label="Shuffle" checked={simulation.shuffle} onChange={shuffle => onSimulationChange({ shuffle })} /><Toggle label="RTL language" checked={simulation.textDirection === 'rtl'} onChange={rtl => onSimulationChange({ textDirection: rtl ? 'rtl' : 'ltr' })} /></div><label className="mt-3 block font-mono text-[8px] font-black uppercase">Battery · {simulation.batteryLevel}%<input type="range" min={0} max={100} value={simulation.batteryLevel} onChange={event => onSimulationChange({ batteryLevel: Number(event.target.value) })} className="mt-1 w-full accent-violet-600" /></label><label className="mt-3 block font-mono text-[8px] font-black uppercase">Volume · {simulation.volume} dB<input type="range" min={-90} max={0} value={simulation.volume} onChange={event => onSimulationChange({ volume: Number(event.target.value), volumeLastChanged: simulation.timelineMs })} className="mt-1 w-full accent-violet-600" /></label></section>
          <section className="mt-4 border-t-2 border-black pt-4"><h3 className="font-mono text-[10px] font-black uppercase">Safety boundary</h3><p className="mt-2 text-[9px] leading-relaxed text-[#555]">Branch overrides are disposable preview state. Unknown, malformed, or future conditions stay exact. Source changes occur only through the explicit duplicate action or Source mode; the workspace never rewrites a complex condition into a simplified rule.</p></section>
        </aside>
      </div>
    </div>
  );
};
