import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectState } from '../types';
import { getDeviceProfile } from '../rockbox/devices';
import {
  ROCKBOX_FONT_CATALOG,
  ROCKBOX_FONT_SOURCE_SHA,
  collectProjectTextSamples,
  decodeRb12Font,
  defaultFontArchivePath,
  getRb12Glyph,
  listProjectFonts,
  measureRb12Text,
  setProjectUiFont,
  type Rb12Font,
  type RockboxFontCatalogEntry
} from '../rockbox/fonts';
import { addProjectAsset, deleteProjectAsset, renameProjectAsset, replaceProjectAsset } from '../rockbox/assets';
import { checkFontCompanion, convertFontWithCompanion } from '../services/fontCompanion';
import type { FontCompanionHealth } from '../rockbox/fonts';

type FontModeProps = {
  project: ProjectState;
  onProjectChange: (project: ProjectState) => void;
  onClose: () => void;
  onOpenPlay: () => void;
};

type HelperState =
  | { kind: 'checking' }
  | { kind: 'ready'; health: FontCompanionHealth }
  | { kind: 'offline'; message: string };

const codePointLabel = (codePoint: number) => `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
const bytesLabel = (bytes: number) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;

const paintGlyph = (context: CanvasRenderingContext2D, font: Rb12Font, codePoint: number, x: number, y: number) => {
  const glyph = getRb12Glyph(font, codePoint);
  const image = context.createImageData(glyph.width, glyph.height);
  for (let index = 0; index < glyph.alpha.length; index += 1) {
    image.data[index * 4] = 17;
    image.data[index * 4 + 1] = 17;
    image.data[index * 4 + 2] = 17;
    image.data[index * 4 + 3] = glyph.alpha[index];
  }
  context.putImageData(image, x, y);
  return glyph;
};

const GlyphCanvas = ({ font, codePoint }: { font: Rb12Font; codePoint: number }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const glyph = useMemo(() => getRb12Glyph(font, codePoint), [font, codePoint]);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    canvas.width = glyph.width;
    canvas.height = glyph.height;
    context.clearRect(0, 0, canvas.width, canvas.height);
    paintGlyph(context, font, codePoint, 0, 0);
  }, [font, codePoint, glyph.width, glyph.height]);
  return <canvas ref={ref} className="max-h-10 max-w-10 [image-rendering:pixelated]" style={{ width: glyph.width * 2, height: glyph.height * 2 }} />;
};

const TextCanvas = ({ font, text, deviceWidth }: { font: Rb12Font; text: string; deviceWidth: number }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const measurement = useMemo(() => measureRb12Text(font, text), [font, text]);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    canvas.width = Math.max(1, Math.min(deviceWidth, measurement.width));
    canvas.height = Math.max(1, measurement.height);
    context.fillStyle = '#f7f7f2';
    context.fillRect(0, 0, canvas.width, canvas.height);
    text.split(/\r\n|\r|\n/).forEach((line, lineIndex) => {
      let x = 0;
      for (const character of line) {
        const glyph = paintGlyph(context, font, character.codePointAt(0)!, x, lineIndex * font.metrics.height);
        if (!/\p{Mark}/u.test(character)) x += glyph.width;
        if (x >= canvas.width) break;
      }
    });
  }, [font, text, deviceWidth, measurement.width, measurement.height]);
  return (
    <div className="overflow-auto border-2 border-black bg-[#f7f7f2] p-3 shadow-[inset_0_0_0_1px_#bbb]">
      <canvas ref={ref} className="[image-rendering:pixelated]" style={{ width: Math.max(1, Math.min(deviceWidth, measurement.width)) * 2, height: measurement.height * 2 }} />
    </div>
  );
};

const catalogLabel = (entry: RockboxFontCatalogEntry) => `${entry.height}px · ${entry.variant === 'bold' ? 'bold' : entry.variant === 'regular' ? 'regular' : 'named variant'}`;

export const FontMode: React.FC<FontModeProps> = ({ project, onProjectChange, onClose, onOpenPlay }) => {
  const records = useMemo(() => listProjectFonts(project), [project]);
  const samples = useMemo(() => collectProjectTextSamples(project), [project.wpsDocument, project.sbsDocument, project.fmsDocument, project.settings.name]);
  const profile = getDeviceProfile(project.settings.target);
  const currentRecord = records.find(record => record.current);
  const initialKey = currentRecord ? `package:${currentRecord.asset.archivePath}` : `catalog:${project.settings.uiFont}`;
  const [tab, setTab] = useState<'package' | 'catalog'>(currentRecord ? 'package' : 'catalog');
  const [selectedKey, setSelectedKey] = useState(initialKey);
  const [query, setQuery] = useState('');
  const [previewText, setPreviewText] = useState(samples[0] ?? 'Rockbox Designer');
  const [glyphStart, setGlyphStart] = useState(32);
  const [renamePath, setRenamePath] = useState('');
  const [pixelSize, setPixelSize] = useState(16);
  const [range, setRange] = useState<'ascii' | 'latin1' | 'unicode'>('ascii');
  const [helper, setHelper] = useState<HelperState>({ kind: 'checking' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const importInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);

  const selectedRecord = selectedKey.startsWith('package:')
    ? records.find(record => `package:${record.asset.archivePath}` === selectedKey)
    : undefined;
  const selectedCatalog = selectedKey.startsWith('catalog:')
    ? ROCKBOX_FONT_CATALOG.find(entry => `catalog:${entry.filename}` === selectedKey)
    : undefined;
  const selectedFont = selectedRecord?.font;
  const measurement = useMemo(() => selectedFont ? measureRb12Text(selectedFont, previewText) : undefined, [selectedFont, previewText]);
  const comparisons = useMemo(() => records
    .filter(record => record.font)
    .map(record => ({ record, measurement: measureRb12Text(record.font!, previewText) })), [records, previewText]);
  const glyphEnd = selectedFont
    ? Math.min(selectedFont.metrics.firstCharacter + selectedFont.metrics.glyphCount, glyphStart + 48)
    : glyphStart;
  const glyphs = selectedFont ? Array.from({ length: Math.max(0, glyphEnd - glyphStart) }, (_, index) => glyphStart + index) : [];

  useEffect(() => {
    let active = true;
    checkFontCompanion().then(health => {
      if (active) setHelper({ kind: 'ready', health });
    }).catch(caught => {
      if (active) setHelper({ kind: 'offline', message: caught instanceof Error ? caught.message : 'The local font helper is not running.' });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (selectedRecord) setRenamePath(selectedRecord.asset.archivePath);
    if (selectedFont) setGlyphStart(Math.max(32, selectedFont.metrics.firstCharacter));
  }, [selectedKey]);

  const chooseRecord = (path: string) => {
    setTab('package');
    setSelectedKey(`package:${path}`);
    setNotice('');
    setError('');
  };

  const chooseCatalog = (filename: string) => {
    setTab('catalog');
    setSelectedKey(`catalog:${filename}`);
    setNotice('');
    setError('');
  };

  const applyResult = (result: { ok: boolean; project: ProjectState; message?: string; conflicts?: string[] }) => {
    if (!result.ok) {
      setError(result.message ?? result.conflicts?.join(' ') ?? 'Font operation failed.');
      return false;
    }
    onProjectChange(result.project);
    setError('');
    setNotice(result.message ?? 'Font operation completed.');
    return true;
  };

  const setCurrent = (filename: string) => applyResult(setProjectUiFont(project, filename));

  const importFile = async (file: File) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const direct = file.name.toLowerCase().endsWith('.fnt');
      if (!direct && helper.kind !== 'ready') throw new Error('Start the local font helper before converting TTF, OTF, or TTC files.');
      const preset = range === 'ascii' ? { startCharacter: 32, limitCharacter: 126 }
        : range === 'latin1' ? { startCharacter: 32, limitCharacter: 255 }
          : { startCharacter: 32, limitCharacter: 65535 };
      const converted = direct ? undefined : await convertFontWithCompanion({ file, pixelSize, ...preset });
      const filename = direct ? file.name : converted!.filename;
      const bytes = direct ? new Uint8Array(await file.arrayBuffer()) : converted!.bytes;
      decodeRb12Font(bytes);
      const path = defaultFontArchivePath(project, filename);
      const added = await addProjectAsset(project, path, bytes);
      if (!added.ok) {
        setError(`${added.conflicts.join(' ')} Select that package font and use Replace if you intend to overwrite it.`);
        return;
      }
      const selected = setProjectUiFont(added.project, filename);
      if (applyResult(selected)) chooseRecord(path);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Font import failed.');
    } finally {
      setBusy(false);
      if (importInput.current) importInput.current.value = '';
    }
  };

  const replaceFile = async (file: File) => {
    if (!selectedRecord) return;
    setBusy(true);
    setError('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      decodeRb12Font(bytes);
      applyResult(await replaceProjectAsset(project, selectedRecord.asset.archivePath, bytes));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Font replacement failed.');
    } finally {
      setBusy(false);
      if (replaceInput.current) replaceInput.current.value = '';
    }
  };

  const rename = async () => {
    if (!selectedRecord) return;
    const result = await renameProjectAsset(project, selectedRecord.asset.archivePath, renamePath);
    if (applyResult(result)) chooseRecord(renamePath);
  };

  const remove = () => {
    if (!selectedRecord) return;
    if (!window.confirm(`Delete ${selectedRecord.asset.basename}? Rockbox source references will block this operation.`)) return;
    const result = deleteProjectAsset(project, selectedRecord.asset.archivePath);
    if (applyResult(result)) setSelectedKey('');
  };

  const packageMatches = records.filter(record => `${record.asset.archivePath} ${record.asset.basename}`.toLowerCase().includes(query.toLowerCase()));
  const catalogMatches = ROCKBOX_FONT_CATALOG.filter(entry => `${entry.filename} ${entry.family}`.toLowerCase().includes(query.toLowerCase()));
  const packagedCatalogMatch = selectedCatalog && records.find(record => record.asset.basename.toLowerCase() === selectedCatalog.filename.toLowerCase());

  return (
    <div className="fixed inset-0 z-[118] flex flex-col bg-[#d8d8d2] text-[#111]">
      <header className="flex min-h-16 shrink-0 items-center gap-4 border-b-2 border-black bg-[#242424] px-4 py-3 text-white">
        <div className="border-2 border-white bg-[#8b5cf6] px-3 py-2 font-mono text-xl font-black text-black">Aa</div>
        <div>
          <div className="font-mono text-[9px] font-black uppercase tracking-[0.28em] text-violet-300">Pulp workspace · canonical RB12</div>
          <h1 className="text-lg font-black uppercase tracking-wider">Fonts</h1>
        </div>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <span className={`border px-3 py-2 font-mono text-[9px] font-black uppercase ${helper.kind === 'ready' ? 'border-emerald-300 bg-emerald-900 text-emerald-100' : 'border-amber-300 bg-amber-950 text-amber-100'}`}>
            {helper.kind === 'ready' ? 'Helper ready' : helper.kind === 'checking' ? 'Checking helper' : 'Helper offline'}
          </span>
          <button type="button" onClick={onOpenPlay} className="border-2 border-black bg-[#20bd8b] px-4 py-2 font-mono text-[10px] font-black uppercase text-black shadow-[3px_3px_0_#000]">▶ Play</button>
          <button type="button" onClick={onClose} className="border-2 border-white px-4 py-2 font-mono text-[10px] font-black uppercase hover:bg-white hover:text-black">Close</button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="flex min-h-0 flex-col border-r-2 border-black bg-[#ecece7]">
          <div className="grid grid-cols-2 border-b-2 border-black">
            <button type="button" onClick={() => setTab('package')} className={`px-3 py-3 font-mono text-[10px] font-black uppercase ${tab === 'package' ? 'bg-[#ffd23f]' : 'bg-white'}`}>Theme · {records.length}</button>
            <button type="button" onClick={() => setTab('catalog')} className={`border-l-2 border-black px-3 py-3 font-mono text-[10px] font-black uppercase ${tab === 'catalog' ? 'bg-[#ffd23f]' : 'bg-white'}`}>Font pack · {ROCKBOX_FONT_CATALOG.length}</button>
          </div>
          <div className="border-b border-black p-3">
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="SEARCH FONTS" className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-xs outline-none focus:shadow-[3px_3px_0_#8b5cf6]" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {tab === 'package' ? packageMatches.map(record => (
              <button key={record.asset.archivePath} type="button" onClick={() => chooseRecord(record.asset.archivePath)} className={`mb-2 w-full border-2 p-3 text-left ${selectedKey === `package:${record.asset.archivePath}` ? 'border-black bg-[#242424] text-white shadow-[4px_4px_0_#8b5cf6]' : 'border-[#aaa] bg-white hover:border-black'}`}>
                <span className="block truncate font-mono text-[11px] font-black">{record.asset.basename}</span>
                <span className="mt-1 block font-mono text-[9px] opacity-60">{record.font ? `${record.font.metrics.height}px · ${record.font.metrics.glyphCount} slots · ${bytesLabel(record.asset.bytes.length)}` : 'Invalid RB12'}</span>
                <span className="mt-2 flex gap-1 font-mono text-[8px] font-black uppercase">
                  {record.current ? <span className="bg-[#20bd8b] px-1 text-black">Current</span> : null}
                  <span className="border border-current px-1">{record.owner}</span>
                  <span className="border border-current px-1">{record.references.length} refs</span>
                </span>
              </button>
            )) : catalogMatches.map(entry => (
              <button key={entry.filename} type="button" onClick={() => chooseCatalog(entry.filename)} className={`mb-2 w-full border-2 p-3 text-left ${selectedKey === `catalog:${entry.filename}` ? 'border-black bg-[#242424] text-white shadow-[4px_4px_0_#8b5cf6]' : 'border-[#aaa] bg-white hover:border-black'}`}>
                <span className="block font-mono text-[11px] font-black">{entry.filename}</span>
                <span className="mt-1 block font-mono text-[9px] opacity-60">{catalogLabel(entry)}</span>
                {records.some(record => record.asset.basename.toLowerCase() === entry.filename.toLowerCase()) ? <span className="mt-2 inline-block bg-[#20bd8b] px-1 font-mono text-[8px] font-black uppercase">In theme</span> : null}
              </button>
            ))}
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto bg-[#c9c9c3] p-4 md:p-6">
          {selectedFont && selectedRecord ? (
            <div className="mx-auto max-w-4xl space-y-4">
              <section className="border-2 border-black bg-[#f7f7f2] p-4 shadow-[6px_6px_0_#111]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="font-mono text-[9px] font-black uppercase tracking-[0.25em] text-violet-700">Exact package bytes</div><h2 className="mt-1 break-all text-xl font-black">{selectedRecord.asset.basename}</h2></div>
                  <div className="grid grid-cols-3 gap-1 font-mono text-[9px] text-center">
                    <span className="border border-black bg-white p-2"><b className="block text-sm">{selectedFont.metrics.height}</b>HEIGHT</span>
                    <span className="border border-black bg-white p-2"><b className="block text-sm">{selectedFont.metrics.ascent}</b>ASCENT</span>
                    <span className="border border-black bg-white p-2"><b className="block text-sm">{selectedFont.metrics.maxWidth}</b>MAX W</span>
                  </div>
                </div>
                <label className="mt-4 block font-mono text-[9px] font-black uppercase">Preview string<input value={previewText} onChange={event => setPreviewText(event.target.value)} className="mt-2 block w-full border-2 border-black bg-white px-3 py-3 text-base outline-none focus:shadow-[3px_3px_0_#8b5cf6]" /></label>
                <div className="mt-3"><TextCanvas font={selectedFont} text={previewText} deviceWidth={profile.mainScreen.width} /></div>
                <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[9px] sm:grid-cols-4">
                  <span className="border border-black bg-white p-2"><b className="block text-sm">{measurement?.width ?? 0}px</b>metric width</span>
                  <span className="border border-black bg-white p-2"><b className="block text-sm">{measurement?.height ?? 0}px</b>line height</span>
                  <span className="border border-black bg-white p-2"><b className="block text-sm">{measurement?.outsideRange.length ?? 0}</b>outside range</span>
                  <span className="border border-black bg-white p-2"><b className="block text-sm">{bytesLabel(selectedFont.metrics.fileBytes)}</b>file bytes</span>
                </div>
                {measurement?.outsideRange.length ? <p className="mt-3 border border-amber-800 bg-amber-50 p-2 font-mono text-[9px]">Missing range: {measurement.outsideRange.map(codePointLabel).join(', ')} · Rockbox will use {codePointLabel(selectedFont.metrics.defaultCharacter)}.</p> : null}
                {measurement?.defaultGlyphAliases.length ? <p className="mt-2 border border-amber-800 bg-amber-50 p-2 font-mono text-[9px]">Probable converter fallbacks inside the declared range: {measurement.defaultGlyphAliases.map(codePointLabel).join(', ')}. RB12 stores no explicit coverage bit.</p> : null}
                {measurement?.hasComplexShaping ? <p className="mt-2 border border-violet-800 bg-violet-50 p-2 font-mono text-[9px]">Combining or right-to-left shaping needs the external Level C simulator for final placement; byte metrics and range checks above remain exact.</p> : null}
              </section>

              {samples.length ? <section className="border-2 border-black bg-white p-4"><h3 className="font-mono text-[10px] font-black uppercase">Strings found in this project</h3><div className="mt-3 flex flex-wrap gap-2">{samples.map(sample => <button key={sample} type="button" onClick={() => setPreviewText(sample)} className="max-w-full truncate border border-black bg-[#eee] px-2 py-1 font-mono text-[9px] hover:bg-[#ffd23f]">{sample}</button>)}</div></section> : null}

              <section className="border-2 border-black bg-white p-4">
                <div className="flex items-center justify-between gap-3"><h3 className="font-mono text-[10px] font-black uppercase">Glyph grid · {codePointLabel(glyphStart)}–{codePointLabel(Math.max(glyphStart, glyphEnd - 1))}</h3><div className="flex gap-1"><button type="button" onClick={() => setGlyphStart(Math.max(selectedFont.metrics.firstCharacter, glyphStart - 48))} className="border border-black px-2 py-1 font-mono text-[9px]">←</button><button type="button" onClick={() => setGlyphStart(Math.min(selectedFont.metrics.firstCharacter + selectedFont.metrics.glyphCount - 1, glyphStart + 48))} className="border border-black px-2 py-1 font-mono text-[9px]">→</button></div></div>
                <div className="mt-3 grid grid-cols-6 gap-1 sm:grid-cols-8 xl:grid-cols-12">{glyphs.map(codePoint => {
                  const glyph = getRb12Glyph(selectedFont, codePoint);
                  return <div key={codePoint} title={`${codePointLabel(codePoint)} · ${glyph.width}px${glyph.aliasesDefaultGlyph ? ' · default glyph alias' : ''}`} className={`flex h-16 flex-col items-center justify-center border bg-[#f7f7f2] ${glyph.aliasesDefaultGlyph ? 'border-amber-600' : 'border-[#bbb]'}`}><GlyphCanvas font={selectedFont} codePoint={codePoint} /><span className="mt-1 font-mono text-[7px] text-[#666]">{codePointLabel(codePoint)}</span></div>;
                })}</div>
              </section>

              {comparisons.length > 1 ? <section className="border-2 border-black bg-white p-4"><h3 className="font-mono text-[10px] font-black uppercase">Compare packaged fonts · same string</h3><div className="mt-3 space-y-2">{comparisons.map(item => <button key={item.record.asset.archivePath} type="button" onClick={() => chooseRecord(item.record.asset.archivePath)} className="grid w-full grid-cols-[1fr_auto_auto] gap-3 border-b border-[#bbb] py-2 text-left font-mono text-[9px]"><span className="truncate font-black">{item.record.asset.basename}</span><span>{item.measurement.width}px</span><span>{item.record.font!.metrics.height}px high</span></button>)}</div></section> : null}
            </div>
          ) : selectedRecord?.error ? <div className="mx-auto max-w-2xl border-2 border-red-900 bg-red-50 p-5 font-mono text-sm text-red-900 shadow-[6px_6px_0_#111]"><b className="block uppercase">Rockbox cannot load this font</b><span className="mt-2 block">{selectedRecord.error}</span><span className="mt-3 block text-xs">The bytes remain preserved. Replace them explicitly; the workspace will not normalize or discard the file.</span></div>
          : selectedCatalog ? <div className="mx-auto max-w-2xl border-2 border-black bg-[#f7f7f2] p-6 shadow-[7px_7px_0_#111]"><div className="font-mono text-[9px] font-black uppercase tracking-[0.25em] text-violet-700">Separate official font package</div><h2 className="mt-2 text-2xl font-black">{selectedCatalog.filename}</h2><div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[10px]"><span className="border border-black bg-white p-3"><b className="block text-base">{selectedCatalog.height}px</b>filename height</span><span className="border border-black bg-white p-3"><b className="block text-base">{selectedCatalog.variant}</b>variant</span></div><p className="mt-4 text-sm leading-relaxed">This name is source-verified in Rockbox’s font collection, but the BDF/FNT bytes and their licenses are not bundled into Rockbox Designer. Install the separate Rockbox fonts package on the player, or import the actual FNT into this theme for a self-contained package and pixel preview.</p>{packagedCatalogMatch ? <button type="button" onClick={() => chooseRecord(packagedCatalogMatch.asset.archivePath)} className="mt-5 border-2 border-black bg-[#20bd8b] px-4 py-3 font-mono text-[10px] font-black uppercase shadow-[3px_3px_0_#111]">Open packaged copy</button> : <button type="button" onClick={() => setCurrent(selectedCatalog.filename)} className="mt-5 border-2 border-black bg-[#ffd23f] px-4 py-3 font-mono text-[10px] font-black uppercase shadow-[3px_3px_0_#111]">Reference installed font pack</button>}<p className="mt-5 font-mono text-[8px] text-[#666]">Catalog: {ROCKBOX_FONT_CATALOG.length} names · upstream {ROCKBOX_FONT_SOURCE_SHA.slice(0, 12)} · metadata only</p></div>
          : <div className="mx-auto max-w-xl border-2 border-dashed border-black bg-white p-8 text-center"><b className="font-mono uppercase">Choose a package font or Rockbox font-pack entry</b><p className="mt-2 text-sm text-[#666]">Import an exact FNT or convert an outline font locally to begin.</p></div>}
        </main>

        <aside className="min-h-0 overflow-y-auto border-l-2 border-black bg-[#ecece7] p-4">
          <section className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_#111]"><h2 className="font-mono text-[10px] font-black uppercase">Add to theme</h2><p className="mt-2 text-[10px] leading-relaxed text-[#555]">FNT stays byte-exact. TTF/OTF/TTC is converted only by the loopback helper on this computer.</p><div className="mt-3 grid grid-cols-3 gap-1"><label className="font-mono text-[8px] font-black uppercase">Pixels<input type="number" min={4} max={200} value={pixelSize} onChange={event => setPixelSize(Number(event.target.value))} className="mt-1 w-full border border-black p-2 text-[10px]" /></label><label className="col-span-2 font-mono text-[8px] font-black uppercase">Glyph range<select value={range} onChange={event => setRange(event.target.value as typeof range)} className="mt-1 w-full border border-black bg-white p-2 text-[10px]"><option value="ascii">32–126 · Basic Latin</option><option value="latin1">32–255 · Latin-1</option><option value="unicode">32–65535 · Broad Unicode</option></select></label></div><input ref={importInput} type="file" accept=".fnt,.ttf,.otf,.ttc" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); }} /><button type="button" disabled={busy} onClick={() => importInput.current?.click()} className="mt-3 w-full border-2 border-black bg-[#8b5cf6] px-3 py-3 font-mono text-[10px] font-black uppercase text-white shadow-[3px_3px_0_#111] disabled:opacity-40">{busy ? 'Working…' : 'Import / convert font'}</button><p className="mt-3 border border-amber-800 bg-[#fff4c7] p-2 text-[9px] leading-relaxed"><b>License:</b> only redistribute a generated FNT when the source font license permits conversion and redistribution.</p></section>

          {notice ? <div role="status" className="mt-4 border-2 border-emerald-800 bg-emerald-50 p-3 font-mono text-[9px] text-emerald-900">{notice}</div> : null}
          {error ? <div role="alert" className="mt-4 border-2 border-red-900 bg-red-50 p-3 font-mono text-[9px] text-red-900">{error}</div> : null}

          {selectedRecord ? <div className="mt-4 space-y-4"><section className="border-t-2 border-black pt-4"><h3 className="font-mono text-[10px] font-black uppercase">Package contract</h3><dl className="mt-2 space-y-2 break-all font-mono text-[9px]"><div><dt className="text-[#777]">Path</dt><dd>{selectedRecord.asset.archivePath}</dd></div><div><dt className="text-[#777]">SHA-256</dt><dd>{selectedRecord.asset.hash.slice(0, 20)}…</dd></div><div><dt className="text-[#777]">Owner</dt><dd>{selectedRecord.owner} · {selectedRecord.editable ? 'editable' : 'transaction-owned'}</dd></div></dl>{!selectedRecord.current ? <button type="button" disabled={Boolean(selectedRecord.error)} onClick={() => setCurrent(selectedRecord.asset.basename)} className="mt-3 w-full border-2 border-black bg-[#20bd8b] px-3 py-2 font-mono text-[9px] font-black uppercase disabled:opacity-40">Set as UI font</button> : <div className="mt-3 bg-[#20bd8b] px-3 py-2 text-center font-mono text-[9px] font-black uppercase">Current UI font</div>}</section><section className="border-t-2 border-black pt-4"><h3 className="font-mono text-[10px] font-black uppercase">Source references · {selectedRecord.references.length}</h3><div className="mt-2 space-y-2">{selectedRecord.references.length ? selectedRecord.references.map(reference => <div key={reference.id} className="border border-[#aaa] bg-white p-2 font-mono text-[8px]"><b className="block uppercase">{reference.label}</b><span className="mt-1 block break-all text-[#666]">{reference.raw}</span></div>) : <p className="text-[9px] text-[#666]">No known CFG or %Fl reference resolves to this exact path.</p>}</div></section><section className="border-t-2 border-black pt-4"><h3 className="font-mono text-[10px] font-black uppercase">Replace exact bytes</h3><input ref={replaceInput} type="file" accept=".fnt" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) void replaceFile(file); }} /><button type="button" disabled={!selectedRecord.editable || busy} onClick={() => replaceInput.current?.click()} className="mt-2 w-full border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black uppercase disabled:opacity-40">Choose replacement FNT</button></section><section className="border-t-2 border-black pt-4"><h3 className="font-mono text-[10px] font-black uppercase">Rename safely</h3><input value={renamePath} disabled={!selectedRecord.editable} onChange={event => setRenamePath(event.target.value)} className="mt-2 w-full border-2 border-black bg-white px-2 py-2 font-mono text-[8px] disabled:opacity-40" /><button type="button" disabled={!selectedRecord.editable || renamePath === selectedRecord.asset.archivePath} onClick={() => void rename()} className="mt-2 w-full border-2 border-black bg-[#ffd23f] px-3 py-2 font-mono text-[9px] font-black uppercase disabled:opacity-40">Rename + update refs</button></section><section className="border-t-2 border-black pt-4"><button type="button" disabled={!selectedRecord.editable} onClick={remove} className="w-full border-2 border-black bg-[#c83d2d] px-3 py-2 font-mono text-[9px] font-black uppercase text-white disabled:opacity-40">Delete if unreferenced</button></section></div> : null}

          <section className="mt-4 border-t-2 border-black pt-4"><h3 className="font-mono text-[10px] font-black uppercase">Rockbox boundary</h3><p className="mt-2 text-[9px] leading-relaxed text-[#555]">RB12 glyph pixels, header metrics, advance widths, and declared ranges come from the actual file. Browser placement for combining marks, bidirectional text, and firmware UI remains non-authoritative; verify those in external Level C.</p></section>
        </aside>
      </div>
    </div>
  );
};
