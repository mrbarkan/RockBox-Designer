import React, { useEffect, useState } from 'react';
import type { DeviceProfile } from '../rockbox/devices';
import {
  FIRMWARE_TARGET,
  FIRMWARE_UPSTREAM_COMMIT,
  createUsbFirmwarePackage,
  firmwareAvailability,
  inspectUsbLogoBmp,
  type UsbLogoPosition
} from '../rockbox/firmware';

type FirmwareModeProps = {
  profile: DeviceProfile;
  projectName: string;
  onClose: () => void;
};

const Step = ({ number, title, detail }: { number: string; title: string; detail: string }) => (
  <div className="grid grid-cols-[2rem_1fr] gap-3 border-t border-black/20 py-3 first:border-0">
    <div className="flex h-8 w-8 items-center justify-center border-2 border-black bg-[#ff5800] font-mono text-xs font-black text-white">{number}</div>
    <div>
      <div className="text-xs font-black uppercase">{title}</div>
      <p className="mt-1 text-[10px] leading-relaxed text-gray-600">{detail}</p>
    </div>
  </div>
);

export const FirmwareMode: React.FC<FirmwareModeProps> = ({ profile, projectName, onClose }) => {
  const availability = firmwareAvailability(profile);
  const [logoBytes, setLogoBytes] = useState<Uint8Array | null>(null);
  const [logoName, setLogoName] = useState('');
  const [logoError, setLogoError] = useState('');
  const [logoPosition, setLogoPosition] = useState<UsbLogoPosition>('center');
  const [customFirmwareConfirmed, setCustomFirmwareConfirmed] = useState(false);
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!logoBytes) {
      setPreviewUrl('');
      return;
    }
    const nextPreviewUrl = URL.createObjectURL(new Blob([logoBytes as BlobPart], { type: 'image/bmp' }));
    setPreviewUrl(nextPreviewUrl);
    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [logoBytes]);

  const canExport = availability.available && Boolean(logoBytes) && customFirmwareConfirmed && recoveryConfirmed && !building;

  const handleLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setLogoBytes(null);
    setLogoName('');
    setLogoError('');
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const inspection = inspectUsbLogoBmp(bytes);
    if (!inspection.valid) {
      setLogoError(inspection.error ?? 'This bitmap cannot be used for the pinned iPod Video build.');
      event.target.value = '';
      return;
    }
    setLogoBytes(bytes);
    setLogoName(file.name);
  };

  const handleExport = async () => {
    if (!canExport || !logoBytes) return;
    setBuilding(true);
    setBuildError('');
    try {
      const output = await createUsbFirmwarePackage({
        packageName: projectName,
        logoPosition,
        logoBmp: logoBytes
      });
      const url = URL.createObjectURL(new Blob([output.bytes as BlobPart], { type: 'application/zip' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = output.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setBuildError(error instanceof Error ? error.message : 'The firmware source package could not be created.');
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-[#d8d8d3] font-mono text-[#161616]" role="dialog" aria-modal="true" aria-label="Firmware Mode">
      <header className="flex min-h-20 items-center justify-between border-b-2 border-black bg-[#242424] px-6 text-white">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center border-2 border-white bg-[#ff5800] text-lg font-black">FW</div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">Opt-in source modification</div>
            <h1 className="mt-1 text-xl font-black uppercase tracking-tight">Firmware Assets · Built-in USB fallback</h1>
          </div>
        </div>
        <button type="button" onClick={onClose} className="border-2 border-white px-4 py-2 text-xs font-black uppercase hover:bg-white hover:text-black">Close</button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_340px]">
        <aside className="overflow-y-auto border-r-2 border-black bg-[#ecebe7] p-5">
          <div className="border-2 border-black bg-[#ffd23f] p-4 shadow-[4px_4px_0_#111]">
            <div className="text-xs font-black uppercase">Requires custom firmware</div>
            <p className="mt-2 text-[10px] leading-relaxed">Ordinary themes can author the connected-USB presentation in SBS. This workspace changes only Rockbox's compiled fallback logo and placement for one exact target.</p>
          </div>
          <div className="mt-6">
            <Step number="01" title="Author" detail="Supply one 176 × 48 uncompressed 24-bit BMP and choose its firmware placement." />
            <Step number="02" title="Export" detail="Designer creates a source patch, overlay, manifest, verification script, and isolated build script." />
            <Step number="03" title="Build" detail="The script refuses any Rockbox checkout that is not the recorded upstream revision." />
            <Step number="04" title="Recover" detail="Install only after backing up and confirming disk-mode recovery for the exact iPod." />
          </div>
        </aside>

        <main className="min-w-0 overflow-y-auto bg-[#f5f4ef] p-7">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-black pb-5">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">Verified target</div>
              <div className="mt-1 text-lg font-black">{profile.model}</div>
              <div className="mt-1 text-[10px] text-gray-600">Rockbox {FIRMWARE_TARGET} · {FIRMWARE_UPSTREAM_COMMIT.slice(0, 12)}</div>
            </div>
            <div className={`border-2 border-black px-3 py-2 text-[10px] font-black uppercase ${availability.available ? 'bg-[#20bd8b]' : 'bg-red-400'}`}>
              {availability.available ? 'Target verified' : 'Theme Mode only'}
            </div>
          </div>

          {!availability.available ? (
            <div role="alert" className="mt-6 border-2 border-red-900 bg-red-50 p-5 text-sm text-red-950 shadow-[5px_5px_0_#5f1111]">
              <div className="font-black uppercase">Firmware export unavailable</div>
              <p className="mt-2 text-xs leading-relaxed">{availability.reason}</p>
            </div>
          ) : (
            <>
              <section className="mt-6 border-2 border-black bg-white shadow-[6px_6px_0_#111]">
                <div className="border-b-2 border-black bg-[#d9d9d4] px-4 py-3 text-xs font-black uppercase">1 · USB logo asset</div>
                <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-6 p-5">
                  <div>
                    <label htmlFor="firmware-usb-logo" className="block text-[10px] font-black uppercase tracking-widest">Choose source bitmap</label>
                    <input id="firmware-usb-logo" type="file" accept=".bmp,image/bmp" onChange={handleLogo} className="mt-2 block w-full border-2 border-black bg-[#f3f3ef] p-3 text-xs file:mr-3 file:border file:border-black file:bg-[#ff5800] file:px-3 file:py-2 file:font-black file:text-white" />
                    <p className="mt-2 text-[10px] leading-relaxed text-gray-500">Exact contract: Windows BMP, 176 × 48 pixels, 24-bit RGB, no compression. The package replaces Rockbox's target-specific built-in USB bitmap.</p>
                    {logoError ? <div role="alert" className="mt-3 border-l-4 border-red-700 bg-red-50 p-3 text-xs text-red-900">{logoError}</div> : null}
                    {logoName ? <div className="mt-3 border-l-4 border-emerald-700 bg-emerald-50 p-3 text-xs text-emerald-900">Validated: {logoName}</div> : null}
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest">Firmware framebuffer preview</div>
                    <div className="mt-2 flex aspect-[4/3] items-center bg-[#221f20] p-4">
                      <div className="relative h-full w-full bg-[#f3f3ef]">
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt="Uploaded USB logo"
                            className={`absolute top-1/2 h-[48px] w-[176px] -translate-y-1/2 object-contain ${logoPosition === 'left' ? 'left-0' : logoPosition === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}
                          />
                        ) : <div className="flex h-full items-center justify-center px-8 text-center text-[10px] uppercase text-gray-400">Select a valid bitmap to preview the firmware placement.</div>}
                      </div>
                    </div>
                    <div className="mt-2 text-[9px] text-gray-500">Placement preview only. The compiled external Rockbox target remains the behavioral authority.</div>
                  </div>
                </div>
              </section>

              <section className="mt-6 border-2 border-black bg-white shadow-[6px_6px_0_#111]">
                <div className="border-b-2 border-black bg-[#d9d9d4] px-4 py-3 text-xs font-black uppercase">2 · Compiled layout</div>
                <div className="p-5">
                  <label htmlFor="firmware-logo-position" className="text-[10px] font-black uppercase tracking-widest">Horizontal placement</label>
                  <select id="firmware-logo-position" value={logoPosition} onChange={event => setLogoPosition(event.target.value as UsbLogoPosition)} className="mt-2 block w-full border-2 border-black bg-white p-3 text-sm font-black uppercase">
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right · stock position</option>
                  </select>
                  <p className="mt-2 text-[10px] text-gray-500">This placement is compiled into <code>apps/gui/usb_screen.c</code>. Designer emits a reviewable patch rather than inventing a theme file.</p>
                </div>
              </section>
            </>
          )}
        </main>

        <aside className="overflow-y-auto border-l-2 border-black bg-[#2b2b2b] p-5 text-white">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-400">Release gate</div>
          <h2 className="mt-2 text-lg font-black uppercase">Confirm before export</h2>
          <p className="mt-2 text-[10px] leading-relaxed text-gray-400">Both confirmations are required. They are intentionally not stored with the project.</p>

          <label className="mt-6 flex cursor-pointer gap-3 border-2 border-gray-500 bg-black/20 p-4 text-xs leading-relaxed hover:border-orange-400">
            <input type="checkbox" checked={customFirmwareConfirmed} onChange={event => setCustomFirmwareConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-orange-600" />
            <span>I understand this is a custom-firmware source package, not an ordinary theme install.</span>
          </label>
          <label className="mt-3 flex cursor-pointer gap-3 border-2 border-gray-500 bg-black/20 p-4 text-xs leading-relaxed hover:border-orange-400">
            <input type="checkbox" checked={recoveryConfirmed} onChange={event => setRecoveryConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-orange-600" />
            <span>I have a backup, disk-mode recovery instructions, and a known-good Rockbox build for this iPod.</span>
          </label>

          <div className="mt-6 border-t border-gray-600 pt-5">
            <div className="text-[10px] font-black uppercase text-gray-400">Package contains</div>
            <ul className="mt-3 space-y-2 text-[10px] text-gray-300">
              <li>✓ SHA-pinned source patch</li>
              <li>✓ Generated GPL source header</li>
              <li>✓ Target-specific BMP overlay</li>
              <li>✓ Isolated verify/build scripts</li>
              <li>✓ Compatibility and licensing manifest</li>
              <li className="text-emerald-400">✓ No Rockbox or proprietary firmware binary</li>
            </ul>
          </div>

          {buildError ? <div role="alert" className="mt-5 border-2 border-red-500 bg-red-950 p-3 text-xs text-red-100">{buildError}</div> : null}
          <button type="button" onClick={handleExport} disabled={!canExport} className="mt-6 w-full border-2 border-white bg-[#ff5800] px-4 py-4 text-xs font-black uppercase shadow-[4px_4px_0_#fff] enabled:hover:bg-orange-500 enabled:active:translate-x-[2px] enabled:active:translate-y-[2px] enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-30">
            {building ? 'Building package…' : 'Export firmware package'}
          </button>
          <p className="mt-4 text-[9px] leading-relaxed text-gray-500">The browser exports source inputs only. Compilation and firmware behavior verification happen externally against the pinned Rockbox target.</p>
        </aside>
      </div>
    </div>
  );
};
