
import { SongMetadata, ProjectState, ElementType, SimulationState, FontDefinition } from './types';

export const IPOD_SCREEN_WIDTH = 320;
export const IPOD_SCREEN_HEIGHT = 240;

// --- ASSETS (Base64 Placeholders) ---
const createAsset = (svgContent: string) => `data:image/svg+xml;base64,${btoa(svgContent)}`;

// Helper to generate a horizontal battery strip (10 frames)
const generateBatteryStrip = (style: 'block' | 'dots' | 'solid') => {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${24*10}" height="10" viewBox="0 0 ${24*10} 10">`;
    
    for(let i=0; i<10; i++) {
        const xOffset = i * 24;
        const pct = (i + 1) * 10; // 10%, 20%... 100%
        
        // Background container
        svg += `<g transform="translate(${xOffset}, 0)">`;
        
        if (style === 'block') {
            // Outline
            svg += `<rect x="0" y="0" width="22" height="10" fill="#333" />`;
            svg += `<rect x="22" y="3" width="2" height="4" fill="#333" />`;
            // Fill
            const fillWidth = (18 * pct) / 100;
            svg += `<rect x="2" y="2" width="${fillWidth}" height="6" fill="#fff" />`;
        } else if (style === 'dots') {
            const dots = Math.ceil(pct / 20); // 1-5 dots
            for(let d=0; d<5; d++) {
                svg += `<circle cx="${4 + (d*8)}" cy="4" r="3" fill="${d < dots ? '#333' : '#ccc'}"/>`;
            }
        } else if (style === 'solid') {
             const fillWidth = (20 * pct) / 100;
             svg += `<rect x="0" y="0" width="20" height="8" fill="#444" />`;
             svg += `<rect x="0" y="0" width="${fillWidth}" height="8" fill="#fff" />`;
        }
        
        svg += `</g>`;
    }
    svg += `</svg>`;
    return createAsset(svg);
};

