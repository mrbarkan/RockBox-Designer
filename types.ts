import type { RockboxDocument } from './rockbox/syntax';

// IDE Data Structures

export enum ElementType {
  TEXT = 'text',
  RECT = 'rect',
  IMAGE = 'image',
  VIEWPORT = 'viewport',
  PROGRESS_BAR = 'progress_bar',
  TOUCH_REGION = 'touch_region',
  CUSTOM_DRAW = 'custom_draw' // For %Cd, %Dr, etc.
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
  category?: string; 
  condition?: string; // Serialized condition string (e.g. "mp:1 & C:0")
  touchAction?: string; 
}

export interface TextElement extends BaseElement {
  type: ElementType.TEXT;
  content: string; 
  fontId: string;
  align: 'left' | 'center' | 'right';
  color: string; 
  scroll?: boolean; 
  volumeFormat?: 'numeric' | 'db' | 'percent'; 
}

export interface RectElement extends BaseElement {
  type: ElementType.RECT;
  color: string; 
}

export interface ImageElement extends BaseElement {
  type: ElementType.IMAGE;
  src: string; 
  filename: string; 
  
  imageType?: 'static' | 'battery_strip' | 'volume_strip' | 'shuffle_icon' | 'repeat_icon' | 'art';
  frameCount?: number; 
  preloadId?: string; 
  
  spriteConfig?: {
      offsetX: number;
      offsetY: number;
      count: number;
      frameWidth?: number;
      frameHeight?: number;
      frameIndex?: number; 
  };
}

export interface ProgressBarElement extends BaseElement {
  type: ElementType.PROGRESS_BAR;
  foreColor: string;
  backColor: string;
  pbMode?: 'track' | 'volume' | 'auto'; 
  pbStyle?: 'flat' | 'rounded' | 'segmented' | 'adwaita' | 'image';
  backgroundImage?: string; 
}

export type WpsElement = TextElement | RectElement | ImageElement | ProgressBarElement | BaseElement;

export interface ProjectSettings {
  name: string;
  target: 'ipod_video';
  backgroundColor: string;
  statusBarTop: boolean;
  backdrop?: string; 
  
  foregroundColor: string;     
  selectorColor: string;       
  selectorTextColor: string;   
  uiFont: string;             

  iconset?: string;          
  viewersIconset?: string;   

  showIcons: boolean;
  scrollbar: 'off' | 'left' | 'right';
  scrollbarWidth: number;
  
  volumeDisplay: 'graphic' | 'numeric';
  batteryDisplay: 'graphic' | 'numeric';
  
  lineSelectorType: 'pointer' | 'bar_inverse' | 'bar_color' | 'bar_gradient';
  lineSelectorEndColor?: string;

  scrollSpeed?: number;
  scrollDelay?: number;
  scrollStep?: number;
  backlightOnHold?: 'normal' | 'off' | 'on';
  
  qsTop?: string;
  qsBottom?: string;
  qsLeft?: string;
  qsRight?: string;

  palette: string[];
}

export interface ProjectState {
  settings: ProjectSettings;
  elements: WpsElement[];
  assets: Record<string, string>; 
  selectedElementIds: string[];
  validationReport?: string[]; 
  wpsAst?: RockboxAstDocument;
  sbsAst?: RockboxAstDocument;
  fmsAst?: RockboxAstDocument;
  wpsDocument?: RockboxDocument;
  sbsDocument?: RockboxDocument;
  fmsDocument?: RockboxDocument;
}

export type RockboxAstNode = RockboxTextNode | RockboxTagNode | RockboxConditionalNode;

export interface RockboxAstDocument {
  type: 'document';
  raw: string;
  nodes: RockboxAstNode[];
}

export interface RockboxTextNode {
  type: 'text';
  value: string;
  line: number;
  column: number;
}

export interface RockboxTagNode {
  type: 'tag';
  tag: string;
  args: string[];
  raw: string;
  line: number;
  column: number;
}

export interface RockboxConditionalNode {
  type: 'conditional';
  tag: string;
  branches: RockboxAstDocument[];
  raw: string;
  line: number;
  column: number;
}

export type RockboxAstPathStep = {
  nodeIndex: number;
  branchIndex?: number;
};

export type RockboxAstPath = RockboxAstPathStep[];

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
  albumArt?: string; 
}

export interface SimulationState {
  batteryLevel: number; 
  isCharging: boolean; 
  externalPower: boolean; 
  
  volume: number; 
  isHold: boolean; 
  isUsb: boolean;
  
  playStatus: 'stop' | 'play' | 'pause' | 'ffwd' | 'rew'; 
  shuffle: boolean; 
  repeat: 'off' | 'all' | 'one'; 
  
  currentTime: string; 
  volumeLastChanged: number; 
  diskActivity: boolean; 
  sublineCycle: number; 
}

// Graphics Pipeline Types

export type RenderOp = 
  | { type: 'set_viewport', x: number, y: number, w: number, h: number, clip: boolean }
  | { type: 'rect', x: number, y: number, w: number, h: number, color: string }
  | { type: 'text', x: number, y: number, w: number, h: number, text: string, font: string, color: string, align: 'left'|'center'|'right', scroll: boolean, scrollOffset?: number }
  | { type: 'image', x: number, y: number, w: number, h: number, assetKey: string, sx?: number, sy?: number, sw?: number, sh?: number, opacity?: number }
  | { type: 'line', x1: number, y1: number, x2: number, y2: number, color: string, width: number }
  | { type: 'debug_rect', x: number, y: number, w: number, h: number, label: string };

export type RenderList = RenderOp[];

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
