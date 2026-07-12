import profileData from './profiles/device-profiles.json';
import { DeviceProfile, DeviceProfileData, DeviceProfileId, ScreenFileType } from './types';

export const DEFAULT_DEVICE_PROFILE_ID = 'apple-ipod-video-5g' as const;

export const deviceProfiles = (profileData as DeviceProfileData).profiles;

const profilesById = new Map(deviceProfiles.map(profile => [profile.id, profile] as const));

const legacyProfileAliases: Record<string, DeviceProfileId> = {
  ipod_video: DEFAULT_DEVICE_PROFILE_ID,
  ipodvideo: DEFAULT_DEVICE_PROFILE_ID,
  ipod_6g: 'apple-ipod-classic-6g',
  ipod6g: 'apple-ipod-classic-6g'
};

export const resolveDeviceProfileId = (value: unknown): DeviceProfileId => {
  if (typeof value !== 'string') return DEFAULT_DEVICE_PROFILE_ID;
  if (profilesById.has(value)) return value as DeviceProfileId;
  return legacyProfileAliases[value] ?? DEFAULT_DEVICE_PROFILE_ID;
};

export const getDeviceProfile = (id: unknown): DeviceProfile =>
  profilesById.get(resolveDeviceProfileId(id)) ?? profilesById.get(DEFAULT_DEVICE_PROFILE_ID)!;

export const supportsScreenFile = (
  profile: DeviceProfile,
  screen: ScreenFileType
): boolean => profile.supportedScreenFiles.includes(screen);

export const getMainScreenFiles = (profile: DeviceProfile): Array<'wps' | 'sbs' | 'fms'> =>
  profile.supportedScreenFiles.filter(
    (screen): screen is 'wps' | 'sbs' | 'fms' => ['wps', 'sbs', 'fms'].includes(screen)
  );

export const canAuthorFm = (profile: DeviceProfile): boolean =>
  profile.capabilities.fmRadio && supportsScreenFile(profile, 'fms');

export const canAuthorTouch = (profile: DeviceProfile): boolean =>
  profile.capabilities.touchscreen;

export const canAuthorRemoteScreens = (profile: DeviceProfile): boolean =>
  profile.capabilities.remoteLcd && profile.supportedScreenFiles.some(
    screen => ['rwps', 'rsbs', 'rfms'].includes(screen)
  );
