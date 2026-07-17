import type { ScreenType } from '../types';

export type ThemeScreen = Exclude<ScreenType, 'usb'>;

export const ROCKBOX_ACTIVITY = {
  mainMenu: 1,
  whilePlaying: 2,
  recording: 3,
  fm: 4,
  quickScreen: 10,
  optionSelect: 12,
  system: 16,
  usb: 21
} as const;

/**
 * USB is a preview scene rendered by the SBS at ACTIVITY_USBSCREEN. Rockbox
 * has no standalone .usb skin document.
 */
export const themeScreenForPreview = (screen: ScreenType): ThemeScreen =>
  screen === 'usb' ? 'sbs' : screen;

export const activityForPreview = (screen: ScreenType) => ({
  wps: ROCKBOX_ACTIVITY.whilePlaying,
  sbs: ROCKBOX_ACTIVITY.mainMenu,
  fms: ROCKBOX_ACTIVITY.fm,
  usb: ROCKBOX_ACTIVITY.usb
})[screen];

export const previewSourceLabel = (screen: ScreenType) =>
  screen === 'usb' ? 'SBS · USB activity 21' : `${screen.toUpperCase()} source`;

export const previewScreenForActivity = (activity: number): ScreenType => {
  if (activity === ROCKBOX_ACTIVITY.whilePlaying) return 'wps';
  if (activity === ROCKBOX_ACTIVITY.fm) return 'fms';
  if (activity === ROCKBOX_ACTIVITY.usb) return 'usb';
  return 'sbs';
};