export const GRAPHIC_ASSETS = {
    // Battery Variants (Horizontal Strips, 10 frames)
    BATTERY: [
        { name: 'Block Strip', filename: 'batt_strip_block.bmp', width: 24, height: 10, src: generateBatteryStrip('block') },
        { name: 'Dotted Strip', filename: 'batt_strip_dots.bmp', width: 30, height: 8, src: generateBatteryStrip('dots') },
        { name: 'Solid Bar', filename: 'batt_strip_solid.bmp', width: 20, height: 8, src: generateBatteryStrip('solid') },
    ],
    // Charging Icon
    CHARGING_ICON: { name: 'Charging', filename: 'icon_charging.bmp', width: 12, height: 12, src: createAsset(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><path d="M6 0 L8 6 L5 6 L7 12 L3 7 L6 7 Z" fill="#FFCC00"/></svg>`) },
    
    // Shuffle Variants
    SHUFFLE: [
        { name: 'Arrows', filename: 'icon_shuffle_arrows.bmp', width: 15, height: 12, src: createAsset(`<svg xmlns="http://www.w3.org/2000/svg" width="15" height="12" viewBox="0 0 15 12"><path d="M0 2 L10 10 M0 10 L10 2" stroke="#FF5800" stroke-width="2"/></svg>`) },
        { name: 'Cross', filename: 'icon_shuffle_cross.bmp', width: 12, height: 12, src: createAsset(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="#00AAFF"/><text x="2" y="10" font-family="monospace" font-size="10" fill="white">S</text></svg>`) },
        { name: 'Badge', filename: 'icon_shuffle_badge.bmp', width: 24, height: 10, src: createAsset(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="10"><rect width="24" height="10" rx="2" fill="#333"/><text x="2" y="8" font-family="sans-serif" font-size="8" fill="white">SHF</text></svg>`) },
        { name: 'Dot', filename: 'icon_shuffle_dot.bmp', width: 8, height: 8, src: createAsset(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><circle cx="4" cy="4" r="4" fill="#FF0000"/></svg>`) },
    ],
    // Repeat Variants
    REPEAT: [
        { name: 'Cycle', filename: 'icon_repeat_cycle.bmp', width: 15, height: 12, src: createAsset(`<svg xmlns="http://www.w3.org/2000/svg" width="15" height="12"><path d="M2 10 L2 2 L12 2 L12 6" stroke="#00FF00" fill="none" stroke-width="2"/></svg>`) },
        { name: 'One', filename: 'icon_repeat_one.bmp', width: 12, height: 12, src: createAsset(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="#555"/><text x="3" y="10" font-family="monospace" font-size="10" fill="white">1</text></svg>`) },
        { name: 'All', filename: 'icon_repeat_all.bmp', width: 12, height: 12, src: createAsset(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="#555"/><text x="3" y="10" font-family="monospace" font-size="10" fill="white">A</text></svg>`) },
        { name: 'Infinity', filename: 'icon_repeat_inf.bmp', width: 20, height: 10, src: createAsset(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><text x="2" y="9" font-family="sans-serif" font-size="12">&#8734;</text></svg>`) },
    ],
    // Adwaita / Volume Overlay Assets
    VOLUME_OVERLAY: {
        BACKDROP: { 
            name: 'VolumeBackdrop', 
            filename: 'VolumeBackdrop.bmp', 
            width: 180, 
            height: 45, 
            src: createAsset(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="45"><rect width="180" height="45" rx="12" fill="#2d2d2d" stroke="#111" stroke-width="2" opacity="0.95"/></svg>`) 
        },
        ICONS: { 
            name: 'VolumeIcons', 
            filename: 'VolumeIcons.bmp', 
            width: 24, 
            height: 84, // 4 frames of 21px
            src: createAsset(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="84" viewBox="0 0 24 84">
                <g id="mute" transform="translate(0,0)"><path d="M4 6 L10 6 L14 2 L14 18 L10 14 L4 14 Z" fill="#666"/></g>
                <g id="low" transform="translate(0,21)"><path d="M4 6 L10 6 L14 2 L14 18 L10 14 L4 14 Z" fill="#fff"/><path d="M17 6 Q19 10 17 14" stroke="#fff" fill="none"/></g>
                <g id="med" transform="translate(0,42)"><path d="M4 6 L10 6 L14 2 L14 18 L10 14 L4 14 Z" fill="#fff"/><path d="M17 6 Q19 10 17 14" stroke="#fff" fill="none"/><path d="M19 4 Q23 10 19 16" stroke="#fff" fill="none"/></g>
                <g id="high" transform="translate(0,63)"><path d="M4 6 L10 6 L14 2 L14 18 L10 14 L4 14 Z" fill="#fff"/><path d="M17 6 Q19 10 17 14" stroke="#fff" fill="none"/><path d="M19 4 Q23 10 19 16" stroke="#fff" fill="none"/><path d="M21 2 Q27 10 21 18" stroke="#fff" fill="none"/></g>
            </svg>`)
        },
        SLIDER_BG: { 
            name: 'VolumeSliderBackdrop', 
            filename: 'VolumeSliderBackdrop.bmp', 
            width: 117, 
            height: 5, 
            src: createAsset(`<svg xmlns="http://www.w3.org/2000/svg" width="117" height="5"><rect width="117" height="5" rx="2" fill="#444"/></svg>`) 
        },
        SLIDER_FG: { 
            name: 'VolumeSlider', 
            filename: 'VolumeSlider.bmp', 
            width: 117, 
            height: 5, 
            src: createAsset(`<svg xmlns="http://www.w3.org/2000/svg" width="117" height="5"><rect width="117" height="5" rx="2" fill="#3584e4"/></svg>`) 
        }
    }
};

export const ROCKBOX_STANDARD_FONTS: Record<string, FontDefinition> = {
    'Nimbus': {
        family: 'Nimbus',
        sizes: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 28, 30, 32],
        type: 'sans'
    },
    'Terminus': {
        family: 'Terminus',
        sizes: [12, 14, 16, 20, 22, 24, 28, 32],
        type: 'mono'
    },
    'Unifont': {
        family: 'Unifont',
        sizes: [16],
        type: 'pixel'
    },
    'Sys-Proportional': {
        family: 'Sys-Proportional',
        sizes: [12],
        type: 'sans'
    },
    'Sys-Fixed': {
        family: 'Sys-Fixed',
        sizes: [12],
        type: 'mono'
    },
    'Sazanami-Mincho': {
        family: 'Sazanami-Mincho',
        sizes: [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48],
        type: 'serif'
    },
    'Sazanami-Gothic': {
        family: 'Sazanami-Gothic',
        sizes: [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48],
        type: 'sans'
    },
    'WenQuanYiBitmap': {
        family: 'WenQuanYiBitmap',
        sizes: [12, 13, 15, 16, 20, 24],
        type: 'sans'
    },
    'Adobe-Helvetica': {
        family: 'Adobe-Helvetica',
        sizes: [12, 14, 18, 20, 22, 24],
        type: 'sans'
    },
    'Rockfont': {
        family: 'Rockfont',
        sizes: [16, 20, 24, 28, 32],
        type: 'sans'
    }
};

