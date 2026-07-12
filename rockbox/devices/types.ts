export type ScreenFileType = 'wps' | 'sbs' | 'fms' | 'rwps' | 'rsbs' | 'rfms';
export type DeviceProfileId = 'apple-ipod-video-5g' | 'apple-ipod-classic-6g';

export type ScreenProfile = {
  width: number;
  height: number;
  depth: number;
  dpi?: number;
};

export type DeviceCapabilities = {
  touchscreen: boolean;
  fmRadio: boolean;
  recording: boolean;
  remoteLcd: boolean;
  usbHid: boolean;
  rtc: boolean;
  albumArt: boolean;
};

export type DeviceProfile = {
  id: string;
  manufacturer: string;
  model: string;
  rockboxTarget: string;
  mainScreen: ScreenProfile;
  remoteScreen?: ScreenProfile;
  capabilities: DeviceCapabilities;
  supportedScreenFiles: ScreenFileType[];
  source: {
    rockboxCommit: string;
    configPaths: string[];
  };
};

export type DeviceProfileData = {
  schemaVersion: 1;
  profiles: DeviceProfile[];
};
