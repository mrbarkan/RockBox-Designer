import React, { useEffect, useMemo, useState } from 'react';
import compatibilityReportData from '../reports/phase4-compatibility/latest.json';

type CompatibilityRow = {
  tag: string;
  token: string;
  category: string;
  deviceId: string;
  target: string;
  availableOnDevice: boolean;
  preserved: boolean;
  parsed: boolean;
  interpreted: boolean;
  rendered: boolean;
  editable: boolean;
  officiallyValidated: boolean;
  officialEvidence: string[];
  knownVisualDifferences: string[];
};

type CompatibilityReport = {
  upstream: { commit: string };
  supportCatalog: { registryTags: number; preservationIsNotSemanticSupport: boolean };
  devices: Array<{ id: string; label: string; target: string; supportedScreenFiles: string[] }>;
  summaryByDevice: Record<string, {
    tags: number;
    preserved: number;
    parsed: number;
    interpreted: number;
    rendered: number;
    editable: number;
    officiallyValidated: number;
    knownVisualDifference: number;
  }>;
  evidence: { renderComparison: { differingPixels: number; unclassifiedPixels: number; reproducible: boolean } };
  rows: CompatibilityRow[];
};

const report = compatibilityReportData as CompatibilityReport;
type Scope = 'all' | 'preview' | 'gaps' | 'differences';

const StatusCell = ({ value, label }: { value: boolean; label: string }) => (
  <td className={`px-2 py-2 text-center border-l border-gray-200 font-mono font-bold ${value ? 'text-emerald-800 bg-emerald-50/60' : 'text-gray-300'}`} aria-label={`${label}: ${value ? 'yes' : 'no'}`}>
    {value ? '✓' : '—'}
  </td>
);

