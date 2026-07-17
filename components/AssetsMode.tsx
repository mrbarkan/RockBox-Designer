import React, { useMemo, useRef, useState, useEffect } from 'react';
import type { ProjectState, ScreenType } from '../types';
import { getDeviceProfile } from '../rockbox/devices';
import {
  addProjectAsset,
  collectProjectAssetReferences,
  composeVerticalBitmapStrip,
  defaultBitmapDirectory,
  deleteProjectAsset,
  encodeRockboxBitmap,
  inspectRockboxBitmap,
  listProjectAssets,
  renameProjectAsset,
  replaceProjectAsset,
  ROCKBOX_ASSET_PRESETS,
  createRockboxAssetPreset,
  type AssetMutationResult,
  type ProjectAssetRecord,
  type RgbaRaster
} from '../rockbox/assets';

type AssetsModeProps = {
  project: ProjectState;
  activeScreen: ScreenType;
  onProjectChange: (project: ProjectState) => void;
  onClose: () => void;
  onOpenPlay: () => void;
};

const safeStem = (filename: string) => {
  const stem = filename.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '');
  return stem || 'asset';
};

const decodeRasterFile = async (file: File): Promise<RgbaRaster> => {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('This browser could not create an image conversion canvas.');
  context.clearRect(0, 0, bitmap.width, bitmap.height);
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return { width: image.width, height: image.height, rgba: image.data };
};

