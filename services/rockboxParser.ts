import { ProjectState, ElementType, WpsElement, ScreenType, ImageElement, TextElement, RectElement, ProgressBarElement } from '../types';
import { DEFAULT_PROJECT } from '../constants';

// --- Types ---
interface Viewport {
    id?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontId?: string;
    fg?: string;
    bg?: string;
}

interface PreloadInfo {
    filename: string;
    x: number;
    y: number;
    count: number;
}

interface ParserContext {
    screen: ScreenType;
    activeViewport: Viewport;
    logicalViewports: Record<string, Viewport>; // Map ID -> Viewport
    fontSlots: Record<string, string>; // Map ID -> FontFilename
    preloadMap: Record<string, PreloadInfo>; // Map Handle -> Info
    
    // Current Styling State (inherited from viewport or overrides)
    currentFontId: string;
    currentFg: string;
    currentBg: string;
    currentAlign: 'left' | 'center' | 'right';
}

// --- Helpers ---
const toCssHex = (hex: string) => {
    if (!hex) return '#000000';
    const clean = hex.replace(/^0x/, '').replace(/[^0-9A-Fa-f]/g, '');
    if (clean.length === 6) return `#${clean}`;
    if (clean.length === 3) return `#${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`;
    return '#000000';
};

const blobToDataURL = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(blob);
    });
};

const genId = () => Math.random().toString(36).substr(2, 9);

// Default USB Icon SVG (Base64) - Matches Rockbox classic pixel art style
const USB_ICON_SVG = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect x="35" y="20" width="30" height="40" fill="#ffffff" />
<path d="M35 20 L50 5 L65 20 Z" fill="#ffffff" />
<circle cx="42" cy="35" r="4" fill="#000000"/>
<circle cx="50" cy="50" r="4" fill="#000000"/>
<rect x="54" y="31" width="8" height="8" fill="#000000"/>
<rect x="48" y="60" width="4" height="30" fill="#ffffff"/>
<circle cx="50" cy="92" r="4" fill="#ffffff"/>
<path d="M30 65 L40 65 L35 75 Z" fill="#ffffff"/> 
<path d="M60 65 L70 65 L65 75 Z" fill="#ffffff"/>
</svg>`)}`;

// --- Main Parser Service ---

