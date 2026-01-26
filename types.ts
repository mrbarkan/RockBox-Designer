
// IDE Data Structures

export enum ElementType {
  TEXT = 'text',
  RECT = 'rect',
  IMAGE = 'image',
  VIEWPORT = 'viewport',
  PROGRESS_BAR = 'progress_bar',
  TOUCH_REGION = 'touch_region'
}

export type ScreenType = 'wps' | 'sbs' | 'fms' | 'usb';

export interface BaseElement {
  id: string;
  name: string;
  type: ElementType;
  screen: ScreenType; 
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  locked: boolean;
  
  // Rockbox Logic
  category?: string; // e.g. 'id3', 'power', 'rtc' - Defines the "Content Type" dropdown options
  condition?: string; // Serialized condition string (e.g. "mp:1 & C:0")
  touchAction?: string; // e.g. "wps_play", "volume_up" for %T tag
}

export interface TextElement extends BaseElement {
  type: ElementType.TEXT;
  content: string; 
  fontId: string;
  align: 'left' | 'center' | 'right';
  color: string; 
  scroll?: boolean; // New: Enable Scrolling
  volumeFormat?: 'numeric' | 'db' | 'percent'; // New: For Volume Text elements
}

export interface RectElement extends BaseElement {
  type: ElementType.RECT;
  color: string; 
}

export interface ImageElement extends BaseElement {
  type: ElementType.IMAGE;
  src: string; 
  filename: string; 
  
  // Advanced Image Properties for Rockbox
  imageType?: 'static' | 'battery_strip' | 'volume_strip' | 'shuffle_icon' | 'repeat_icon';
  frameCount?: number; // How many frames in the strip?
  preloadId?: string; // A, B, C... assigned during compile
  
  // Sprite Sheet Support
  spriteConfig?: {
      offsetX: number;
      offsetY: number;
      count: number;
      frameWidth?: number;
      frameHeight?: number;
      frameIndex?: number; // Fixed index if set
  };
}

export interface ProgressBarElement extends BaseElement {
  type: ElementType.PROGRESS_BAR;
  foreColor: string;
  backColor: string;
  pbMode?: 'track' | 'volume' | 'auto'; // Auto = Volume Overlay on change
  pbStyle?: 'flat' | 'rounded' | 'segmented' | 'adwaita' | 'image';
  backgroundImage?: string; // For %pv(x,y,w,h,img)
}

export type WpsElement = TextElement | RectElement | ImageElement | ProgressBarElement | BaseElement;

export interface ProjectSettings {
  name: string;
  target: 'ipod_video'; // 320x240
  backgroundColor: string;
  statusBarTop: boolean; // Mapped to 'statusbar' in CFG
  backdrop?: string; // filename
  
  // Global Menu / UI Settings
  foregroundColor: string;     // Main text color
  selectorColor: string;       // Cursor bar background (Start color)
  selectorTextColor: string;   // Cursor text color
  uiFont: string;             // Global UI font

  // Iconsets
  iconset?: string;          // /.rockbox/icons/...
  viewersIconset?: string;   // /.rockbox/icons/...

  // Advanced Appearance & Behavior
  showIcons: boolean;
  scrollbar: 'off' | 'left' | 'right';
  scrollbarWidth: number;
  
  volumeDisplay: 'graphic' | 'numeric';
  batteryDisplay: 'graphic' | 'numeric';
  
  lineSelectorType: 'pointer' | 'bar_inverse' | 'bar_color' | 'bar_gradient';
  lineSelectorEndColor?: string; // For gradient (End color)

  // Scrolling & Backlight (New)
  scrollSpeed?: number;
  scrollDelay?: number;
  scrollStep?: number;
  backlightOnHold?: 'normal' | 'off' | 'on';
  
  // QuickScreen (New)
  qsTop?: string;
  qsBottom?: string;
  qsLeft?: string;
  qsRight?: string;

  // Palette (New)
  palette: string[];
}

export interface ProjectState {
  settings: ProjectSettings;
  elements: WpsElement[];
  assets: Record<string, string>; // Map filename -> base64
  selectedElementIds: string[];
  validationReport?: string[]; // Import warnings
}

// User & Cloud Types
export interface User {
  username: string;
  created: number;
}

export interface CloudProject {
  id: string;
  name: string;
  updated: number;
  data: ProjectState;
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
  // Core Hardware
  batteryLevel: number; // 0-100
  isCharging: boolean; // %bc
  externalPower: boolean; // %bp
  
  // Inputs/State
  volume: number; // -100 to 0 (dB)
  isHold: boolean; // %mh
  isUsb: boolean;
  
  // Playback
  playStatus: 'stop' | 'play' | 'pause' | 'ffwd' | 'rew'; // %mp
  shuffle: boolean; // %ps
  repeat: 'off' | 'all' | 'one'; // %mm
  
  // Timers & Events for Logic
  currentTime: string; // HH:MM
  volumeLastChanged: number; // Timestamp (ms) for %?mv
  diskActivity: boolean; // %lh
  sublineCycle: number; // Global counter for %t rotation
}

// Graphics Pipeline Types

export type RenderOp = 
  | { type: 'rect', x: number, y: number, w: number, h: number, color: string }
  | { type: 'text', x: number, y: number, w: number, h: number, text: string, font: string, color: string, align: 'left'|'center'|'right', scroll: boolean, scrollOffset?: number }
  | { type: 'image', x: number, y: number, w: number, h: number, assetKey: string, sx?: number, sy?: number, sw?: number, sh?: number, opacity?: number }
  | { type: 'line', x1: number, y1: number, x2: number, y2: number, color: string, width: number }
  | { type: 'push_clip', x: number, y: number, w: number, h: number }
  | { type: 'pop_clip' };

export type RenderList = RenderOp[];

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

export interface FontDefinition {
    family: string;
    sizes: number[];
    type: 'sans' | 'serif' | 'mono' | 'pixel';
}

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