export const DEFAULT_SONG: SongMetadata = {
  title: "Computer Love",
  artist: "Kraftwerk",
  album: "Computer World",
  trackNum: 3,
  totalTracks: 7,
  currentSec: 144,
  totalSec: 435,
  format: "FLAC",
  kbps: 986,
  albumArt: "https://upload.wikimedia.org/wikipedia/en/a/a6/Kraftwerk_-_Computer_World.png"
};

export const DEFAULT_SIMULATION: SimulationState = {
  batteryLevel: 85,
  volume: -20,
  isCharging: false,
  isHold: false,
  isUsb: false,
  playStatus: 'play',
  currentTime: "12:45",
  shuffle: false,
  repeat: 'off'
};

// "Modern Dark" Theme (Adwaitapod Inspired)
export const DEFAULT_PROJECT: ProjectState = {
  settings: {
    name: "Modern Dark",
    target: "ipod_video",
    backgroundColor: "#1e1e1e",
    statusBarTop: true,
    foregroundColor: "#f0f0f0",
    selectorColor: "#3584e4", // Modern Blue
    selectorTextColor: "#ffffff",
    uiFont: "14-Nimbus.fnt",
    showIcons: true,
    scrollbar: 'right',
    scrollbarWidth: 6,
    volumeDisplay: 'graphic',
    batteryDisplay: 'graphic',
    lineSelectorType: 'bar_color',
    lineSelectorEndColor: "#3584e4",
    // Defaults for new settings
    scrollSpeed: 14,
    scrollDelay: 1500,
    scrollStep: 1,
    backlightOnHold: 'normal',
    palette: ['#3584e4', '#e01b24', '#33d17a', '#f66151', '#ffffff', '#000000']
  },
  selectedElementIds: [],
  assets: {},
  elements: [
    // --- WPS ELEMENTS ---
    
    // NOTE: Default Status Bar elements removed.
    // The System Status Bar is now handled by the Global Setting "statusBarTop: true"
    // which renders the <SystemOverlay /> in EditorCanvas.

    // Album Art (Rounded, centered-ish vertical)
    {
      id: 'album-art',
      name: 'Album Art',
      type: ElementType.IMAGE,
      screen: 'wps',
      x: 10, y: 40, width: 140, height: 140,
      visible: true, locked: false,
      category: 'art',
      src: '',
      filename: 'cover_placeholder.bmp',
      imageType: 'static'
    },

    // Metadata Group (Right side)
    {
      id: 'title-txt',
      name: 'Title',
      type: ElementType.TEXT,
      screen: 'wps',
      x: 160, y: 60, width: 150, height: 20,
      visible: true, locked: false,
      category: 'id3',
      content: "%s",
      fontId: "16-Terminus.fnt",
      align: "left",
      color: "#FFFFFF",
      scroll: true
    },
    {
      id: 'artist-txt',
      name: 'Artist',
      type: ElementType.TEXT,
      screen: 'wps',
      x: 160, y: 85, width: 150, height: 18,
      visible: true, locked: false,
      category: 'id3',
      content: "%a",
      fontId: "14-Nimbus.fnt",
      align: "left",
      color: "#aaaaaa",
      scroll: true
    },
    {
      id: 'album-txt',
      name: 'Album',
      type: ElementType.TEXT,
      screen: 'wps',
      x: 160, y: 105, width: 150, height: 18,
      visible: true, locked: false,
      category: 'id3',
      content: "%id",
      fontId: "14-Nimbus.fnt",
      align: "left",
      color: "#666666",
      scroll: true
    },

    // Technical Info (Bitrate/Format)
    {
        id: 'tech-info',
        name: 'Tech Info',
        type: ElementType.TEXT,
        screen: 'wps',
        x: 160, y: 150, width: 150, height: 14,
        visible: true, locked: false,
        category: 'file',
        content: "%fc %fbkbps",
        fontId: "12-Sys-Fixed.fnt",
        align: "left",
        color: "#444444"
    },

    // Progress Bar Area
    {
        id: 'pb-time-curr',
        name: 'Time Elapsed',
        type: ElementType.TEXT,
        screen: 'wps',
        x: 10, y: 200, width: 50, height: 14,
        visible: true, locked: false,
        category: 'playlist_info',
        content: "%pc",
        fontId: "12-Sys-Fixed.fnt",
        align: "left",
        color: "#888888"
    },
    {
        id: 'pb-time-rem',
        name: 'Time Remain',
        type: ElementType.TEXT,
        screen: 'wps',
        x: 260, y: 200, width: 50, height: 14,
        visible: true, locked: false,
        category: 'playlist_info',
        content: "%pr",
        fontId: "12-Sys-Fixed.fnt",
        align: "right",
        color: "#888888"
    },
    {
      id: 'pb',
      name: 'Progress Bar',
      type: ElementType.PROGRESS_BAR,
      screen: 'wps',
      x: 10, y: 215, width: 300, height: 6,
      visible: true, locked: false,
      category: 'default',
      foreColor: "#3584e4",
      backColor: "#333333",
      pbMode: 'track',
      pbStyle: 'flat'
    },

    // --- SBS ELEMENTS ---
    {
      id: 'sbs-bg',
      name: 'Header BG',
      type: ElementType.RECT,
      screen: 'sbs',
      x: 0, y: 0, width: 320, height: 24,
      visible: true, locked: true,
      category: 'default',
      color: "#2d2d2d"
    },
    {
      id: 'sbs-title',
      name: 'Menu Title',
      type: ElementType.TEXT,
      screen: 'sbs',
      x: 10, y: 4, width: 300, height: 20,
      visible: true, locked: false,
      category: 'default',
      content: "Rockbox",
      fontId: "14-Nimbus.fnt",
      align: "center",
      color: "#ffffff"
    },
    {
      id: 'sbs-batt',
      name: 'Batt',
      type: ElementType.TEXT,
      screen: 'sbs',
      x: 270, y: 4, width: 40, height: 16,
      visible: true, locked: false,
      content: '%bl%%',
      fontId: '12-Sys-Fixed.fnt',
      align: 'right',
      color: '#ffffff'
    },
    {
      id: 'sbs-vp',
      name: 'List Viewport',
      type: ElementType.VIEWPORT,
      screen: 'sbs',
      x: 0, y: 24, width: 320, height: 216,
      visible: true, locked: true,
      category: 'viewport',
    } as any,

    // --- FMS ELEMENTS ---
    {
      id: 'fms-bg',
      name: 'Radio BG',
      type: ElementType.RECT,
      screen: 'fms',
      x: 0, y: 0, width: 320, height: 240,
      visible: true, locked: true,
      color: "#1a1a1a"
    },
    {
        id: 'fms-freq',
        name: 'Frequency',
        type: ElementType.TEXT,
        screen: 'fms',
        x: 0, y: 80, width: 320, height: 40,
        visible: true, locked: false,
        content: '%tf',
        fontId: '24-Rockfont.fnt',
        align: 'center',
        color: '#3584e4'
    },
    {
        id: 'fms-info',
        name: 'Station Info',
        type: ElementType.TEXT,
        screen: 'fms',
        x: 0, y: 130, width: 320, height: 20,
        visible: true, locked: false,
        content: '%ti - %ts',
        fontId: '14-Nimbus.fnt',
        align: 'center',
        color: '#ffffff'
    },

    // --- USB ELEMENTS ---
     {
      id: 'usb-bg',
      name: 'USB BG',
      type: ElementType.RECT,
      screen: 'usb',
      x: 0, y: 0, width: 320, height: 240,
      visible: true, locked: true,
      color: "#000000"
    },
    {
        id: 'usb-icon',
        name: 'USB Icon',
        type: ElementType.IMAGE,
        screen: 'usb',
        x: 110, y: 70, width: 100, height: 100,
        visible: true, locked: false,
        src: createAsset(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
            <g stroke="#ffffff" stroke-width="5" stroke-linecap="round">
                <line x1="50" y1="95" x2="50" y2="55"/>
                <line x1="50" y1="55" x2="20" y2="35"/>
                <line x1="50" y1="55" x2="80" y2="35"/>
                <line x1="50" y1="55" x2="50" y2="25"/>
            </g>
            <path d="M50 10 L38 28 L62 28 Z" fill="#ffffff"/>
            <circle cx="20" cy="35" r="6" fill="#ffffff"/>
            <rect x="74" y="29" width="12" height="12" fill="#ffffff"/>
            <circle cx="50" cy="55" r="4" fill="#ffffff"/>
        </svg>`),
        filename: 'usb_mode.bmp'
    },
    {
        id: 'usb-text',
        name: 'Disk Mode',
        type: ElementType.TEXT,
        screen: 'usb',
        x: 0, y: 180, width: 320, height: 30,
        visible: true, locked: false,
        content: 'DISK MODE',
        fontId: '20-Nimbus.fnt',
        align: 'center',
        color: '#ffffff'
    }
  ]
};
