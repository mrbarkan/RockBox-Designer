import React, { useEffect, useMemo, useState } from 'react';
import type { ProjectSettings, ProjectState } from '../types';
import { deviceProfiles, getDeviceProfile, type DeviceProfileId } from '../rockbox/devices';
import { getCfgValues, parseCfg } from '../rockbox/packages';
import {
  commitThemeWorkspace,
  createThemeWorkspaceDraft,
  getProjectThemeConfig,
  inventoryThemeCfg,
  ROCKBOX_THEME_SOURCE_SHA,
  type ThemeWorkspaceDraft
} from '../rockbox/theme';
import { compileCfg } from '../services/rockboxCompiler';

type ThemeModeProps = {
  project: ProjectState;
  onProjectChange: (project: ProjectState) => void;
  onOpenAssets: () => void;
  onOpenFonts: () => void;
  onOpenPlay: () => void;
  onClose: () => void;
};

type ThemeTab = 'project' | 'appearance' | 'behavior' | 'cfg';

const inputClass = 'mt-1 w-full border-2 border-black bg-white px-3 py-2 font-mono text-[11px] outline-none focus:shadow-[3px_3px_0_#ff6b35]';
const labelClass = 'block font-mono text-[9px] font-black uppercase tracking-wider text-[#444]';

const Section = ({ eyebrow, title, children }: { eyebrow?: string; title: string; children: React.ReactNode }) => (
  <section className="border-2 border-black bg-[#f8f8f3] p-4 shadow-[5px_5px_0_#111]">
    {eyebrow ? <div className="font-mono text-[8px] font-black uppercase tracking-[0.25em] text-orange-700">{eyebrow}</div> : null}
    <h2 className="mt-1 font-mono text-[12px] font-black uppercase">{title}</h2>
    <div className="mt-4">{children}</div>
  </section>
);

const Capability = ({ label, available }: { label: string; available: boolean }) => (
  <span className={`border px-2 py-1 font-mono text-[8px] font-black uppercase ${available ? 'border-emerald-900 bg-[#20bd8b] text-black' : 'border-[#999] bg-[#ddd] text-[#666]'}`}>
    {available ? '✓' : '—'} {label}
  </span>
);

const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
  <label className={labelClass}>{label}
    <span className="mt-1 grid grid-cols-[44px_1fr]">
      <input aria-label={`${label} picker`} type="color" value={value} onChange={event => onChange(event.target.value)} className="h-[38px] w-11 cursor-pointer border-2 border-r-0 border-black bg-white p-1" />
      <input value={value} onChange={event => onChange(event.target.value)} className="border-2 border-black bg-white px-3 font-mono text-[11px] uppercase outline-none" />
    </span>
  </label>
);

const metadataFingerprint = (draft: ThemeWorkspaceDraft) => JSON.stringify({
  name: draft.name,
  author: draft.author,
  description: draft.description,
  target: draft.target,
  cfgPath: draft.cfgPath,
  rawCfg: draft.rawCfg,
  settings: draft.settings
});

