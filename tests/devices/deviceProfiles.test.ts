import { describe, expect, it } from 'vitest';
import {
  canAuthorFm,
  canAuthorRemoteScreens,
  canAuthorTouch,
  deviceProfiles,
  getDeviceProfile,
  getMainScreenFiles,
  resolveDeviceProfileId,
  supportsScreenFile
} from '../../rockbox/devices';
import type { DeviceProfile } from '../../rockbox/devices';

describe('verified device profiles', () => {
  const video = getDeviceProfile('apple-ipod-video-5g');
  const classic = getDeviceProfile('apple-ipod-classic-6g');

  it('provides two source-referenced current Rockbox targets', () => {
    expect(deviceProfiles).toHaveLength(2);
    expect(deviceProfiles.map(profile => profile.rockboxTarget)).toEqual(['ipodvideo', 'ipod6g']);
    for (const profile of deviceProfiles) {
      expect(profile.mainScreen).toEqual({ width: 320, height: 240, depth: 16, dpi: 160 });
      expect(profile.source.rockboxCommit).toBe('078a506dfd0deb18165a3ed80c7fcbdb3afb0d31');
      expect(profile.source.configPaths).toContain('tools/configure');
    }
  });

  it('does not infer equal capabilities from equal dimensions', () => {
    expect(video.mainScreen).toEqual(classic.mainScreen);
    expect(canAuthorFm(video)).toBe(true);
    expect(canAuthorFm(classic)).toBe(false);
    expect(getMainScreenFiles(video)).toEqual(['wps', 'sbs', 'fms']);
    expect(getMainScreenFiles(classic)).toEqual(['wps', 'sbs']);
  });

  it('gates touch, remote LCD, FM, and screen files by capability', () => {
    expect(canAuthorTouch(video)).toBe(false);
    expect(canAuthorRemoteScreens(video)).toBe(false);
    expect(supportsScreenFile(classic, 'fms')).toBe(false);

    const capable: DeviceProfile = {
      ...video,
      id: 'fixture-capable',
      capabilities: { ...video.capabilities, touchscreen: true, remoteLcd: true },
      supportedScreenFiles: [...video.supportedScreenFiles, 'rwps']
    };
    expect(canAuthorTouch(capable)).toBe(true);
    expect(canAuthorRemoteScreens(capable)).toBe(true);
  });

  it('migrates legacy target aliases and safely falls back', () => {
    expect(resolveDeviceProfileId('ipod_video')).toBe('apple-ipod-video-5g');
    expect(resolveDeviceProfileId('ipod6g')).toBe('apple-ipod-classic-6g');
    expect(resolveDeviceProfileId('future-unknown')).toBe('apple-ipod-video-5g');
    expect(getDeviceProfile(undefined).id).toBe('apple-ipod-video-5g');
  });
});
