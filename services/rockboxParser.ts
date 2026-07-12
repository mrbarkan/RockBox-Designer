
import JSZip from 'jszip';
import { ProjectState, ElementType, WpsElement, ScreenType, ImageElement, TextElement, RectElement, ProgressBarElement, RockboxAstDocument } from '../types';
import { RockboxDocument } from '../rockbox/syntax';
import { importThemePackage } from '../rockbox/packages';
import { DEFAULT_PROJECT } from '../constants';
import { parseRockboxForLegacyConsumer } from './rockboxSyntaxAdapter';

interface ParserContext {
    screen: ScreenType;
    activeViewport: { x:number, y:number, width:number, height:number };
    namedViewports: Record<string, { x:number, y:number, width:number, height:number }>;
    fontSlots: Record<string, string>; 
    preloadMap: Record<string, any>; 
    currentFontId: string;
    currentFg: string;
    currentBg: string;
    currentAlign: 'left' | 'center' | 'right';
    lineIndex: number;
    lineHeight: number;
    albumArtRect?: { x:number, y:number, width:number, height:number };
    
    // Phase 3: Logic Stack
    conditionStack: string[]; 
}

const genId = () => Math.random().toString(36).substr(2, 9);
const toCssHex = (hex: string) => hex ? '#' + hex.replace(/^0x/, '').replace(/[^0-9A-Fa-f]/g, '') : '#000000';

const USB_ICON_SVG = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="35" y="20" width="30" height="40" fill="#ffffff" /><path d="M35 20 L50 5 L65 20 Z" fill="#ffffff" /><circle cx="42" cy="35" r="4" fill="#000000"/><circle cx="50" cy="50" r="4" fill="#000000"/><rect x="54" y="31" width="8" height="8" fill="#000000"/><rect x="48" y="60" width="4" height="30" fill="#ffffff"/><circle cx="50" cy="92" r="4" fill="#ffffff"/><path d="M30 65 L40 65 L35 75 Z" fill="#ffffff"/><path d="M60 65 L70 65 L65 75 Z" fill="#ffffff"/></svg>`)}`;

