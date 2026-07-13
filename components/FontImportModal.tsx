import React, { useEffect, useId, useState } from 'react';
import type { RockboxFontMetrics } from '../types';
import { checkFontCompanion } from '../services/fontCompanion';
import type { FontCompanionHealth } from '../rockbox/fonts';

export type FontImportOptions = {
  pixelSize: number;
  startCharacter: number;
  limitCharacter: number;
};
export type FontImportResult = {
  filename: string;
  metrics: RockboxFontMetrics;
  converted: boolean;
  upstreamCommit?: string;
};

type FontImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File, options: FontImportOptions) => Promise<FontImportResult>;
};

type HelperState =
  | { kind: 'checking' }
  | { kind: 'ready'; health: FontCompanionHealth }
  | { kind: 'offline'; message: string };

const RANGE_PRESETS = {
  ascii: { label: 'Basic Latin', detail: '32–126 · compact', start: 32, limit: 126 },
  latin1: { label: 'Latin-1', detail: '32–255 · accents', start: 32, limit: 255 },
  unicode: { label: 'Broad Unicode', detail: '32–65535 · large', start: 32, limit: 65535 },
  custom: { label: 'Custom range', detail: 'Choose code points', start: 32, limit: 126 }
} as const;

type RangePreset = keyof typeof RANGE_PRESETS;