export const ThemeMode: React.FC<ThemeModeProps> = ({ project, onProjectChange, onOpenAssets, onOpenFonts, onOpenPlay, onClose }) => {
  const source = compileCfg(project);
  const initialDraft = useMemo(() => createThemeWorkspaceDraft(project, source), [project, source]);
  const [draft, setDraft] = useState(initialDraft);
  const [tab, setTab] = useState<ThemeTab>('project');
  const [notice, setNotice] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => setDraft(initialDraft), [initialDraft]);

  const profile = getDeviceProfile(draft.target);
  const rawDocument = useMemo(() => parseCfg(draft.rawCfg), [draft.rawCfg]);
  const inventory = useMemo(() => inventoryThemeCfg(rawDocument), [rawDocument]);
  const config = getProjectThemeConfig(project, source);
  const dirty = metadataFingerprint(draft) !== metadataFingerprint(initialDraft);
  const packageAssets = (project.themePackage?.assets.length ?? 0) + (project.projectAssets?.length ?? 0) + (project.componentAssets?.length ?? 0);
  const packageDiagnostics = project.themePackage?.diagnostics ?? [];

  const updateSettings = <K extends keyof ProjectSettings>(key: K, value: ProjectSettings[K]) =>
    setDraft(current => ({ ...current, settings: { ...current.settings, [key]: value } }));

  const reset = () => {
    setDraft(initialDraft);
    setErrors([]);
    setNotice('Draft reset to the committed project.');
  };

  const commit = () => {
    const result = commitThemeWorkspace(project, source, draft);
    if (!result.ok) {
      setErrors(result.diagnostics.map(diagnostic => diagnostic.message));
      setNotice('');
      return;
    }
    onProjectChange(result.project);
    setErrors([]);
    const warning = result.diagnostics.find(diagnostic => diagnostic.severity === 'warning')?.message;
    setNotice(result.changed
      ? `${result.previewChanged ? 'Visual settings committed; preview updated.' : 'Project config committed without repainting the preview.'}${warning ? ` ${warning}` : ''}`
      : 'Nothing changed. The canonical project is already up to date.');
  };

  const tabs: Array<{ id: ThemeTab; label: string }> = [
    { id: 'project', label: '1 Project' },
    { id: 'appearance', label: '2 Appearance' },
    { id: 'behavior', label: '3 Behavior' },
    { id: 'cfg', label: '4 Source CFG' }
  ];

  return (
    <div className="fixed inset-0 z-[117] flex flex-col bg-[#c9c9c3] text-[#111]">
      <header className="flex min-h-16 shrink-0 flex-wrap items-center gap-4 border-b-2 border-black bg-[#242424] px-4 py-3 text-white">
        <div className="border-2 border-white bg-[#ff6b35] px-3 py-2 font-mono text-xl font-black text-black">T</div>
        <div>
          <div className="font-mono text-[9px] font-black uppercase tracking-[0.28em] text-orange-300">Pulp workspace · lossless project CFG</div>
          <h1 className="text-lg font-black uppercase tracking-wider">Theme</h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className={`border px-3 py-2 font-mono text-[9px] font-black uppercase ${dirty ? 'border-amber-300 bg-amber-950 text-amber-100' : 'border-emerald-300 bg-emerald-950 text-emerald-100'}`}>{dirty ? 'Draft changes' : 'Project synchronized'}</span>
          <button type="button" onClick={onOpenPlay} className="border-2 border-black bg-[#20bd8b] px-4 py-2 font-mono text-[10px] font-black uppercase text-black shadow-[3px_3px_0_#000]">▶ Play</button>
          <button type="button" disabled={!dirty} onClick={reset} className="border-2 border-white px-3 py-2 font-mono text-[10px] font-black uppercase disabled:opacity-30">Reset</button>
          <button type="button" onClick={commit} className="border-2 border-black bg-[#ffd23f] px-4 py-2 font-mono text-[10px] font-black uppercase text-black shadow-[3px_3px_0_#fff]">Commit project</button>
          <button type="button" onClick={onClose} className="border-2 border-white px-4 py-2 font-mono text-[10px] font-black uppercase hover:bg-white hover:text-black">Close</button>
        </div>
      </header>

      <nav aria-label="Theme workspace sections" className="grid shrink-0 grid-cols-2 border-b-2 border-black bg-[#ecece7] md:grid-cols-4">
        {tabs.map(item => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`border-r-2 border-black px-3 py-3 font-mono text-[10px] font-black uppercase ${tab === item.id ? 'bg-[#ffd23f]' : 'bg-white hover:bg-[#eee]'}`}>{item.label}</button>)}
      </nav>

      {notice ? <div role="status" className="shrink-0 border-b-2 border-emerald-900 bg-emerald-50 px-4 py-2 font-mono text-[10px] text-emerald-900">{notice}</div> : null}
      {errors.length ? <div role="alert" className="shrink-0 border-b-2 border-red-900 bg-red-50 px-4 py-2 font-mono text-[10px] text-red-900">{errors.join(' ')}</div> : null}

      <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        {tab === 'project' ? (
          <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-2">
            <Section eyebrow="Saved with the project" title="Theme metadata">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Theme name<input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} className={inputClass} /></label>
                <label className={labelClass}>Author<input value={draft.author} onChange={event => setDraft(current => ({ ...current, author: event.target.value }))} placeholder="Optional" className={inputClass} /></label>
                <label className={`${labelClass} sm:col-span-2`}>Description<textarea value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} placeholder="What makes this theme distinct?" className={`${inputClass} h-24 resize-y`} /></label>
              </div>
              <p className="mt-3 border border-[#999] bg-white p-2 font-mono text-[8px] text-[#666]">Metadata belongs to the Designer project. It is never invented as a Rockbox setting or injected into untouched source comments.</p>
            </Section>

            <Section eyebrow="Pinned target profile" title="Device">
              <label className={labelClass}>Target<select value={draft.target} onChange={event => setDraft(current => ({ ...current, target: event.target.value as DeviceProfileId }))} className={inputClass}>
                {deviceProfiles.map(device => <option key={device.id} value={device.id}>{device.manufacturer} {device.model} · {device.rockboxTarget}</option>)}
              </select></label>
              <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-center text-[9px]">
                <span className="border border-black bg-white p-2"><b className="block text-base">{profile.mainScreen.width}×{profile.mainScreen.height}</b>MAIN LCD</span>
                <span className="border border-black bg-white p-2"><b className="block text-base">{profile.mainScreen.depth}-bit</b>COLOR</span>
                <span className="border border-black bg-white p-2"><b className="block text-base">{profile.rockboxTarget}</b>TARGET</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1">
                <Capability label="Album art" available={profile.capabilities.albumArt} />
                <Capability label="FM" available={profile.capabilities.fmRadio} />
                <Capability label="Recording" available={profile.capabilities.recording} />
                <Capability label="Touch" available={profile.capabilities.touchscreen} />
                <Capability label="Remote LCD" available={profile.capabilities.remoteLcd} />
                <Capability label="USB HID" available={profile.capabilities.usbHid} />
              </div>
              {!profile.capabilities.fmRadio && project.fmsDocument ? <p className="mt-3 border-2 border-amber-900 bg-amber-50 p-2 font-mono text-[9px]">This target has no FM radio. FMS source remains preserved but is not available on the selected player.</p> : null}
              <p className="mt-3 font-mono text-[8px] text-[#666]">Profile evidence · Rockbox {profile.source.rockboxCommit.slice(0, 12)} · {profile.supportedScreenFiles.map(file => file.toUpperCase()).join(' / ')}</p>
            </Section>

            <Section eyebrow="What the ZIP will contain" title="Package files">
              <label className={labelClass}>CFG archive path<input value={draft.cfgPath} onChange={event => setDraft(current => ({ ...current, cfgPath: event.target.value }))} className={inputClass} /></label>
              <dl className="mt-4 divide-y divide-[#bbb] border border-black bg-white font-mono text-[9px]">
                <div className="grid grid-cols-[60px_1fr] gap-2 p-2"><dt className="font-black">WPS</dt><dd className="break-all">{getCfgValues(rawDocument, 'wps').at(-1) ?? 'Not configured'}</dd></div>
                <div className="grid grid-cols-[60px_1fr] gap-2 p-2"><dt className="font-black">SBS</dt><dd className="break-all">{getCfgValues(rawDocument, 'sbs').at(-1) ?? 'Not configured'}</dd></div>
                <div className="grid grid-cols-[60px_1fr] gap-2 p-2"><dt className="font-black">FMS</dt><dd className="break-all">{getCfgValues(rawDocument, 'fms').at(-1) ?? 'Not configured'}</dd></div>
              </dl>
              <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-center text-[9px]"><span className="border border-black bg-[#eee] p-2"><b className="block text-base">{packageAssets}</b>ASSETS</span><span className="border border-black bg-[#eee] p-2"><b className="block text-base">{project.themePackage?.manifest.files.length ?? 0}</b>IMPORTED</span><span className="border border-black bg-[#eee] p-2"><b className="block text-base">{packageDiagnostics.length}</b>WARNINGS</span></div>
              <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={onOpenAssets} className="border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black uppercase">Open assets</button><button type="button" onClick={() => setTab('cfg')} className="border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black uppercase">Edit package paths</button></div>
            </Section>

            <Section eyebrow="Honest target boundary" title="Compatibility summary">
              <p className="text-sm leading-relaxed">WPS, SBS, FMS, bitmap, font, and CFG source are preserved exactly. The browser provides a documented Level A projection; final firmware behavior remains external Level C.</p>
              <ul className="mt-3 space-y-2 font-mono text-[9px]">
                <li className="border-l-4 border-[#20bd8b] bg-white p-2">{profile.supportedScreenFiles.length} screen file types available on {profile.model}.</li>
                <li className="border-l-4 border-[#ffd23f] bg-white p-2">Unknown CFG settings: {inventory.unknownSettings}. They remain exact and editable in Source CFG.</li>
                <li className="border-l-4 border-[#8b5cf6] bg-white p-2">USB is an SBS activity state, not a separate theme file.</li>
                {packageDiagnostics.map(diagnostic => <li key={`${diagnostic.code}:${diagnostic.path ?? ''}`} className="border-l-4 border-red-700 bg-white p-2">{diagnostic.message}</li>)}
              </ul>
            </Section>
          </div>
        ) : null}

        {tab === 'appearance' ? (
          <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2">
            <Section eyebrow="Rockbox theme settings" title="Colors">
              <div className="grid gap-3 sm:grid-cols-2">
                <ColorField label="Background" value={draft.settings.backgroundColor} onChange={value => updateSettings('backgroundColor', value)} />
                <ColorField label="Foreground" value={draft.settings.foregroundColor} onChange={value => updateSettings('foregroundColor', value)} />
                <ColorField label="Selector start" value={draft.settings.selectorColor} onChange={value => updateSettings('selectorColor', value)} />
                <ColorField label="Selector end" value={draft.settings.lineSelectorEndColor ?? draft.settings.selectorColor} onChange={value => updateSettings('lineSelectorEndColor', value)} />
                <ColorField label="Selector text" value={draft.settings.selectorTextColor} onChange={value => updateSettings('selectorTextColor', value)} />
                <label className={labelClass}>Selector type<select value={draft.settings.lineSelectorType} onChange={event => updateSettings('lineSelectorType', event.target.value as ProjectSettings['lineSelectorType'])} className={inputClass}><option value="pointer">Pointer</option><option value="bar_inverse">Bar · inverse</option><option value="bar_color">Bar · color</option><option value="bar_gradient">Bar · gradient</option></select></label>
              </div>
            </Section>

            <Section eyebrow="References, not copied guesses" title="Fonts and image sets">
              <label className={labelClass}>UI font<input value={draft.settings.uiFont} onChange={event => updateSettings('uiFont', event.target.value)} className={inputClass} /></label>
              <button type="button" onClick={onOpenFonts} className="mt-2 w-full border-2 border-black bg-[#8b5cf6] px-3 py-2 font-mono text-[9px] font-black uppercase text-white shadow-[3px_3px_0_#111]">Inspect exact font bytes</button>
              <label className={`${labelClass} mt-4`}>Backdrop path / name<input value={draft.settings.backdrop ?? ''} onChange={event => updateSettings('backdrop', event.target.value || undefined)} placeholder="- means none" className={inputClass} /></label>
              <label className={`${labelClass} mt-3`}>Iconset<input value={draft.settings.iconset ?? ''} onChange={event => updateSettings('iconset', event.target.value || undefined)} placeholder="/.rockbox/icons/name.bmp" className={inputClass} /></label>
              <label className={`${labelClass} mt-3`}>Viewer iconset<input value={draft.settings.viewersIconset ?? ''} onChange={event => updateSettings('viewersIconset', event.target.value || undefined)} placeholder="/.rockbox/icons/name_viewers.bmp" className={inputClass} /></label>
              <p className="mt-3 border border-amber-900 bg-amber-50 p-2 font-mono text-[8px]">Changing a reference does not invent the asset. Use Assets or Fonts to verify that the exact package path exists.</p>
            </Section>
          </div>
        ) : null}

        {tab === 'behavior' ? (
          <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2">
            <Section eyebrow="Pinned settings_list.c values" title="Lists and status">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Status bar<select value={draft.settings.statusBarPosition ?? (draft.settings.statusBarTop ? 'top' : 'off')} onChange={event => setDraft(current => ({ ...current, settings: { ...current.settings, statusBarPosition: event.target.value as ProjectSettings['statusBarPosition'], statusBarTop: event.target.value === 'top' } }))} className={inputClass}><option value="off">Off</option><option value="top">Top</option><option value="bottom">Bottom</option></select></label>
                <label className={labelClass}>Scrollbar<select value={draft.settings.scrollbar} onChange={event => updateSettings('scrollbar', event.target.value as ProjectSettings['scrollbar'])} className={inputClass}><option value="off">Off</option><option value="left">Left</option><option value="right">Right</option></select></label>
                <label className={labelClass}>Scrollbar width<input type="number" min={3} max={32} value={draft.settings.scrollbarWidth} onChange={event => updateSettings('scrollbarWidth', Number(event.target.value))} className={inputClass} /></label>
                <label className={`${labelClass} flex items-end gap-2 pb-2`}><input type="checkbox" checked={draft.settings.showIcons} onChange={event => updateSettings('showIcons', event.target.checked)} className="h-5 w-5 accent-orange-600" /> Show icons</label>
                <label className={labelClass}>Volume display<select value={draft.settings.volumeDisplay} onChange={event => updateSettings('volumeDisplay', event.target.value as ProjectSettings['volumeDisplay'])} className={inputClass}><option value="graphic">Graphic</option><option value="numeric">Numeric</option></select></label>
                <label className={labelClass}>Battery display<select value={draft.settings.batteryDisplay} onChange={event => updateSettings('batteryDisplay', event.target.value as ProjectSettings['batteryDisplay'])} className={inputClass}><option value="graphic">Graphic</option><option value="numeric">Numeric</option></select></label>
              </div>
            </Section>

            <Section eyebrow="Device-wide behavior" title="Scroll and hold">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Scroll speed · 0–17<input type="number" min={0} max={17} value={draft.settings.scrollSpeed ?? 9} onChange={event => updateSettings('scrollSpeed', Number(event.target.value))} className={inputClass} /></label>
                <label className={labelClass}>Scroll delay · ms<input type="number" min={0} max={3000} step={100} value={draft.settings.scrollDelay ?? 1000} onChange={event => updateSettings('scrollDelay', Number(event.target.value))} className={inputClass} /></label>
                <label className={labelClass}>Scroll step · px<input type="number" min={1} max={profile.mainScreen.width} value={draft.settings.scrollStep ?? 6} onChange={event => updateSettings('scrollStep', Number(event.target.value))} className={inputClass} /></label>
                <label className={labelClass}>Backlight on hold<select value={draft.settings.backlightOnHold ?? 'normal'} onChange={event => updateSettings('backlightOnHold', event.target.value as ProjectSettings['backlightOnHold'])} className={inputClass}><option value="normal">Normal</option><option value="off">Off</option><option value="on">On</option></select></label>
              </div>
            </Section>

            <Section eyebrow="Standard Rockbox assignments" title="Quick screen">
              <div className="grid gap-3 sm:grid-cols-2">
                {([['qsTop', 'Top'], ['qsLeft', 'Left'], ['qsRight', 'Right'], ['qsBottom', 'Bottom']] as const).map(([key, label]) => <label key={key} className={labelClass}>{label}<input value={draft.settings[key] ?? ''} onChange={event => updateSettings(key, event.target.value || undefined)} placeholder="Rockbox setting name" className={inputClass} /></label>)}
              </div>
              <p className="mt-3 border border-[#999] bg-white p-2 font-mono text-[8px]">These are stock quick-screen assignments. A full custom quick-screen layout would require separately verified firmware work.</p>
            </Section>
          </div>
        ) : null}

        {tab === 'cfg' ? (
          <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <Section eyebrow="Authoritative source document" title="Source CFG">
              <textarea aria-label="Rockbox CFG source" value={draft.rawCfg} onChange={event => setDraft(current => ({ ...current, rawCfg: event.target.value }))} spellCheck={false} className="h-[58vh] min-h-[380px] w-full resize-y border-2 border-black bg-[#111] p-4 font-mono text-[12px] leading-relaxed text-[#eee] outline-none focus:shadow-[5px_5px_0_#ff6b35]" />
              <p className="mt-3 border border-[#777] bg-white p-2 font-mono text-[9px]">Comments, whitespace, duplicate keys, malformed lines, unknown settings, and line endings stay source-only and round-trip exactly. Typed controls update only the final matching known key.</p>
            </Section>
            <div className="space-y-5">
              <Section eyebrow="Projection, not elements" title="Raw inventory">
                <div className="grid grid-cols-2 gap-2 font-mono text-center text-[9px]">
                  <span className="border border-black bg-white p-2"><b className="block text-lg">{inventory.settings}</b>SETTINGS</span>
                  <span className="border border-black bg-white p-2"><b className="block text-lg">{inventory.comments}</b>COMMENTS</span>
                  <span className="border border-black bg-white p-2"><b className="block text-lg">{inventory.unknownSettings}</b>UNKNOWN</span>
                  <span className="border border-black bg-white p-2"><b className="block text-lg">{inventory.invalid}</b>RAW / INVALID</span>
                </div>
                <p className="mt-3 font-mono text-[9px]">Known projection: {inventory.knownSettings} · blank lines: {inventory.blanks} · total lines: {inventory.totalLines}</p>
                {inventory.duplicates.length ? <div className="mt-3 border border-amber-900 bg-amber-50 p-2 font-mono text-[8px]"><b className="block uppercase">Duplicate keys preserved</b>{inventory.duplicates.map(item => <span key={item.key} className="mt-1 block">{item.key} × {item.count}</span>)}</div> : null}
              </Section>
              <Section eyebrow="Canonical owner" title="Commit contract">
                <dl className="space-y-2 break-all font-mono text-[9px]"><div><dt className="text-[#777]">Origin</dt><dd>{config.origin}</dd></div><div><dt className="text-[#777]">Path</dt><dd>{draft.cfgPath}</dd></div><div><dt className="text-[#777]">Upstream evidence</dt><dd>{ROCKBOX_THEME_SOURCE_SHA.slice(0, 12)}</dd></div></dl>
                <p className="mt-3 text-[10px] leading-relaxed">Unknown-only and metadata-only commits update the project/package without repainting the canvas. Render-relevant settings update the shared preview once committed.</p>
              </Section>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};