export const parseZipTheme = async (file: File): Promise<ProjectState | null> => {
    try {
        const [loadedZip, themePackage] = await Promise.all([
            JSZip.loadAsync(file),
            importThemePackage(file)
        ]);
        const assets: Record<string, string> = {};
        const warnings: string[] = themePackage.diagnostics.map(diagnostic => diagnostic.message);
        const elements: WpsElement[] = [];

        // --- Helper: File Loading ---
        const blobToDataURL = (blob: Blob): Promise<string> => new Promise(resolve => {
            const r = new FileReader(); r.onload = e => resolve(e.target?.result as string); r.readAsDataURL(blob);
        });

        // --- 1. Load Assets ---
        const imageFiles = Object.values(loadedZip.files).filter((f: any) => !f.dir && !f.name.startsWith('__MACOSX') && f.name.match(/\.(bmp|png|jpg|jpeg|fnt)$/i));
        const normalizeAssetKey = (path: string) => path.toLowerCase().replace(/\\/g, '/');
        const assetBaseName = (path: string) => normalizeAssetKey(path).split('/').pop() || '';

        for (const f of imageFiles) {
            const blob = await (f as any).async('blob');
            const dataUrl = await blobToDataURL(blob);
            const name = (f as any).name;
            const baseName = assetBaseName(name);
            if (baseName) {
                assets[baseName] = dataUrl;
            }
        }

        const resolveAsset = (path: string) => {
            if (!path || path === '-') return null;
            const key = normalizeAssetKey(path);
            const baseName = assetBaseName(path);
            if (assets[baseName]) {
                return { src: assets[baseName], filename: baseName };
            }
            const foundKey = Object.keys(assets).find(k => k.endsWith(baseName) || baseName.endsWith(k));
            return foundKey ? { src: assets[foundKey], filename: foundKey.split('/').pop() || foundKey } : null;
        };

        // --- 2. Load CFG ---
        const cfgFile = Object.values(loadedZip.files).find((f: any) => f.name.endsWith('.cfg') && !f.name.startsWith('__MACOSX'));
        if (!cfgFile) throw new Error("No .cfg found");
        const cfgContent = await (cfgFile as any).async('string');
        
        const cfgBaseName = assetBaseName((cfgFile as any).name).replace(/\.cfg$/i, '');
        const settings = { ...DEFAULT_PROJECT.settings, name: cfgBaseName };
        let wpsPath = '', sbsPath = '';

        cfgContent.split('\n').forEach(line => {
            const [key, ...valParts] = line.split('#')[0].split(':');
            if (!valParts.length) return;
            const k = key.trim().toLowerCase();
            const v = valParts.join(':').trim();
            if (k === 'wps') wpsPath = v;
            if (k === 'sbs') sbsPath = v;
            if (k === 'backdrop') settings.backdrop = assetBaseName(v);
            if (k === 'background color') settings.backgroundColor = toCssHex(v);
            if (k === 'foreground color') settings.foregroundColor = toCssHex(v);
            if (k === 'statusbar') settings.statusBarTop = v === 'top';
            if (k === 'font') settings.uiFont = assetBaseName(v) || '14-Nimbus.fnt';
        });

        // --- 3. Parser ---
        const parseScreen = (raw: string, screen: ScreenType) => {
            const context: ParserContext = {
                screen,
                activeViewport: { x: 0, y: 0, width: 320, height: 240 },
                namedViewports: {},
                fontSlots: {},
                preloadMap: {},
                currentFontId: settings.uiFont,
                currentFg: settings.foregroundColor,
                currentBg: settings.backgroundColor,
                currentAlign: 'center',
                lineIndex: 0,
                lineHeight: 14,
                conditionStack: []
            };

            const getFontSize = (fontId: string) => {
                const match = fontId.match(/^(\d+)-/);
                return match ? parseInt(match[1], 10) : 14;
            };

            const updateLineMetrics = () => {
                context.lineHeight = Math.max(10, getFontSize(context.currentFontId) + 2);
            };

            updateLineMetrics();

            const internalParse = (text: string) => {
                let i = 0;
                const end = text.length;

                // Local helper to read args inside internalParse
                const readLocalArgs = () => {
                    if (i >= end || (text[i] !== '(' && text[i] !== '|')) return [];
                    i++; const closer = text[i-1] === '(' ? ')' : '|';
                    let start = i, depth = 1;
                    while (i < end) {
                        if (text[i] === text[start-1]) depth++;
                        else if (text[i] === closer) { depth--; if (depth === 0) break; }
                        i++;
                    }
                    const res = text.substring(start, i).split(',').map(s => s.trim());
                    i++; return res;
                };

                while (i < end) {
                    if (text[i] !== '%') { 
                         // Plain text accumulation could go here, skipping for brevity in this complex logic
                         i++; continue; 
                    }
                    i++; // skip %
                    const tag = text[i];
                    
                    // ESCAPE
                    if (tag === '%') { i++; continue; }
                    
                    // CONDITIONALS
                    if (tag === '?') {
                        i++;
                        const tagStart = i;
                        while(i < end && text[i] !== '<') i++;
                        const tagName = text.substring(tagStart, i);
                        
                        if (text[i] === '<') {
                            i++;
                            // Split branches
                            const branches: string[] = [];
                            let bStart = i, depth = 0;
                            while(i < end) {
                                if (text[i] === '<') depth++;
                                else if (text[i] === '>') {
                                    if (depth === 0) { branches.push(text.substring(bStart, i)); break; }
                                    depth--;
                                } else if (text[i] === '|' && depth === 0) {
                                    branches.push(text.substring(bStart, i));
                                    bStart = i + 1;
                                }
                                i++;
                            }
                            i++; // skip >

                            // RECURSIVE DESCENT FOR ALL BRANCHES
                            branches.forEach((branchContent, branchIdx) => {
                                // Push logic: "tagName:branchIdx"
                                context.conditionStack.push(`${tagName}:${branchIdx}`);
                                internalParse(branchContent); // Recurse
                                context.conditionStack.pop();
                            });
                            continue;
                        }
                    }

                    // IMAGES (%x, %X)
                    if (tag === 'x' || tag === 'X') {
                        const isBackdrop = tag === 'X';
                        i++;
                        
                        if (tag === 'x' && text[i] === 'l') { // Preload
                            i++; const args = readLocalArgs();
                            if (args[0]) context.preloadMap[args[0]] = { filename: args[1], x: parseInt(args[2]||'0'), y: parseInt(args[3]||'0'), count: parseInt(args[4]||'1') };
                            continue;
                        }

                        let fname = '', spriteCfg = undefined;
                        
                        if (tag === 'x' && text[i] === 'd') { // Draw Preloaded
                            i++; const args = readLocalArgs();
                            const meta = context.preloadMap[args[0]];
                            if (meta) {
                                fname = meta.filename;
                                // If specific index provided %xd(A, 2)
                                let frameIdx = 0;
                                if (args[1]) frameIdx = parseInt(args[1]);
                                
                                if (meta.count > 1 || meta.x > 0 || meta.y > 0) {
                                    // Calculate sprite offset
                                    // Rockbox sprite strips are usually vertical or horizontal. 
                                    // Default horizontal? Or checks 'count'?
                                    // For this parser, let's assume vertical strip if only Y offset? 
                                    // Actually Rockbox %xl params are: handle, filename, x, y, count
                                    // %xd(handle, subimage_idx)
                                    // xhibition uses %xl|A|batt.bmp|0|0|10 (10 subimages)
                                    // This implies the bitmap contains 10 subimages. 
                                    // If we use specific frame, we shift the image.
                                    spriteCfg = {
                                        offsetX: meta.x, 
                                        offsetY: meta.y, 
                                        count: meta.count,
                                        frameIndex: frameIdx // Special field to store fixed frame
                                    };
                                }
                            }
                        } else {
                            const args = readLocalArgs();
                            fname = args[0];
                        }

                        if (fname && !isBackdrop) {
                            const asset = resolveAsset(fname);
                            elements.push({
                                id: genId(), type: ElementType.IMAGE, screen,
                                name: fname,
                                x: context.activeViewport.x, y: context.activeViewport.y,
                                width: context.activeViewport.width, height: context.activeViewport.height,
                                visible: true, locked: false,
                                src: asset?.src || '', filename: fname,
                                condition: context.conditionStack.join(' & '), // Attach logic stack
                                spriteConfig: spriteCfg
                            });
                        }
                        continue;
                    }
                    
                    // VIEWPORTS + VIEWPORT COLORS
                    if (tag === 'V') {
                        i++;
                        if (text[i] === 'f') {
                            i++;
                            const args = readLocalArgs();
                            if (args[0]) context.currentFg = toCssHex(args[0]);
                            continue;
                        }
                        if (text[i] === 'b') {
                            i++;
                            const args = readLocalArgs();
                            if (args[0]) context.currentBg = toCssHex(args[0]);
                            continue;
                        }
                        if (text[i] === 'l') {
                            i++;
                            const args = readLocalArgs();
                            const name = args[0];
                            if (name) {
                                const vp = {
                                    x: parseInt(args[1] || '0'),
                                    y: parseInt(args[2] || '0'),
                                    width: parseInt(args[3] || '320'),
                                    height: parseInt(args[4] || '240')
                                };
                                context.namedViewports[name] = vp;
                                context.activeViewport = vp;
                                if (args[5]) {
                                    context.currentFontId = args[5].split('/').pop() || context.currentFontId;
                                    updateLineMetrics();
                                }
                            }
                            context.lineIndex = 0;
                            continue;
                        }
                        if (text[i] === '(') {
                            const args = readLocalArgs();
                            context.activeViewport = {
                                x: parseInt(args[0] || '0'),
                                y: parseInt(args[1] || '0'),
                                width: parseInt(args[2] || '320'),
                                height: parseInt(args[3] || '240')
                            };
                            if (args[4]) {
                                context.currentFontId = args[4].split('/').pop() || context.currentFontId;
                                updateLineMetrics();
                            }
                            context.lineIndex = 0;
                        } else if (text[i] === 'd') {
                             i++;
                             const args = readLocalArgs();
                             const name = args[0];
                             if (name && context.namedViewports[name]) {
                                 context.activeViewport = context.namedViewports[name];
                             } else {
                                 context.activeViewport = { x: 0, y: 0, width: 320, height: 240 };
                             }
                             context.lineIndex = 0;
                        }
                        continue;
                    }

                    // ALIGNMENT (%al, %ac, %ar)
                    if (tag === 'a') {
                        const next = text[i];
                        if (next === 'l' || next === 'c' || next === 'r') {
                            context.currentAlign = next === 'l' ? 'left' : next === 'r' ? 'right' : 'center';
                            i++;
                            continue;
                        }
                    }

                    // ALBUM ART (%Cl / %Cd)
                    if (tag === 'C') {
                        i++;
                        if (text[i] === 'l') {
                            i++;
                            const args = readLocalArgs();
                            context.albumArtRect = {
                                x: parseInt(args[0] || '0'),
                                y: parseInt(args[1] || '0'),
                                width: parseInt(args[2] || '0'),
                                height: parseInt(args[3] || '0')
                            };
                            continue;
                        }
                        if (text[i] === 'd') {
                            i++;
                            readLocalArgs();
                            const rect = context.albumArtRect || context.activeViewport;
                            elements.push({
                                id: genId(), type: ElementType.IMAGE, screen,
                                name: 'Album Art',
                                x: rect.x, y: rect.y,
                                width: rect.width, height: rect.height,
                                visible: true, locked: false,
                                src: '', filename: '',
                                imageType: 'art',
                                category: 'art',
                                condition: context.conditionStack.join(' & ')
                            });
                            continue;
                        }
                    }

                    // TAGS
                    // Capture simple tags as text elements
                    const nextTagEnd = text.slice(i).search(/[^a-zA-Z0-9]/);
                    const tagRaw = text.substr(i, nextTagEnd === -1 ? 1 : nextTagEnd);
                    // If simple tag
                    if (['s','a','id','it','ia','pc','pt','pb','pv','bl'].includes(tagRaw)) {
                         elements.push({
                             id: genId(), type: ElementType.TEXT, screen,
                             name: `Text %${tagRaw}`,
                             x: context.activeViewport.x,
                             y: context.activeViewport.y + context.lineIndex * context.lineHeight,
                             width: context.activeViewport.width,
                             height: context.lineHeight,
                             visible: true, locked: false,
                             content: `%${tagRaw}`,
                             fontId: context.currentFontId, align: context.currentAlign,
                             color: context.currentFg,
                             condition: context.conditionStack.join(' & ')
                         });
                         i += tagRaw.length;
                    } else {
                        i++;
                    }
                }
            };

            const lines = raw.split('\n').filter(l => !l.trim().startsWith('#'));
            lines.forEach(line => {
                internalParse(line);
                context.lineIndex += 1;
            });
        };

        const loadContent = async (p: string) => {
            if (!p || p === '-') return '';
            const f = loadedZip.file(p.replace(/^\//, '').replace(/\\/g, '/')) || Object.values(loadedZip.files).find((o:any) => o.name.endsWith(p.split('/').pop()||'xxxx'));
            return f ? await f.async('string') : '';
        };

        let wpsAst: RockboxAstDocument | undefined;
        let sbsAst: RockboxAstDocument | undefined;
        let fmsAst: RockboxAstDocument | undefined;
        let wpsDocument: RockboxDocument | undefined;
        let sbsDocument: RockboxDocument | undefined;
        let fmsDocument: RockboxDocument | undefined;

        if (wpsPath) {
            const wpsContent = await loadContent(wpsPath);
            parseScreen(wpsContent, 'wps');
            const parsed = parseRockboxForLegacyConsumer(wpsContent);
            wpsDocument = parsed.sourceDocument;
            wpsAst = parsed.legacyDocument;
        }
        if (sbsPath) {
            const sbsContent = await loadContent(sbsPath);
            parseScreen(sbsContent, 'sbs');
            const parsed = parseRockboxForLegacyConsumer(sbsContent);
            sbsDocument = parsed.sourceDocument;
            sbsAst = parsed.legacyDocument;
        }

        return {
            settings,
            elements,
            assets,
            selectedElementIds: [],
            validationReport: warnings,
            wpsAst,
            sbsAst,
            fmsAst,
            wpsDocument,
            sbsDocument,
            fmsDocument,
            themePackage
        };

    } catch (e) {
        console.error(e);
        return null;
    }
};