export const FontImportModal: React.FC<FontImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const fileInputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [pixelSize, setPixelSize] = useState(16);
  const [rangePreset, setRangePreset] = useState<RangePreset>('ascii');
  const [startCharacter, setStartCharacter] = useState(32);
  const [limitCharacter, setLimitCharacter] = useState(126);
  const [helper, setHelper] = useState<HelperState>({ kind: 'checking' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<FontImportResult | null>(null);

  const isRockboxFont = file?.name.toLowerCase().endsWith('.fnt') ?? false;
  const requiresHelper = Boolean(file && !isRockboxFont);

  const refreshHelper = async () => {
    setHelper({ kind: 'checking' });
    try {
      setHelper({ kind: 'ready', health: await checkFontCompanion() });
    } catch (caught) {
      setHelper({
        kind: 'offline',
        message: caught instanceof Error && caught.name !== 'AbortError'
          ? caught.message
          : 'The local font helper is not running.'
      });
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setFile(null);
    setBusy(false);
    setError('');
    setResult(null);
    void refreshHelper();
  }, [isOpen]);

  const selectRange = (preset: RangePreset) => {
    setRangePreset(preset);
    if (preset !== 'custom') {
      setStartCharacter(RANGE_PRESETS[preset].start);
      setLimitCharacter(RANGE_PRESETS[preset].limit);
    }
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await onImport(file, { pixelSize, startCharacter, limitCharacter }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Font import failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const conversionUnavailable = requiresHelper && helper.kind !== 'ready';
  const invalidRange = startCharacter < 0 || limitCharacter > 0x10ffff || startCharacter > limitCharacter;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="font-workshop-title">
      <button className="absolute inset-0 bg-black/60" aria-label="Close font workshop" onClick={() => !busy && onClose()} />
      <div className="relative z-10 w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#e7e7e3] border-2 border-black shadow-[14px_14px_0_rgba(0,0,0,0.75)]">
        <header className="bg-[#242424] text-white px-6 py-5 flex items-start justify-between border-b-2 border-black">
          <div>
            <div className="text-[10px] font-mono tracking-[0.28em] text-orange-400 uppercase mb-1">Local conversion desk</div>
            <h2 id="font-workshop-title" className="text-xl font-bold uppercase tracking-wider">Rockbox Font Workshop</h2>
          </div>
          <button onClick={() => !busy && onClose()} disabled={busy} className="text-3xl leading-none hover:text-orange-400 disabled:opacity-40" aria-label="Close">×</button>
        </header>

        <div className="p-6 space-y-5">
          <section className={`border-2 p-4 flex items-start gap-3 ${helper.kind === 'ready' ? 'border-emerald-800 bg-emerald-50' : helper.kind === 'offline' ? 'border-amber-700 bg-amber-50' : 'border-gray-500 bg-white'}`}>
            <div className={`mt-0.5 w-3 h-3 rounded-full shrink-0 ${helper.kind === 'ready' ? 'bg-emerald-600' : helper.kind === 'offline' ? 'bg-amber-500' : 'bg-gray-400 animate-pulse'}`} />
            <div className="min-w-0 flex-1">
              <div className="font-bold uppercase text-sm">
                {helper.kind === 'ready' ? 'Local helper connected' : helper.kind === 'offline' ? 'Local helper unavailable' : 'Checking local helper'}
              </div>
              <div className="text-xs font-mono text-gray-600 mt-1 break-words">
                {helper.kind === 'ready'
                  ? `Protocol 1 · Rockbox ${helper.health.upstreamCommit.slice(0, 12)} · ${helper.health.sourceConfigured ? 'source ready' : helper.health.autoProvision ? 'source downloads on first conversion' : 'source setup required'}`
                  : helper.kind === 'offline'
                    ? helper.message
                    : 'Connecting to 127.0.0.1…'}
              </div>
            </div>
            {helper.kind === 'offline' ? <button onClick={() => void refreshHelper()} className="px-3 py-2 border border-black bg-white font-bold uppercase text-xs shadow-[2px_2px_0_black] active:translate-y-px active:shadow-none">Retry</button> : null}
          </section>

          <section>
            <label htmlFor={fileInputId} className="block border-2 border-dashed border-gray-500 bg-white p-5 cursor-pointer hover:border-orange-600 transition-colors">
              <span className="block text-xs font-bold uppercase tracking-widest text-gray-500">Source file</span>
              <span className="block mt-2 text-lg font-bold break-all">{file?.name ?? 'Choose .fnt, .ttf, .otf, or .ttc'}</span>
              <span className="block mt-1 text-xs font-mono text-gray-500">Existing RB12 files stay byte-exact. Outline fonts are converted only on this computer.</span>
            </label>
            <input
              id={fileInputId}
              type="file"
              accept=".fnt,.ttf,.otf,.ttc"
              className="sr-only"
              onChange={event => {
                setFile(event.target.files?.[0] ?? null);
                setResult(null);
                setError('');
              }}
            />
          </section>

          {file && !isRockboxFont ? (
            <section className="grid md:grid-cols-[170px_1fr] gap-5 border-t-2 border-black/20 pt-5">
              <div>
                <label htmlFor="font-pixel-size" className="block text-xs font-bold uppercase tracking-widest mb-2">Pixel size</label>
                <div className="flex items-center border-2 border-black bg-white">
                  <input id="font-pixel-size" type="number" min={4} max={200} value={pixelSize} onChange={event => setPixelSize(Number(event.target.value))} className="w-full p-3 text-xl font-mono outline-none" />
                  <span className="pr-3 text-xs font-bold text-gray-500">PX</span>
                </div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-2">Glyph coverage</div>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(RANGE_PRESETS) as RangePreset[]).map(preset => (
                    <button key={preset} onClick={() => selectRange(preset)} className={`p-3 border text-left ${rangePreset === preset ? 'border-black bg-[#242424] text-white shadow-[3px_3px_0_#ef5b0c]' : 'border-gray-400 bg-white hover:border-black'}`}>
                      <span className="block text-xs font-bold uppercase">{RANGE_PRESETS[preset].label}</span>
                      <span className="block text-[10px] font-mono opacity-65 mt-1">{RANGE_PRESETS[preset].detail}</span>
                    </button>
                  ))}
                </div>
                {rangePreset === 'custom' ? (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <label className="text-[10px] font-bold uppercase">First code point<input type="number" min={0} max={0x10ffff} value={startCharacter} onChange={event => setStartCharacter(Number(event.target.value))} className="mt-1 block w-full border border-black bg-white p-2 font-mono text-sm" /></label>
                    <label className="text-[10px] font-bold uppercase">Last code point<input type="number" min={0} max={0x10ffff} value={limitCharacter} onChange={event => setLimitCharacter(Number(event.target.value))} className="mt-1 block w-full border border-black bg-white p-2 font-mono text-sm" /></label>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {error ? <div role="alert" className="border-2 border-red-800 bg-red-50 text-red-900 p-4 text-sm font-mono">{error}</div> : null}
          {result ? (
            <div className="border-2 border-emerald-800 bg-emerald-50 p-4">
              <div className="font-bold uppercase text-emerald-900">Font added to theme</div>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                <span>{result.filename}</span><span>{result.metrics.height}px high</span><span>{result.metrics.glyphCount} glyphs</span><span>{result.metrics.maxWidth}px max width</span>
              </div>
            </div>
          ) : null}

          <div className="bg-[#fff4c7] border border-amber-700 p-3 text-xs leading-relaxed">
            <strong>Font license:</strong> only distribute the generated `.fnt` when the source font license permits conversion and redistribution. The helper runs upstream GPL `convttf` locally; Rockbox code and your font never enter this browser bundle.
          </div>
        </div>

        <footer className="border-t-2 border-black bg-[#d4d4cf] p-5 flex items-center justify-between gap-3">
          <span className="text-[10px] font-mono text-gray-600">Output is validated as RB12 before it enters the package.</span>
          <div className="flex gap-3 shrink-0">
            <button onClick={onClose} disabled={busy} className="px-4 py-3 font-bold uppercase text-xs disabled:opacity-40">Cancel</button>
            <button
              onClick={() => void submit()}
              disabled={!file || busy || conversionUnavailable || invalidRange || pixelSize < 4 || pixelSize > 200 || Boolean(result)}
              className="px-5 py-3 bg-orange-600 text-white border-2 border-black font-bold uppercase text-xs shadow-[4px_4px_0_black] disabled:bg-gray-400 disabled:shadow-none active:translate-y-px active:shadow-none"
            >
              {busy ? 'Converting…' : isRockboxFont ? 'Add exact FNT' : result ? 'Added' : 'Convert & add'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
