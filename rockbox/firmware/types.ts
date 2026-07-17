import type { DeviceProfile } from '../devices';

export const FIRMWARE_PACKAGE_SCHEMA_VERSION = 1 as const;
export const FIRMWARE_UPSTREAM_COMMIT = '078a506dfd0deb18165a3ed80c7fcbdb3afb0d31' as const;
export const FIRMWARE_TARGET = 'ipodvideo' as const;
export const FIRMWARE_DEVICE_PROFILE_ID = 'apple-ipod-video-5g' as const;
export const USB_LOGO_SOURCE_PATH = 'apps/bitmaps/native/usblogo.176x48x16.bmp' as const;
export const USB_HEADER_SOURCE_PATH = 'apps/gui/rockbox_designer_usb.h' as const;
export const USB_PATCH_SOURCE_PATH = 'apps/gui/usb_screen.c' as const;

export type UsbLogoPosition = 'left' | 'center' | 'right';

export type UsbLogoInspection = {
  valid: boolean;
  width?: number;
  height?: number;
  bitsPerPixel?: number;
  compression?: number;
  error?: string;
};

export type UsbFirmwareOptions = {
  packageName: string;
  logoPosition: UsbLogoPosition;
  logoBmp: Uint8Array;
};

export type FirmwarePackageFile = {
  path: string;
  bytes: number;
  sha256: string;
  role: 'patch' | 'source-overlay' | 'target-asset' | 'build-script' | 'documentation';
};

export type FirmwarePackageManifest = {
  schemaVersion: typeof FIRMWARE_PACKAGE_SCHEMA_VERSION;
  mode: 'firmware';
  feature: 'usb-screen';
  packageName: string;
  target: {
    deviceProfileId: typeof FIRMWARE_DEVICE_PROFILE_ID;
    rockboxTarget: typeof FIRMWARE_TARGET;
    upstreamCommit: typeof FIRMWARE_UPSTREAM_COMMIT;
  };
  output: {
    kind: 'source-patch-package';
    ordinaryThemeInstall: false;
    containsRockboxSourceTree: false;
    containsRockboxDerivedPatch: true;
    containsGeneratedGplSource: true;
    containsRockboxBinary: false;
    containsProprietaryFirmware: false;
  };
  usbScreen: {
    logoPosition: UsbLogoPosition;
    logoAssetPath: typeof USB_LOGO_SOURCE_PATH;
    logoWidth: 176;
    logoHeight: 48;
    logoBitsPerPixel: 24;
  };
  files: FirmwarePackageFile[];
};

export type FirmwareAvailability = {
  available: boolean;
  reason?: string;
};

export const firmwareAvailability = (profile: DeviceProfile): FirmwareAvailability => {
  if (profile.id !== FIRMWARE_DEVICE_PROFILE_ID || profile.rockboxTarget !== FIRMWARE_TARGET) {
    return {
      available: false,
      reason: `The first verified Firmware Mode target is Apple iPod Video 5G/5.5G (${FIRMWARE_TARGET}). ${profile.model} remains Theme Mode only.`
    };
  }
  if (profile.source.rockboxCommit !== FIRMWARE_UPSTREAM_COMMIT) {
    return {
      available: false,
      reason: `This target profile is not pinned to the verified Rockbox revision ${FIRMWARE_UPSTREAM_COMMIT}.`
    };
  }
  return { available: true };
};