export const parseZipTheme = async (file: File): Promise<ProjectState | null> => {
    // @ts-ignore
    if (typeof JSZip === 'undefined') {
        console.error("JSZip not loaded");
        return null;
    }

    // @ts-ignore
    const zip = new JSZip();
    try {
        const loadedZip = await zip.loadAsync(file);
        
        // 1. Find .cfg file
        const cfgFile = Object.values(loadedZip.files).find((f: any) => f.name.endsWith('.cfg') && !f.name.startsWith('__MACOSX'));
        if (!cfgFile) throw new Error("No .cfg file found");

        const cfgContent = await (cfgFile as any).async('string');
        
        // 2. Parse CFG settings
        const settings = { ...DEFAULT_PROJECT.settings };
        let wpsPath = '';
        let sbsPath = '';
        
        // Basic normalization
        const lines = cfgContent.replace(/\r\n/g, '\n').split('\n');
        
        lines.forEach((line: string) => {
            // Handle comments
            const cleanLine = line.split('#')[0].trim();
            if(!cleanLine) return;

            const parts = cleanLine.split(':');
            if (parts.length < 2) return;
            const key = parts[0].trim().toLowerCase();
            const val = parts.slice(1).join(':').trim(); 
            
            if (key === 'background color') settings.backgroundColor = toCssHex(val);
            if (key === 'foreground color') settings.foregroundColor = toCssHex(val);
            if (key === 'wps') wpsPath = val; 
            if (key === 'sbs') sbsPath = val;
            if (key === 'backdrop') settings.backdrop = val.split('/').pop();
            if (key === 'statusbar') settings.statusBarTop = val === 'top';
            if (key === 'font') settings.uiFont = val.split('/').pop() || '14-Nimbus.fnt';
        });

        settings.name = (cfgFile as any).name.replace('.cfg', ''); 

        // 3. Extract Assets
        const assets: Record<string, string> = {};
        const imageFiles = Object.values(loadedZip.files).filter((f: any) => 
            !f.dir && !f.name.startsWith('__MACOSX') &&
            (f.name.match(/\.(bmp|png|jpg|jpeg|fnt)$/i))
        );

        for (const imgFile of imageFiles) {
            const blob = await (imgFile as any).async('blob');
            const dataUrl = await blobToDataURL(blob);
            const fullPath = (imgFile as any).name; 
            const fileName = fullPath.split('/').pop(); 
            
            if (fileName) assets[fileName.toLowerCase()] = dataUrl;
            
            // Store normalized path (remove .rockbox prefix)
            const normalizedPath = fullPath.toLowerCase().replace(/\\/g, '/');
            assets[normalizedPath] = dataUrl;
            // Also store without the leading /.rockbox/ if present
            if (normalizedPath.includes('.rockbox/')) {
                assets[normalizedPath.split('.rockbox/')[1]] = dataUrl;
            }
        }

        const elements: WpsElement[] = [];

        // Helper to resolve asset
        const resolveAsset = (path: string): { src: string, filename: string } | null => {
            if (!path) return null;
            const rawName = path.split('/').pop() || '';
            const key = rawName.toLowerCase();
            
            // 1. Direct filename match
            if (assets[key]) return { src: assets[key], filename: rawName };
            
            // 2. Full path match (normalized)
            const normPath = path.toLowerCase().replace(/\\/g, '/').replace(/^\//, '');
            // Try matching against keys in assets
            const exactMatch = Object.keys(assets).find(k => k.endsWith(normPath) || normPath.endsWith(k));
            if (exactMatch) return { src: assets[exactMatch], filename: rawName };

            return null;
        };

        // --- PARSER ENGINE ---
        
        const parseScreen = (rawContent: string, screen: ScreenType) => {
            const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, width: 320, height: 240 };
            
            // Pre-process: Remove lines starting with # (Comments)
            // Rockbox also supports inline comments like % #, but full line # are most common for text labels issues
            const content = rawContent.split('\n')
                .filter(line => !line.trim().startsWith('#'))
                .join('\n');

            const context: ParserContext = {
                screen,
                activeViewport: { ...DEFAULT_VIEWPORT },
                logicalViewports: {},
                fontSlots: {},
                preloadMap: {},
                currentFontId: settings.uiFont,
                currentFg: settings.foregroundColor,
                currentBg: settings.backgroundColor,
                currentAlign: 'center' // Default alignment
            };

            let cursor = 0;
            const length = content.length;

            const readArgs = (): string[] => {
                if (cursor >= length) return [];
                const startChar = content[cursor];
                if (startChar !== '(' && startChar !== '|') return []; // Not arguments
                
                cursor++; // skip opener
                const endChar = startChar === '(' ? ')' : '|';
                
                const start = cursor;
                let depth = 1;
                
                while (cursor < length) {
                    if (content[cursor] === startChar) depth++;
                    else if (content[cursor] === endChar) {
                        depth--;
                        if (depth === 0) break;
                    }
                    cursor++;
                }
                
                const argStr = content.substring(start, cursor);
                cursor++; // skip closer
                return argStr.split(',').map(s => s.trim());
            };

            const parseConditional = (): string[] => {
                const branches: string[] = [];
                let depth = 0;
                let lastSplit = cursor;
                while (cursor < length) {
                    const char = content[cursor];
                    if (char === '<') depth++;
                    else if (char === '>') {
                        if (depth === 0) {
                            branches.push(content.substring(lastSplit, cursor));
                            cursor++;
                            return branches;
                        }
                        depth--;
                    }
                    else if (char === '|' && depth === 0) {
                        branches.push(content.substring(lastSplit, cursor));
                        lastSplit = cursor + 1;
                    }
                    cursor++;
                }
                return branches;
            };

            const internalParse = (input: string) => {
                let i = 0; 
                const len = input.length;
                
                const readLocalArgs = (): string[] => {
                    if (i >= len) return [];
                    const startChar = input[i];
                    if (startChar !== '(' && startChar !== '|') return [];
                    
                    i++; 
                    const endChar = startChar === '(' ? ')' : '|';
                    const start = i;
                    let depth = 1;
                    while (i < len) {
                        if (input[i] === startChar) depth++;
                        else if (input[i] === endChar) {
                            depth--;
                            if (depth === 0) break;
                        }
                        i++;
                    }
                    const argStr = input.substring(start, i);
                    i++; 
                    return argStr.split(',').map(s => s.trim());
                };

                const parseLocalConditional = (): string[] => {
                    const branches: string[] = [];
                    let depth = 0;
                    let lastSplit = i;
                    while (i < len) {
                        const char = input[i];
                        if (char === '<') depth++;
                        else if (char === '>') {
                            if (depth === 0) {
                                branches.push(input.substring(lastSplit, i));
                                i++; return branches;
                            }
                            depth--;
                        }
                        else if (char === '|' && depth === 0) {
                            branches.push(input.substring(lastSplit, i));
                            lastSplit = i + 1;
                        }
                        i++;
                    }
                    return branches;
                };

                while (i < len) {
                    const char = input[i];

                    if (char === '%') {
                        i++;
                        if (i >= len) break;
                        const tag = input[i];

                        // 1. ESCAPE / COMMENT
                        if (tag === '%') { i++; continue; } 
                        if (tag === '#') {
                            const nextLine = input.indexOf('\n', i);
                            i = nextLine === -1 ? len : nextLine + 1;
                            continue;
                        }

                        // NEW: %wd (Disable Status Bar)
                        if (tag === 'w') {
                            if (input[i+1] === 'd') {
                                i += 2;
                                if (screen === 'wps') {
                                    settings.statusBarTop = false;
                                }
                                continue;
                            }
                        }

                        // 2. TOUCH REGIONS (%T)
                        if (tag === 'T') {
                            i++;
                            const args = readLocalArgs();
                            if (args.length >= 5) {
                                elements.push({
                                    id: genId(),
                                    name: `Touch: ${args[4]}`,
                                    type: ElementType.TOUCH_REGION,
                                    screen: context.screen,
                                    x: parseInt(args[0]),
                                    y: parseInt(args[1]),
                                    width: parseInt(args[2]),
                                    height: parseInt(args[3]),
                                    touchAction: args[4],
                                    visible: true, locked: false,
                                    color: 'rgba(255, 0, 0, 0.1)'
                                } as unknown as RectElement);
                            }
                            continue;
                        }

                        // 3. PROGRESS BARS (%pb / %pv with image)
                        if (input.startsWith('pb', i) || input.startsWith('pv', i)) {
                             const isVolume = input.startsWith('pv', i);
                             if (i + 2 < len && input[i+2] === '(') {
                                 i += 2;
                                 const args = readLocalArgs();
                                 if (args.length >= 4) {
                                     const imgArg = args[4] && args[4] !== '-' ? args[4] : undefined;
                                     const pbEl: ProgressBarElement = {
                                         id: genId(),
                                         name: isVolume ? 'Volume Bar' : 'Progress Bar',
                                         type: ElementType.PROGRESS_BAR,
                                         screen: context.screen,
                                         x: context.activeViewport.x + parseInt(args[0]),
                                         y: context.activeViewport.y + parseInt(args[1]),
                                         width: parseInt(args[2]),
                                         height: parseInt(args[3]),
                                         visible: true, locked: false,
                                         foreColor: context.currentFg,
                                         backColor: context.currentBg,
                                         pbMode: isVolume ? 'volume' : 'track',
                                         pbStyle: imgArg ? 'image' : 'flat'
                                     };
                                     
                                     if (imgArg) {
                                         const asset = resolveAsset(imgArg);
                                         if (asset) pbEl.backgroundImage = asset.src;
                                     }
                                     elements.push(pbEl);
                                 }
                                 continue;
                             }
                        }

                        // 4. VIEWPORTS (%V)
                        if (tag === 'V') {
                            i++;
                            const subTag = input[i];

                            if (subTag === 'i') {
                                i++; 
                                const args = readLocalArgs();
                                if (args.length >= 4) {
                                    elements.push({
                                        id: genId(),
                                        name: 'Menu Viewport',
                                        type: ElementType.VIEWPORT,
                                        screen: context.screen,
                                        x: parseInt(args[0]) || 0,
                                        y: parseInt(args[1]) || 0,
                                        width: parseInt(args[2]) || 320,
                                        height: parseInt(args[3]) || 240,
                                        visible: true, locked: true
                                    });
                                }
                                continue;
                            }
                            
                            if (subTag === 'l') {
                                i++; 
                                const args = readLocalArgs();
                                if (args.length >= 5) {
                                    const vId = args[0];
                                    const newVp: Viewport = {
                                        id: vId,
                                        x: parseInt(args[1]) || 0,
                                        y: parseInt(args[2]) || 0,
                                        width: parseInt(args[3]) || 320,
                                        height: parseInt(args[4]) || 240,
                                        fontId: args[5] !== '-' ? args[5] : undefined
                                    };
                                    context.logicalViewports[vId] = newVp;
                                    context.activeViewport = newVp;
                                    if (newVp.fontId) {
                                        if (context.fontSlots[newVp.fontId]) context.currentFontId = context.fontSlots[newVp.fontId];
                                        else context.currentFontId = newVp.fontId;
                                    }
                                }
                                continue;
                            }

                            if (subTag === 'd') {
                                i++;
                                const args = readLocalArgs();
                                if (args.length > 0) {
                                    const vId = args[0];
                                    if (context.logicalViewports[vId]) {
                                        context.activeViewport = context.logicalViewports[vId];
                                        if (context.activeViewport.fontId) {
                                             if (context.fontSlots[context.activeViewport.fontId]) {
                                                 context.currentFontId = context.fontSlots[context.activeViewport.fontId];
                                             } else {
                                                 context.currentFontId = context.activeViewport.fontId;
                                             }
                                        }
                                    } else {
                                        context.activeViewport = { ...DEFAULT_VIEWPORT };
                                    }
                                } else {
                                    context.activeViewport = { ...DEFAULT_VIEWPORT };
                                }
                                continue;
                            }

                            if (subTag === '(') {
                                const args = readLocalArgs();
                                if (args.length >= 4) {
                                    context.activeViewport = {
                                        x: parseInt(args[0]) || 0,
                                        y: parseInt(args[1]) || 0,
                                        width: parseInt(args[2]) || 320,
                                        height: parseInt(args[3]) || 240,
                                        fontId: args[4] !== '-' ? args[4] : undefined
                                    };
                                    if (context.activeViewport.fontId) {
                                         if(context.fontSlots[context.activeViewport.fontId]) {
                                             context.currentFontId = context.fontSlots[context.activeViewport.fontId];
                                         } else {
                                             context.currentFontId = context.activeViewport.fontId;
                                         }
                                    }
                                }
                                continue;
                            }
                            
                            if (subTag === 'f') { i++; const a=readLocalArgs(); if(a[0]) context.currentFg = toCssHex(a[0]); continue; }
                            if (subTag === 'b') { i++; const a=readLocalArgs(); if(a[0]) context.currentBg = toCssHex(a[0]); continue; }
                        }

                        // 5. FONT LOADING (%Fl)
                        if (tag === 'F' && input[i+1] === 'l') {
                            i += 2;
                            const args = readLocalArgs();
                            if (args.length >= 2) {
                                context.fontSlots[args[0]] = args[1]; // Slot -> Filename
                            }
                            continue;
                        }

                        // 6. ALIGNMENT
                        if (input.startsWith('ac', i)) { context.currentAlign = 'center'; i+=2; continue; }
                        if (input.startsWith('al', i)) { context.currentAlign = 'left'; i+=2; continue; }
                        if (input.startsWith('ar', i)) { context.currentAlign = 'right'; i+=2; continue; }

                        // 7. IMAGES (%x / %X)
                        if (tag === 'x' || tag === 'X') {
                            const isBackdrop = (tag === 'X');
                            i++;
                            let filename = '';
                            let isPreloaded = false;
                            let spriteConfig = undefined;

                            if (tag === 'x' && input[i] === 'l') {
                                i++;
                                const args = readLocalArgs();
                                if (args.length >= 2) {
                                    const handle = args[0];
                                    const fname = args[1];
                                    const xOff = parseInt(args[2] || '0');
                                    const yOff = parseInt(args[3] || '0');
                                    const count = parseInt(args[4] || '1');
                                    context.preloadMap[handle] = { 
                                        filename: fname, 
                                        x: xOff, 
                                        y: yOff,
                                        count: count 
                                    };
                                }
                                continue;
                            }

                            if (tag === 'x' && input[i] === 'd') {
                                i++;
                                const args = readLocalArgs();
                                if (args.length >= 1) {
                                    const rawHandle = args[0]; 
                                    if (context.preloadMap[rawHandle]) {
                                        const meta = context.preloadMap[rawHandle];
                                        filename = meta.filename;
                                        isPreloaded = true;
                                        
                                        if (meta.count > 1 || meta.x > 0 || meta.y > 0) {
                                            spriteConfig = {
                                                offsetX: meta.x,
                                                offsetY: meta.y,
                                                count: meta.count
                                            };
                                        }
                                    }
                                }
                            }
                            else {
                                const args = readLocalArgs();
                                if (args.length > 0) {
                                    filename = args[0];
                                }
                            }

                            if (filename) {
                                if (isBackdrop) {
                                    const asset = resolveAsset(filename);
                                    if (asset) settings.backdrop = asset.filename;
                                } else {
                                    const asset = resolveAsset(filename);
                                    elements.push({
                                        id: genId(),
                                        name: filename,
                                        type: ElementType.IMAGE,
                                        screen: context.screen,
                                        x: context.activeViewport.x,
                                        y: context.activeViewport.y,
                                        width: context.activeViewport.width,
                                        height: context.activeViewport.height,
                                        visible: true, locked: false,
                                        src: asset ? asset.src : '',
                                        filename: filename,
                                        spriteConfig: spriteConfig
                                    });
                                }
                            }
                            continue;
                        }

                        // 8. ALBUM ART
                        if (tag === 'C') {
                            i++;
                            if (input[i] === 'l') { i++; readLocalArgs(); continue; }
                            if (input[i] === 'd') {
                                i++;
                                elements.push({
                                    id: genId(),
                                    name: 'Album Art',
                                    type: ElementType.IMAGE,
                                    screen: context.screen,
                                    x: context.activeViewport.x,
                                    y: context.activeViewport.y,
                                    width: context.activeViewport.width,
                                    height: context.activeViewport.height,
                                    visible: true, locked: false,
                                    src: '', 
                                    filename: 'cover_placeholder.bmp',
                                    category: 'art'
                                });
                                continue;
                            }
                        }

                        // 9. CONDITIONALS
                        if (tag === '?') {
                            i++;
                            const tagStart = i;
                            while (i < len && input[i] !== '<') i++;
                            const tagName = input.substring(tagStart, i);
                            
                            if (input[i] === '<') {
                                i++;
                                const branches = parseLocalConditional();
                                let selectedIndex = 0;
                                if (branches.length > 1) {
                                    // Heuristic: Pick "Middle" state for sliders (vol, batt) to show content
                                    if (tagName === 'bl' || tagName === 'pv') {
                                        selectedIndex = Math.floor(branches.length / 2);
                                    }
                                    else if (!branches[0].trim() && branches[1].trim()) selectedIndex = 1;
                                    else if (tagName === 'mp') selectedIndex = 1; // Play
                                    else if (tagName === 'C') selectedIndex = 1; // Has Art
                                    else if (tagName === 'ps') selectedIndex = 1; // Shuffle On
                                }
                                if (branches[selectedIndex]) {
                                    internalParse(branches[selectedIndex]);
                                }
                            }
                            continue;
                        }
                        
                        // 10. TAGS
                        const validTags = ['s', 'a', 'id', 'it', 'ia', 'in', 'ig', 'iv', 'iy', 'ik', 'fc', 'fb', 'fn', 'fp', 'fz', 'pc', 'pt', 'pr', 'pp', 'pe', 'bl', 'bv', 'bt', 'pv', 'cH', 'cM', 'cl', 'cP', 'cp', 'ca', 'cd', 'cb', 'cY', 'rp', 'rr', 'Rg', 'tf', 'ti', 'ts'];
                        let matchedTag = '';
                        for (const t of validTags) {
                             if (input.startsWith(t, i)) {
                                 matchedTag = t;
                                 break;
                             }
                        }
                        
                        if (matchedTag) {
                             elements.push({
                                 id: genId(),
                                 name: `Text ${matchedTag}`,
                                 type: ElementType.TEXT,
                                 screen: context.screen,
                                 x: context.activeViewport.x,
                                 y: context.activeViewport.y,
                                 width: context.activeViewport.width,
                                 height: 20, 
                                 visible: true, locked: false,
                                 content: `%${matchedTag}`,
                                 fontId: context.currentFontId,
                                 align: context.currentAlign,
                                 color: context.currentFg,
                                 scroll: matchedTag === 's'
                             });
                             i += matchedTag.length;
                             continue;
                        }
                        
                        // 11. Alternating Text
                        if (tag === 't') {
                             i++;
                             readLocalArgs();
                             continue;
                        }
                    }

                    // FALLBACK: PLAIN TEXT
                    const nextPct = input.indexOf('%', i);
                    const nextLine = input.indexOf('\n', i);
                    let end = len;
                    if (nextPct !== -1) end = nextPct;
                    if (nextLine !== -1 && nextLine < end) end = nextLine;
                    
                    if (end > i) {
                        const text = input.substring(i, end);
                        if (text.trim()) {
                             const cleanText = text.replace(/^;/, '');
                             if(cleanText.trim()) {
                                 elements.push({
                                     id: genId(),
                                     name: 'Label',
                                     type: ElementType.TEXT,
                                     screen: context.screen,
                                     x: context.activeViewport.x,
                                     y: context.activeViewport.y,
                                     width: context.activeViewport.width,
                                     height: 20,
                                     visible: true, locked: false,
                                     content: cleanText.trim(),
                                     fontId: context.currentFontId,
                                     align: context.currentAlign,
                                     color: context.currentFg
                                 });
                             }
                        }
                        i = end;
                    } else {
                        i++;
                    }
                }
            };
            
            internalParse(content);
        };

        const loadFile = async (path: string): Promise<string> => {
            if (!path || path === '-') return '';
            const normalized = path.replace(/^\//, '').replace(/\\/g, '/');
            let f = loadedZip.file(normalized);
            if (!f) {
                const name = normalized.split('/').pop();
                if (name) f = Object.values(loadedZip.files).find((o: any) => o.name.toLowerCase().endsWith(name.toLowerCase()) && !o.name.startsWith('__MACOSX'));
            }
            if (!f) return '';
            const raw = await (f as any).async('string');
            return raw;
        };

        const wpsContent = await loadFile(wpsPath);
        if (wpsContent) parseScreen(wpsContent, 'wps');

        const sbsContent = await loadFile(sbsPath);
        if (sbsContent) parseScreen(sbsContent, 'sbs');
        
        // Post-Processing
        const usbElements = elements.filter(e => e.screen === 'usb');
        if (usbElements.length === 0) {
            elements.push(
                { id: genId(), name: 'USB BG', type: ElementType.RECT, screen: 'usb', x: 0, y: 0, width: 320, height: 240, visible: true, locked: true, color: '#000000' },
                { id: genId(), name: 'USB Icon', type: ElementType.IMAGE, screen: 'usb', x: 110, y: 70, width: 100, height: 100, visible: true, locked: false, src: USB_ICON_SVG, filename: 'usb_mode.bmp' },
                { id: genId(), name: 'Disk Mode', type: ElementType.TEXT, screen: 'usb', x: 0, y: 180, width: 320, height: 30, visible: true, locked: false, content: 'DISK MODE', fontId: settings.uiFont, align: 'center', color: '#FFFFFF' }
            );
        }

        const sbsElements = elements.filter(e => e.screen === 'sbs');
        const hasViewport = sbsElements.some(e => e.type === ElementType.VIEWPORT);
        if (sbsElements.length > 0 && !hasViewport) {
            elements.push({
                id: genId(),
                name: 'Menu Viewport',
                type: ElementType.VIEWPORT,
                screen: 'sbs',
                x: 0, y: 24, width: 320, height: 216,
                visible: true, locked: true
            });
        }

        return {
            settings,
            elements,
            assets,
            selectedElementIds: []
        };

    } catch (e) {
        console.error("Failed to parse zip", e);
        return null;
    }
};