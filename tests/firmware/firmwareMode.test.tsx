import React from 'react';
import JSZip from 'jszip';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { FirmwareMode } from '../../components/FirmwareMode';
import { getDeviceProfile } from '../../rockbox/devices';
import {
  FIRMWARE_UPSTREAM_COMMIT,
  createUsbFirmwarePackage,
  createUsbLayoutHeader,
  createUsbScreenPatch,
  firmwareAvailability,
  inspectUsbLogoBmp
} from '../../rockbox/firmware';

const writeU16 = (bytes: Uint8Array, offset: number, value: number) => {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
};

const writeU32 = (bytes: Uint8Array, offset: number, value: number) => {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
};

const createUsbBmp = () => {
  const width = 176;
  const height = 48;
  const pixelOffset = 54;
  const rowBytes = width * 3;
  const bytes = new Uint8Array(pixelOffset + rowBytes * height);
  bytes[0] = 0x42;
  bytes[1] = 0x4d;
  writeU32(bytes, 2, bytes.byteLength);
  writeU32(bytes, 10, pixelOffset);
  writeU32(bytes, 14, 40);
  writeU32(bytes, 18, width);
  writeU32(bytes, 22, height);
  writeU16(bytes, 26, 1);
  writeU16(bytes, 28, 24);
  writeU32(bytes, 30, 0);
  writeU32(bytes, 34, rowBytes * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = pixelOffset + y * rowBytes + x * 3;
      const accent = x >= 8 && x < width - 8 && y >= 8 && y < height - 8;
      bytes[offset] = accent ? 0x00 : 0x18;
      bytes[offset + 1] = accent ? 0x58 : 0x18;
      bytes[offset + 2] = accent ? 0xff : 0x18;
    }
  }
  return bytes;
};

describe('Phase 8 Firmware Mode', () => {
  it('accepts only the target-specific Rockbox USB bitmap contract', () => {
    const valid = createUsbBmp();
    expect(inspectUsbLogoBmp(valid)).toMatchObject({
      valid: true,
      width: 176,
      height: 48,
      bitsPerPixel: 24,
      compression: 0
    });

    const wrongWidth = valid.slice();
    writeU32(wrongWidth, 18, 175);
    expect(inspectUsbLogoBmp(wrongWidth)).toMatchObject({
      valid: false,
      error: 'The iPod Video USB logo must be exactly 176 × 48 pixels.'
    });

    const compressed = valid.slice();
    writeU32(compressed, 30, 1);
    expect(inspectUsbLogoBmp(compressed)).toMatchObject({
      valid: false,
      error: 'Compressed BMP files are not supported by the pinned Rockbox bitmap tool.'
    });
  });

  it('emits a deterministic, reviewable package without firmware binaries', async () => {
    const options = { packageName: 'Adwaitapod USB', logoPosition: 'center' as const, logoBmp: createUsbBmp() };
    const first = await createUsbFirmwarePackage(options);
    const second = await createUsbFirmwarePackage(options);
    expect(first.bytes).toEqual(second.bytes);
    expect(first.filename).toBe('adwaitapod-usb-firmware-ipodvideo.zip');
    expect(first.manifest).toMatchObject({
      schemaVersion: 1,
      mode: 'firmware',
      feature: 'usb-screen',
      target: { upstreamCommit: FIRMWARE_UPSTREAM_COMMIT, rockboxTarget: 'ipodvideo' },
      output: {
        ordinaryThemeInstall: false,
        containsRockboxSourceTree: false,
        containsRockboxDerivedPatch: true,
        containsGeneratedGplSource: true,
        containsRockboxBinary: false,
        containsProprietaryFirmware: false
      }
    });

    const zip = await JSZip.loadAsync(first.bytes);
    const paths = Object.keys(zip.files).filter(path => !zip.files[path].dir).sort();
    expect(paths).toEqual([
      'COPYING-NOTICE.txt',
      'README.md',
      'manifest.json',
      'overlay/apps/bitmaps/native/usblogo.176x48x16.bmp',
      'overlay/apps/gui/rockbox_designer_usb.h',
      'patches/usb-screen-layout.patch',
      'scripts/build-ipodvideo.sh',
      'scripts/verify.sh'
    ]);
    expect(await zip.file('patches/usb-screen-layout.patch')!.async('string')).toBe(createUsbScreenPatch());
    expect(await zip.file('overlay/apps/gui/rockbox_designer_usb.h')!.async('string')).toBe(createUsbLayoutHeader('center'));
    expect(await zip.file('README.md')!.async('string')).toContain('Requires custom firmware');
    expect(paths.some(path => /(?:rockbox\.ipod|rockbox\.zip|\.bin|\.wasm)$/i.test(path))).toBe(false);
  });

  it('is opt-in, target-gated, and visibly separate from Theme Mode', () => {
    const video = getDeviceProfile('apple-ipod-video-5g');
    const classic = getDeviceProfile('apple-ipod-classic-6g');
    expect(firmwareAvailability(video)).toEqual({ available: true });
    expect(firmwareAvailability(classic)).toMatchObject({ available: false });

    const app = renderToStaticMarkup(<App />);
    expect(app).toContain('FW MODE');
    expect(app).toContain('⬇ ZIP');

    const firmware = renderToStaticMarkup(
      <FirmwareMode profile={video} projectName="Adwaitapod" onClose={() => undefined} />
    );
    expect(firmware).toContain('Requires custom firmware');
    expect(firmware).toContain('not an ordinary theme install');
    expect(firmware).toContain('disk-mode recovery instructions');
    expect(firmware).toContain('No Rockbox or proprietary firmware binary');
    expect(firmware).toContain(FIRMWARE_UPSTREAM_COMMIT.slice(0, 12));
    expect(firmware).toContain('disabled');
  });
});