const bitmapBytesForFile = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.name.toLowerCase().endsWith('.bmp') || file.type === 'image/bmp') {
    const inspection = inspectRockboxBitmap(bytes);
    if (!inspection.valid) throw new Error(inspection.error ?? 'Rockbox cannot load this BMP.');
    return bytes;
  }
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not a bitmap, PNG, or JPEG image.`);
  return encodeRockboxBitmap(await decodeRasterFile(file));
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const ownerLabel = (record: ProjectAssetRecord) => ({
  theme: 'Imported package',
  project: 'Project asset',
  component: 'Component-owned'
})[record.owner];

const useAssetUrls = (records: ProjectAssetRecord[]) => {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const created: string[] = [];
    const next: Record<string, string> = {};
    records.forEach(({ asset }) => {
      if (asset.kind !== 'bitmap') return;
      const url = URL.createObjectURL(new Blob([asset.bytes as BlobPart], { type: asset.mimeType ?? 'image/bmp' }));
      created.push(url);
      next[asset.archivePath] = url;
    });
    setUrls(next);
    return () => created.forEach(url => URL.revokeObjectURL(url));
  }, [records]);
  return urls;
};

const StatusPill = ({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' }) => (
  <span className={`border border-black px-2 py-1 font-mono text-[9px] font-black uppercase ${
    tone === 'good' ? 'bg-[#20bd8b]' : tone === 'warn' ? 'bg-[#ffd23f]' : 'bg-[#e8e6df]'
  }`}>{children}</span>
);

export const AssetsMode: React.FC<AssetsModeProps> = ({ project, activeScreen, onProjectChange, onClose, onOpenPlay }) => {
  const records = useMemo(() => listProjectAssets(project), [project.themePackage?.assets, project.projectAssets, project.componentAssets]);
  const references = useMemo(() => collectProjectAssetReferences(project), [
    project.themePackage,
    project.projectAssets,
    project.componentAssets,
    project.wpsDocument,
    project.sbsDocument,
    project.fmsDocument,
    project.elements
  ]);
  const urls = useAssetUrls(records);
  const [selectedPath, setSelectedPath] = useState<string | null>(records[0]?.asset.archivePath ?? null);
  const [renamePath, setRenamePath] = useState(records[0]?.asset.archivePath ?? '');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'bitmap' | 'font' | 'other'>('all');
  const [message, setMessage] = useState('Canonical package bytes are active. Select an asset to inspect its real Rockbox usage.');
  const [manualFrameCounts, setManualFrameCounts] = useState<Record<string, number>>({});
  const [frameIndexes, setFrameIndexes] = useState<Record<string, number>>({});
  const [showPresetShelf, setShowPresetShelf] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const stripInputRef = useRef<HTMLInputElement>(null);
  const device = getDeviceProfile(project.settings.target);
  const effectivePath = records.some(record => record.asset.archivePath === selectedPath)
    ? selectedPath
    : records[0]?.asset.archivePath ?? null;
  const selected = records.find(record => record.asset.archivePath === effectivePath);
  const selectedReferences = references.filter(reference => reference.resolvedPath === effectivePath);
  const inspection = selected?.asset.kind === 'bitmap' ? inspectRockboxBitmap(selected.asset.bytes) : null;
  const referencedFrameCount = selectedReferences.find(reference => reference.frameCount)?.frameCount ?? 1;
  const frameCount = effectivePath ? manualFrameCounts[effectivePath] ?? referencedFrameCount : 1;
  const frameHeight = inspection?.valid && frameCount > 0 ? inspection.height / frameCount : 0;
  const frameIndex = effectivePath ? Math.min(frameCount - 1, frameIndexes[effectivePath] ?? 0) : 0;
  const previewScale = inspection?.valid && frameHeight > 0
    ? Math.min(3, 520 / inspection.width, 360 / frameHeight)
    : 1;
  const duplicateBasename = selected
    ? records.filter(record => record.asset.basename.toLowerCase() === selected.asset.basename.toLowerCase()).length > 1
    : false;
  const unresolved = references.filter(reference => !reference.resolvedPath);

  const filtered = records.filter(({ asset }) => {
    const matchesQuery = `${asset.archivePath} ${asset.kind}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesKind = filter === 'all' || filter === 'other'
      ? filter === 'all' || !['bitmap', 'font'].includes(asset.kind)
      : asset.kind === filter;
    return matchesQuery && matchesKind;
  });

  const applyResult = (result: AssetMutationResult) => {
    setMessage(result.ok ? result.message ?? 'Asset change applied.' : result.conflicts.join(' '));
    if (result.ok) onProjectChange(result.project);
    return result.ok;
  };

  const handleImport = async (files: FileList | null) => {
    if (!files?.length) return;
    let nextProject = project;
    const added: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const bytes = await bitmapBytesForFile(file);
        const filename = `${safeStem(file.name)}.bmp`;
        const path = `${defaultBitmapDirectory(nextProject, activeScreen)}/${filename}`;
        const result = await addProjectAsset(nextProject, path, bytes);
        if (!result.ok) throw new Error(result.conflicts.join(' '));
        nextProject = result.project;
        added.push(path);
      }
      onProjectChange(nextProject);
      setSelectedPath(added.at(-1) ?? null);
      setRenamePath(added.at(-1) ?? '');
      setMessage(`Added ${added.length} Rockbox BMP asset${added.length === 1 ? '' : 's'}. PNG/JPEG inputs were converted; original BMP bytes were preserved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to import the selected image.');
    }
  };

  const handleStrip = async (files: FileList | null) => {
    if (!files || files.length < 2) {
      setMessage('Choose at least two equal-size images for a vertical Rockbox strip.');
      return;
    }
    try {
      const frames = await Promise.all(Array.from(files).map(decodeRasterFile));
      const strip = composeVerticalBitmapStrip(frames);
      const bytes = encodeRockboxBitmap(strip);
      const filename = `${safeStem(files[0].name)}-strip-${files.length}.bmp`;
      const path = `${defaultBitmapDirectory(project, activeScreen)}/${filename}`;
      const result = await addProjectAsset(project, path, bytes);
      if (applyResult(result)) {
        setSelectedPath(path);
        setRenamePath(path);
        setManualFrameCounts(current => ({ ...current, [path]: files.length }));
        setMessage(`Built ${path}: ${files.length} equal ${frames[0].width} × ${frames[0].height} frames stacked vertically for %xl.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to build the bitmap strip.');
    }
  };

  const handleReplace = async (file: File | undefined) => {
    if (!file || !selected) return;
    try {
      const bytes = selected.asset.kind === 'bitmap'
        ? await bitmapBytesForFile(file)
        : new Uint8Array(await file.arrayBuffer());
      applyResult(await replaceProjectAsset(project, selected.asset.archivePath, bytes));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to replace this asset.');
    }
  };

  const handlePreset = async (preset: typeof ROCKBOX_ASSET_PRESETS[number]) => {
    const path = `${defaultBitmapDirectory(project, activeScreen)}/${preset.filename}`;
    const result = await addProjectAsset(project, path, createRockboxAssetPreset(preset.id));
    if (applyResult(result)) {
      setSelectedPath(path);
      setRenamePath(path);
      setManualFrameCounts(current => ({ ...current, [path]: preset.frameCount }));
      setShowPresetShelf(false);
      setMessage(`Added the license-clean ${preset.name} preset as real Rockbox BMP bytes. Insert or reference it from Components, Screens, or Source.`);
    }
  };

  const handleRename = async () => {
    if (!selected) return;
    const result = await renameProjectAsset(project, selected.asset.archivePath, renamePath);
    if (applyResult(result)) {
      setSelectedPath(renamePath);
    }
  };

  const handleDelete = () => {
    if (!selected) return;
    if (!window.confirm(`Delete ${selected.asset.archivePath}? Only unreferenced project/imported assets can be deleted.`)) return;
    if (applyResult(deleteProjectAsset(project, selected.asset.archivePath))) {
      setSelectedPath(null);
      setRenamePath('');
    }
  };

  return (
    <div className="fixed inset-0 z-[118] flex flex-col bg-[#242424] text-[#111]">
      <header className="flex min-h-20 items-center justify-between border-b-2 border-black bg-[#eceae4] px-6 py-4">
        <div className="flex items-center gap-4">
          <button type="button" onClick={onClose} className="border-2 border-black bg-white px-3 py-2 font-mono text-xs font-black uppercase shadow-[3px_3px_0_#111] hover:bg-[#ffd23f]">← Screens</button>
          <div>
            <div className="font-mono text-[10px] font-black uppercase tracking-[0.25em] text-[#696d79]">Package workshop</div>
            <h1 className="font-mono text-2xl font-black uppercase tracking-tight">Assets · Real Rockbox bytes</h1>
          </div>
          <StatusPill tone="good">{records.length} assets</StatusPill>
          <StatusPill tone={unresolved.length ? 'warn' : 'good'}>{unresolved.length} missing refs</StatusPill>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => importInputRef.current?.click()} className="border-2 border-black bg-[#ff5800] px-4 py-3 font-mono text-xs font-black uppercase text-white shadow-[3px_3px_0_#111]">+ Import images</button>
          <button type="button" onClick={() => stripInputRef.current?.click()} className="border-2 border-black bg-[#ffd23f] px-4 py-3 font-mono text-xs font-black uppercase shadow-[3px_3px_0_#111]">▥ Build strip</button>
          <button type="button" onClick={() => setShowPresetShelf(current => !current)} className={`border-2 border-black px-4 py-3 font-mono text-xs font-black uppercase shadow-[3px_3px_0_#111] ${showPresetShelf ? 'bg-black text-white' : 'bg-white'}`}>▦ Starter shelf</button>
          <button type="button" onClick={onOpenPlay} className="border-2 border-black bg-[#20bd8b] px-4 py-3 font-mono text-xs font-black uppercase shadow-[3px_3px_0_#111]">▶ Play</button>
          <input ref={importInputRef} type="file" accept=".bmp,.png,.jpg,.jpeg,image/bmp,image/png,image/jpeg" multiple className="hidden" onChange={event => { handleImport(event.target.files); event.target.value = ''; }} />
          <input ref={stripInputRef} type="file" accept=".bmp,.png,.jpg,.jpeg,image/bmp,image/png,image/jpeg" multiple className="hidden" onChange={event => { handleStrip(event.target.files); event.target.value = ''; }} />
        </div>
      </header>

      {showPresetShelf ? (
        <section className="grid grid-cols-[220px_repeat(3,minmax(0,1fr))] border-b-2 border-black bg-[#d7d5ce]">
          <div className="border-r-2 border-black p-4">
            <div className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-[#686b75]">Generated locally</div>
            <h2 className="mt-1 font-mono text-lg font-black uppercase">Starter shelf</h2>
            <p className="mt-1 text-[10px] text-[#62656f]">License-clean BMPs with verified dimensions. Adding one never inserts source implicitly.</p>
          </div>
          {ROCKBOX_ASSET_PRESETS.map(preset => (
            <button key={preset.id} type="button" onClick={() => handlePreset(preset)} className="group border-r border-black bg-[#f3f1eb] p-4 text-left hover:bg-[#ffd23f]">
              <div className="font-mono text-xs font-black uppercase">{preset.name}</div>
              <div className="mt-1 text-[10px] text-[#62656f] group-hover:text-black">{preset.description}</div>
              <div className="mt-3 flex gap-2"><StatusPill>{preset.width} × {preset.frameHeight * preset.frameCount}</StatusPill><StatusPill tone={preset.frameCount > 1 ? 'warn' : 'neutral'}>{preset.frameCount} frame{preset.frameCount === 1 ? '' : 's'}</StatusPill></div>
            </button>
          ))}
        </section>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(360px,1fr)_380px]">
        <aside className="flex min-h-0 flex-col border-r-2 border-black bg-[#dedcd5]">
          <div className="border-b-2 border-black p-4">
            <label className="block font-mono text-[9px] font-black uppercase tracking-widest">Find by archive path</label>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="battery, icon, .fnt…" className="mt-2 w-full border-2 border-black bg-white px-3 py-2 font-mono text-xs outline-none focus:bg-[#fff6d0]" />
            <div className="mt-3 grid grid-cols-4 gap-1">
              {(['all', 'bitmap', 'font', 'other'] as const).map(kind => (
                <button key={kind} type="button" onClick={() => setFilter(kind)} className={`border border-black px-1 py-2 font-mono text-[9px] font-black uppercase ${filter === kind ? 'bg-black text-white' : 'bg-[#f5f3ed]'}`}>{kind}</button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 [content-visibility:auto]">
            {filtered.length ? filtered.map(record => {
              const selectedRow = record.asset.archivePath === effectivePath;
              return (
                <button
                  key={record.asset.id}
                  type="button"
                  onClick={() => { setSelectedPath(record.asset.archivePath); setRenamePath(record.asset.archivePath); }}
                  className={`mb-2 flex w-full items-center gap-3 border-2 border-black p-2 text-left shadow-[2px_2px_0_#111] ${selectedRow ? 'bg-[#ff5800] text-white' : 'bg-[#f7f5ef] hover:bg-[#ffd23f]'}`}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border border-black bg-white pattern-checkered">
                    {urls[record.asset.archivePath] ? <img src={urls[record.asset.archivePath]} alt="" className="max-h-full max-w-full object-contain [image-rendering:pixelated]" /> : <span className="font-mono text-xs font-black">{record.asset.kind === 'font' ? 'Aa' : 'BIN'}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[11px] font-black">{record.asset.basename}</div>
                    <div className={`truncate font-mono text-[8px] ${selectedRow ? 'text-white/75' : 'text-[#71747e]'}`}>{record.asset.archivePath}</div>
                    <div className="mt-1 font-mono text-[8px] font-black uppercase">{record.asset.kind} · {formatBytes(record.asset.bytes.length)}</div>
                  </div>
                </button>
              );
            }) : <div className="border-2 border-dashed border-[#777] p-6 text-center font-mono text-xs font-black uppercase text-[#777]">No matching package assets</div>}
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto bg-[#343434] p-6">
          {selected ? (
            <div className="mx-auto max-w-3xl">
              <div className="border-2 border-black bg-[#eceae4] shadow-[8px_8px_0_#111]">
                <div className="flex items-start justify-between border-b-2 border-black bg-white px-5 py-4">
                  <div className="min-w-0">
                    <div className="font-mono text-[9px] font-black uppercase tracking-widest text-[#6a6e78]">{ownerLabel(selected)}</div>
                    <h2 className="truncate font-mono text-xl font-black">{selected.asset.basename}</h2>
                  </div>
                  <div className="flex gap-2"><StatusPill>{selected.asset.kind}</StatusPill><StatusPill tone={selected.editable ? 'good' : 'warn'}>{selected.editable ? 'editable bytes' : 'transaction protected'}</StatusPill></div>
                </div>

                <div className="pattern-checkered flex min-h-80 items-center justify-center overflow-auto border-b-2 border-black p-8">
                  {urls[selected.asset.archivePath] ? (
                    frameCount > 1 && inspection?.valid && Number.isInteger(frameHeight) ? (
                      <div>
                        <div className="mb-3 flex items-center justify-between font-mono text-[9px] font-black uppercase">
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setFrameIndexes(current => ({ ...current, [selected.asset.archivePath]: (frameIndex - 1 + frameCount) % frameCount }))} className="border border-black bg-white px-2 py-1">←</button>
                            <span>Frame {frameIndex + 1} of {frameCount}</span>
                            <button type="button" onClick={() => setFrameIndexes(current => ({ ...current, [selected.asset.archivePath]: (frameIndex + 1) % frameCount }))} className="border border-black bg-white px-2 py-1">→</button>
                          </div>
                          <span>{inspection.width} × {frameHeight}px each</span>
                        </div>
                        <div className="overflow-hidden border-2 border-black bg-[#ff00ff] shadow-[4px_4px_0_#111]" style={{ width: inspection.width * previewScale, height: frameHeight * previewScale }}>
                          <img src={urls[selected.asset.archivePath]} alt={selected.asset.basename} className="origin-top-left [image-rendering:pixelated]" style={{ width: inspection.width * previewScale, height: inspection.height * previewScale, transform: `translateY(${-frameIndex * frameHeight * previewScale}px)` }} />
                        </div>
                      </div>
                    ) : <img src={urls[selected.asset.archivePath]} alt={selected.asset.basename} className="max-h-[420px] max-w-full border-2 border-black bg-[#ff00ff] object-contain shadow-[5px_5px_0_#111] [image-rendering:pixelated]" />
                  ) : (
                    <div className="text-center font-mono"><div className="text-7xl font-black">{selected.asset.kind === 'font' ? 'Aa' : '01'}</div><div className="mt-3 text-xs font-black uppercase">Binary preview is not decoded in Assets mode</div></div>
                  )}
                </div>

                {inspection?.valid ? (
                  <div className="grid grid-cols-4 border-b-2 border-black bg-[#d9d7d0] text-center font-mono">
                    <div className="border-r border-black p-3"><div className="text-[8px] font-black uppercase text-[#6a6e78]">Pixels</div><div className="text-sm font-black">{inspection.width} × {inspection.height}</div></div>
                    <div className="border-r border-black p-3"><div className="text-[8px] font-black uppercase text-[#6a6e78]">Depth</div><div className="text-sm font-black">{inspection.bitDepth}-bit</div></div>
                    <div className="border-r border-black p-3"><div className="text-[8px] font-black uppercase text-[#6a6e78]">Encoding</div><div className="text-sm font-black">{inspection.compressionLabel}</div></div>
                    <div className="p-3"><div className="text-[8px] font-black uppercase text-[#6a6e78]">Alpha</div><div className="text-sm font-black">{inspection.hasAlpha ? 'Yes' : 'No'}</div></div>
                  </div>
                ) : null}
                <div className="p-5">
                  <div className="font-mono text-[9px] font-black uppercase tracking-widest text-[#6a6e78]">Exact archive path</div>
                  <div className="mt-1 break-all border border-black bg-white p-3 font-mono text-xs">{selected.asset.archivePath}</div>
                  <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-[10px]">
                    <div><span className="font-black uppercase text-[#6a6e78]">SHA-256</span><div className="mt-1 break-all">{selected.asset.hash}</div></div>
                    <div><span className="font-black uppercase text-[#6a6e78]">Package size</span><div className="mt-1">{formatBytes(selected.asset.bytes.length)}</div></div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto mt-24 max-w-lg border-2 border-black bg-[#eceae4] p-10 text-center shadow-[8px_8px_0_#111]">
              <div className="font-mono text-5xl font-black">▧</div>
              <h2 className="mt-4 font-mono text-xl font-black uppercase">No package asset selected</h2>
              <p className="mt-2 text-sm text-[#666]">Import a BMP, PNG, or JPEG. Web images are converted into Rockbox-loadable BMP bytes before they enter the project.</p>
            </div>
          )}
        </main>

        <aside className="min-h-0 overflow-y-auto border-l-2 border-black bg-[#eceae4]">
          <div className="border-b-2 border-black bg-[#ffd23f] px-5 py-4">
            <div className="font-mono text-[9px] font-black uppercase tracking-widest">Asset safety console</div>
            <div className="mt-1 text-xs leading-relaxed">{message}</div>
          </div>
          {selected ? (
            <div className="space-y-5 p-5">
              <section>
                <h3 className="font-mono text-xs font-black uppercase">References · {selectedReferences.length}</h3>
                <div className="mt-2 space-y-2">
                  {selectedReferences.length ? selectedReferences.map(reference => (
                    <div key={reference.id} className="border border-black bg-white p-3 font-mono text-[9px]">
                      <div className="font-black uppercase">{reference.label}</div>
                      <div className="mt-1 break-all text-[#686b75]">{reference.raw}</div>
                      {reference.frameCount ? <div className="mt-1 font-black text-[#bd3f00]">%xl strip · {reference.frameCount} frames</div> : null}
                    </div>
                  )) : <div className="border border-dashed border-[#777] p-3 text-[10px] text-[#666]">No resolved source or CFG references. This asset may be safe to delete after checking unsupported source manually.</div>}
                </div>
              </section>

              {inspection ? (
                <section>
                  <h3 className="font-mono text-xs font-black uppercase">Rockbox bitmap check</h3>
                  <div className={`mt-2 border-2 border-black p-3 text-[10px] ${inspection.valid ? 'bg-[#d9f5e9]' : 'bg-[#ffd4cc]'}`}>
                    <div className="font-mono font-black uppercase">{inspection.valid ? '✓ Loader-compatible header' : '✕ Not loader-compatible'}</div>
                    {inspection.error ? <p className="mt-2">{inspection.error}</p> : null}
                    {inspection.warnings.map(warning => <p key={warning} className="mt-2">⚠ {warning}</p>)}
                    {duplicateBasename ? <p className="mt-2">⚠ Duplicate basename. Exact archive-path resolution is active.</p> : null}
                  </div>
                  {inspection.valid ? (
                    <label className="mt-3 block font-mono text-[9px] font-black uppercase">
                      Preview as vertical strip
                      <input type="number" min={1} max={Math.max(1, inspection.height)} value={frameCount} onChange={event => setManualFrameCounts(current => ({ ...current, [selected.asset.archivePath]: Math.max(1, Number(event.target.value) || 1) }))} className="mt-1 w-full border-2 border-black bg-white px-3 py-2 font-mono text-xs" />
                      <span className={`mt-1 block normal-case ${Number.isInteger(frameHeight) ? 'text-[#39755f]' : 'text-[#b83a22]'}`}>{Number.isInteger(frameHeight) ? `${frameHeight}px per frame` : 'Height is not divisible by this frame count.'}</span>
                    </label>
                  ) : null}
                </section>
              ) : null}

              <section className="border-t-2 border-black pt-5">
                <h3 className="font-mono text-xs font-black uppercase">Replace bytes</h3>
                <p className="mt-1 text-[10px] text-[#666]">The archive path and every source reference stay unchanged. PNG/JPEG replacements become BMP automatically.</p>
                <button type="button" disabled={!selected.editable} onClick={() => replaceInputRef.current?.click()} className="mt-3 w-full border-2 border-black bg-white px-3 py-2 font-mono text-[10px] font-black uppercase disabled:cursor-not-allowed disabled:opacity-40">Choose replacement</button>
                <input ref={replaceInputRef} type="file" className="hidden" accept={selected.asset.kind === 'bitmap' ? '.bmp,.png,.jpg,.jpeg,image/*' : undefined} onChange={event => { handleReplace(event.target.files?.[0]); event.target.value = ''; }} />
              </section>

              <section className="border-t-2 border-black pt-5">
                <h3 className="font-mono text-xs font-black uppercase">Rename safely</h3>
                <p className="mt-1 text-[10px] text-[#666]">Resolved WPS, SBS, FMS, and CFG references update in the same undoable project change.</p>
                <input value={renamePath} disabled={!selected.editable} onChange={event => setRenamePath(event.target.value)} className="mt-3 w-full border-2 border-black bg-white px-3 py-2 font-mono text-[10px] disabled:opacity-40" />
                <button type="button" disabled={!selected.editable || renamePath === selected.asset.archivePath} onClick={handleRename} className="mt-2 w-full border-2 border-black bg-[#ffd23f] px-3 py-2 font-mono text-[10px] font-black uppercase disabled:cursor-not-allowed disabled:opacity-40">Rename + update references</button>
              </section>

              <section className="border-t-2 border-black pt-5">
                <button type="button" disabled={!selected.editable} onClick={handleDelete} className="w-full border-2 border-black bg-[#c83d2d] px-3 py-2 font-mono text-[10px] font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40">Delete if unreferenced</button>
              </section>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
};