export const CompatibilityDashboardModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initialDeviceId: string;
}> = ({ isOpen, onClose, initialDeviceId }) => {
  const availableInitial = report.devices.some(device => device.id === initialDeviceId)
    ? initialDeviceId
    : report.devices[0].id;
  const [deviceId, setDeviceId] = useState(availableInitial);
  const [scope, setScope] = useState<Scope>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen && report.devices.some(device => device.id === initialDeviceId)) setDeviceId(initialDeviceId);
  }, [initialDeviceId, isOpen]);

  const rows = useMemo(() => report.rows.filter(row => {
    if (row.deviceId !== deviceId) return false;
    const needle = query.trim().toLowerCase();
    if (needle && ![row.tag, row.token, row.category].some(value => value.toLowerCase().includes(needle))) return false;
    if (scope === 'preview') return row.rendered;
    if (scope === 'gaps') return !row.interpreted || !row.rendered || !row.editable || !row.officiallyValidated;
    if (scope === 'differences') return row.knownVisualDifferences.length > 0;
    return true;
  }), [deviceId, query, scope]);

  if (!isOpen) return null;
  const device = report.devices.find(candidate => candidate.id === deviceId) ?? report.devices[0];
  const summary = report.summaryByDevice[device.id];
  const scopes: Array<{ id: Scope; label: string }> = [
    { id: 'all', label: 'All tags' },
    { id: 'preview', label: 'Previewed' },
    { id: 'gaps', label: 'Gaps' },
    { id: 'differences', label: 'Pixel differences' }
  ];

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center p-3 md:p-6" role="dialog" aria-modal="true" aria-labelledby="compatibility-lab-title">
      <button className="absolute inset-0 bg-black/70" aria-label="Close compatibility lab" onClick={onClose} />
      <div className="relative z-10 w-full max-w-6xl h-[92vh] bg-[#ecece8] border-2 border-black shadow-[5px_5px_0_rgba(0,0,0,0.72)] flex flex-col overflow-hidden">
        <header className="bg-[#242424] text-white px-5 py-4 flex items-start justify-between border-b-2 border-black">
          <div>
            <div className="text-[10px] font-mono tracking-[0.28em] text-emerald-400 uppercase mb-1">Official evidence desk</div>
            <h2 id="compatibility-lab-title" className="text-xl font-bold uppercase tracking-wider">Compatibility Lab</h2>
            <p className="text-xs text-gray-400 font-mono mt-1">Rockbox {report.upstream.commit.slice(0, 12)} · preservation is tracked separately from preview support</p>
          </div>
          <button onClick={onClose} className="text-3xl leading-none hover:text-orange-400" aria-label="Close">×</button>
        </header>

        <div className="p-4 border-b-2 border-black/20 bg-[#d8d8d3] space-y-4">
          <div className="grid md:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto] gap-3">
            <label className="text-[10px] font-bold uppercase tracking-widest">Device
              <select value={deviceId} onChange={event => setDeviceId(event.target.value)} className="mt-1 block w-full p-2.5 border-2 border-black bg-white text-sm font-bold">
                {report.devices.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.label} · {candidate.target}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-widest">Find a tag
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tag, token, or category" className="mt-1 block w-full p-2.5 border-2 border-black bg-white text-sm font-mono" />
            </label>
            <div className="flex flex-wrap items-end gap-1.5">
              {scopes.map(option => <button key={option.id} onClick={() => setScope(option.id)} className={`px-3 py-2.5 border-2 border-black text-[10px] font-bold uppercase ${scope === option.id ? 'bg-black text-white shadow-[3px_3px_0_#ef5b0c]' : 'bg-white hover:bg-orange-50'}`}>{option.label}</button>)}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              ['Source safe', `${summary.preserved}/${summary.tags}`],
              ['Understood', `${summary.interpreted}/${summary.tags}`],
              ['Previewed', `${summary.rendered}/${summary.tags}`],
              ['Editable', `${summary.editable}/${summary.tags}`],
              ['Official evidence', `${summary.officiallyValidated}/${summary.tags}`]
            ].map(([label, value]) => <div key={label} className="bg-white border border-gray-400 p-3">
              <div className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">{label}</div>
              <div className="text-xl font-mono font-bold mt-1">{value}</div>
            </div>)}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto bg-white">
          <table className="w-full min-w-[980px] border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-[#2d2d2d] text-white uppercase text-[9px] tracking-wider">
              <tr>
                <th className="px-3 py-3 text-left">Tag</th><th className="px-3 py-3 text-left">Category</th><th className="px-2 py-3">Device</th>
                <th className="px-2 py-3">Safe</th><th className="px-2 py-3">Parsed</th><th className="px-2 py-3">Meaning</th><th className="px-2 py-3">Preview</th><th className="px-2 py-3">Edit</th><th className="px-2 py-3">Official</th><th className="px-3 py-3 text-left">Known difference</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => <tr key={`${row.deviceId}:${row.tag}`} className="border-b border-gray-200 hover:bg-orange-50/60">
                <td className="px-3 py-2.5 font-mono font-bold text-base">%{row.tag}<div className="text-[9px] font-normal text-gray-400 break-all">{row.token}</div></td>
                <td className="px-3 py-2.5 font-mono text-[10px] text-gray-600">{row.category}</td>
                <td className={`px-2 py-2 text-center font-bold ${row.availableOnDevice ? 'text-gray-700' : 'text-amber-700 bg-amber-50'}`}>{row.availableOnDevice ? '✓' : 'N/A'}</td>
                <StatusCell value={row.preserved} label="Preserved" /><StatusCell value={row.parsed} label="Parsed" />
                <StatusCell value={row.interpreted} label="Interpreted" /><StatusCell value={row.rendered} label="Rendered" />
                <StatusCell value={row.editable} label="Editable" /><StatusCell value={row.officiallyValidated} label="Officially validated" />
                <td className="px-3 py-2 text-[10px] font-mono text-amber-800 max-w-[230px]">{row.knownVisualDifferences.length ? row.knownVisualDifferences.join(', ') : '—'}</td>
              </tr>)}
            </tbody>
          </table>
          {rows.length === 0 ? <div className="p-12 text-center text-gray-500 font-mono">No tags match this view.</div> : null}
        </div>

        <footer className="border-t-2 border-black bg-[#d8d8d3] px-4 py-3 flex flex-wrap justify-between gap-2 text-[10px] font-mono text-gray-600">
          <span>{rows.length} rows · Screens: {device.supportedScreenFiles.join(', ').toUpperCase()}</span>
          <span>Simulator pixels: {report.evidence.renderComparison.differingPixels.toLocaleString()} classified · {report.evidence.renderComparison.unclassifiedPixels} unclassified · repeatable {report.evidence.renderComparison.reproducible ? 'yes' : 'no'}</span>
        </footer>
      </div>
    </div>
  );
};
