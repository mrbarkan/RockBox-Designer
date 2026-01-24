// IDE Data Structures

export enum ElementType {
  TEXT = 'text',
  RECT = 'rect',
  IMAGE = 'image',
  VIEWPORT = 'viewport',
  PROGRESS_BAR = 'progress_bar'
}

export type ScreenType = 'wps' | 'sbs';

export interface BaseElement {
  id: string;
  name: string;
  type: ElementType;
  screen: ScreenType; // New: Which screen does this belong to?
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  locked: boolean;
  // Rockbox conditional logic placeholder
  condition?: string; 
}

export interface TextElement extends BaseElement {
  type: ElementType.TEXT;
  content: string; // The Rockbox tag (e.g., "%s", "Static Text")
  fontId: string;
  align: 'left' | 'center' | 'right';
  color: string; // Hex
}

export interface RectElement extends BaseElement {
  type: ElementType.RECT;
  color: string; // Hex
}

export interface ImageElement extends BaseElement {
  type: ElementType.IMAGE;
  src: string; // Data URL for preview
  filename: string; // filename for export
}

export interface ProgressBarElement extends BaseElement {
  type: ElementType.PROGRESS_BAR;
  foreColor: string;
  backColor: string;
}

export type WpsElement = TextElement | RectElement | ImageElement | ProgressBarElement;

export interface ProjectSettings {
  name: string;
  target: 'ipod_video'; // 320x240
  backgroundColor: string;
  statusBarTop: boolean;
  backdrop?: string; // filename
}

export interface ProjectState {
  settings: ProjectSettings;
  elements: WpsElement[];
  assets: Record<string, string>; // Map filename -> base64
  selectedElementIds: string[];
}

export interface SongMetadata {
  title: string;
  artist: string;
  album: string;
  trackNum: number;
  totalTracks: number;
  currentSec: number;
  totalSec: number;
  format: string;
  kbps: number;
  albumArt?: string; // URL
}

// Simulation Types

export interface SimulationState {
  batteryLevel: number; // 0-100
  volume: number; // -100 to 0 (dB) or arbitrary scale
  isCharging: boolean;
  playStatus: 'stop' | 'play' | 'pause' | 'ffwd' | 'rew';
  currentTime: string; // HH:MM
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
}

// Service / Generator Types

export enum LayoutStyle {
  MINIMAL = 'MINIMAL',
  SPLIT = 'SPLIT',
  FULL_ART = 'FULL_ART'
}

export enum ThemeFont {
  NIMBUS_14 = '14-Nimbus.fnt',
  TERMINUS_16 = '16-Terminus.fnt',
  UNIFONT_16 = '16-Unifont.fnt',
  SYS_PROPS_12 = '12-Sys-Proportional.fnt',
  SYS_FIXED_12 = '12-Sys-Fixed.fnt'
}

export const ROCKBOX_FONTS = [
    { id: ThemeFont.NIMBUS_14, label: 'Nimbus 14 (Sans)', css: '"Inter", sans-serif', size: 14 },
    { id: ThemeFont.TERMINUS_16, label: 'Terminus 16 (Mono)', css: '"JetBrains Mono", monospace', size: 16 },
    { id: ThemeFont.UNIFONT_16, label: 'Unifont 16 (Pixel)', css: '"Courier New", monospace', size: 16 },
    { id: ThemeFont.SYS_PROPS_12, label: 'Sys Prop 12', css: 'sans-serif', size: 12 },
    { id: ThemeFont.SYS_FIXED_12, label: 'Sys Fixed 12', css: 'monospace', size: 12 },
];

export interface ThemeColors {
  background: string;
  foreground: string;
  accent: string;
  barBackground: string;
  barForeground: string;
}

export interface ThemeConfig {
  name: string;
  colors: ThemeColors;
  font: ThemeFont;
  showAlbumArt: boolean;
  showNextSong: boolean;
  showVolume?: boolean;
  statusBar: boolean;
  layout: LayoutStyle;
}