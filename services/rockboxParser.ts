import { ProjectState, ElementType, WpsElement, ScreenType } from '../types';
import { DEFAULT_PROJECT } from '../constants';

// Helper: Convert Rockbox hex (FFFFFF) to CSS hex (#FFFFFF)
const toCssHex = (hex: string) => {
    if (!hex) return '#000000';
    const clean = hex.replace(/[^0-9A-Fa-f]/g, '');
    return `#${clean}`;
};

// Helper: Convert Blob to Data URL
const blobToDataURL = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(blob);
    });
};

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
        
        // Parse CFG settings
        const settings = { ...DEFAULT_PROJECT.settings };
        let wpsPath = '';
        let sbsPath = '';
        
        cfgContent.split('\n').forEach((line: string) => {
            const [key, val] = line.split(':').map(s => s.trim());
            if (!key || !val) return;
            
            const lowerKey = key.toLowerCase();
            if (lowerKey === 'background color') settings.backgroundColor = toCssHex(val);
            if (lowerKey === 'wps') wpsPath = val; 
            if (lowerKey === 'sbs') sbsPath = val;
            if (lowerKey === 'backdrop') settings.backdrop = val.split('/').pop();
        });

        // 3. Extract Assets (Images)
        // We store both full paths and filenames to aid fuzzy matching
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
            
            // Normalize slashes for matching
            const normalizedPath = fullPath.replace(/\\/g, '/').toLowerCase();

            if (fileName) assets[fileName.toLowerCase()] = dataUrl;
            // Also store by full path for File Browser and precise lookups
            assets[normalizedPath] = dataUrl;
        }

        const elements: WpsElement[] = [];

        // --- PARSER ENGINE ---

        interface ParserContext {
            screen: ScreenType;
            vp: {x:number, y:number, w:number, h:number};
            fg: string;
            bg: string;
            font: string;
            align: 'left' | 'center' | 'right';
        }

        const parseString = (input: string, ctx: ParserContext) => {
            let buffer = input;
            
            // Loop until buffer is empty
            while (buffer.length > 0) {
                
                // 1. Check for Structural Tags
                if (buffer.startsWith('%')) {
                    
                    // -- ALIGNMENT --
                    if (buffer.startsWith('%ac')) { ctx.align = 'center'; buffer = buffer.slice(3); continue; }
                    if (buffer.startsWith('%al')) { ctx.align = 'left'; buffer = buffer.slice(3); continue; }
                    if (buffer.startsWith('%ar')) { ctx.align = 'right'; buffer = buffer.slice(3); continue; }

                    // -- VIEWPORT --
                    // %V(x,y,w,h,font) or %Vf(color) or %Vb(color) or %Vd
                    if (buffer.startsWith('%V')) {
                        // Colors
                        const colorMatch = buffer.match(/^%V([fb])\(([0-9A-Fa-f]+)\)/);
                        if (colorMatch) {
                            const color = toCssHex(colorMatch[2]);
                            if (colorMatch[1] === 'f') ctx.fg = color;
                            else ctx.bg = color;
                            buffer = buffer.substring(colorMatch[0].length);
                            continue;
                        }

                        // %Vd (Default)
                        if (buffer.startsWith('%Vd')) {
                            ctx.vp = { x: 0, y: 0, w: 320, h: 240 };
                            buffer = buffer.slice(3);
                            continue;
                        }

                        // Geometry
                        const vpMatch = buffer.match(/^%V\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,?(.*?)\)/);
                        if (vpMatch) {
                            ctx.vp = {
                                x: parseInt(vpMatch[1]),
                                y: parseInt(vpMatch[2]),
                                w: parseInt(vpMatch[3]),
                                h: parseInt(vpMatch[4]),
                            };
                            const fontParam = vpMatch[5]?.trim();
                            if (fontParam && fontParam !== '-') ctx.font = fontParam;
                            
                            buffer = buffer.substring(vpMatch[0].length);
                            continue;
                        }
                    }

                    // -- BACKDROP --
                    const bgMatch = buffer.match(/^%X\|(.*?)\|/i);
                    if (bgMatch) {
                        settings.backdrop = bgMatch[1].split('/').pop();
                        buffer = buffer.substring(bgMatch[0].length);
                        continue;
                    }

                    // -- IMAGE --
                    // Handle %x|path|
                    const imgMatch = buffer.match(/^%x\|(.*?)\|/i);
                    if (imgMatch) {
                        const rawPath = imgMatch[1];
                        const filename = rawPath.split('/').pop() || '';
                        const searchKey = filename.toLowerCase();
                        const searchPath = rawPath.replace(/\\/g, '/').toLowerCase(); 
                        
                        // Find asset strategy:
                        // 1. Direct filename match
                        let assetSrc = assets[searchKey];
                        
                        // 2. Suffix match (handle folders in zip)
                        if (!assetSrc) {
                            const foundKey = Object.keys(assets).find(k => k.endsWith(searchPath));
                            if (foundKey) assetSrc = assets[foundKey];
                        }

                        if (assetSrc) {
                            elements.push({
                                id: Math.random().toString(36).substr(2, 9),
                                name: filename,
                                type: ElementType.IMAGE,
                                screen: ctx.screen,
                                x: ctx.vp.x, y: ctx.vp.y,
                                width: 100, height: 100, 
                                visible: true, locked: false,
                                src: assetSrc,
                                filename: filename
                            });
                        }
                        buffer = buffer.substring(imgMatch[0].length);
                        continue;
                    }

                    // -- RECT (%Cl or %dr) --
                    const rectMatch = buffer.match(/^%(Cl|dr)\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)/);
                    if (rectMatch) {
                        elements.push({
                            id: Math.random().toString(36).substr(2, 9),
                            name: rectMatch[1] === 'Cl' ? 'Clear Rect' : 'Draw Rect',
                            type: ElementType.RECT,
                            screen: ctx.screen,
                            x: ctx.vp.x + parseInt(rectMatch[2]),
                            y: ctx.vp.y + parseInt(rectMatch[3]),
                            width: parseInt(rectMatch[4]),
                            height: parseInt(rectMatch[5]),
                            visible: true, locked: false,
                            color: rectMatch[1] === 'Cl' ? ctx.bg : ctx.fg 
                        });
                        buffer = buffer.substring(rectMatch[0].length);
                        continue;
                    }

                    // -- PROGRESS BAR --
                    const pbMatch = buffer.match(/^%pb\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)/);
                    if (pbMatch) {
                        elements.push({
                             id: Math.random().toString(36).substr(2, 9),
                             name: 'Progress Bar',
                             type: ElementType.PROGRESS_BAR,
                             screen: ctx.screen,
                             x: ctx.vp.x + parseInt(pbMatch[1]),
                             y: ctx.vp.y + parseInt(pbMatch[2]),
                             width: parseInt(pbMatch[3]),
                             height: parseInt(pbMatch[4]),
                             visible: true, locked: false,
                             foreColor: ctx.fg,
                             backColor: ctx.bg
                        } as any);
                        buffer = buffer.substring(pbMatch[0].length);
                        continue;
                    }

                    // -- CONDITIONAL --
                    // %?xx<A|B>
                    if (buffer.startsWith('%?')) {
                        const tagMatch = buffer.match(/^%\?([a-zA-Z0-9]+)</);
                        const tag = tagMatch ? tagMatch[1] : '';

                        // Find matching closing bracket '>' handling nesting
                        let depth = 0;
                        let endIdx = -1;
                        let startContentIdx = buffer.indexOf('<');
                        
                        if (startContentIdx !== -1) {
                            for (let i = startContentIdx; i < buffer.length; i++) {
                                if (buffer[i] === '<') depth++;
                                if (buffer[i] === '>') depth--;
                                if (depth === 0) {
                                    endIdx = i;
                                    break;
                                }
                            }
                        }

                        if (endIdx !== -1) {
                            const content = buffer.substring(startContentIdx + 1, endIdx);
                            
                            // Split by pipe '|' at top level
                            // CRITICAL FIX: Ignore pipes inside %x|...| or %X|...|
                            const branches: string[] = [];
                            let pipeDepth = 0;
                            let lastCut = 0;
                            
                            for (let j = 0; j < content.length; j++) {
                                const char = content[j];
                                
                                // Peek ahead for image tag start which uses pipes
                                if (char === '%' && (content[j+1] === 'x' || content[j+1] === 'X') && content[j+2] === '|') {
                                     const nextPipe = content.indexOf('|', j + 3);
                                     if (nextPipe !== -1) {
                                         j = nextPipe; // Skip to end of image tag
                                         continue;
                                     }
                                }

                                if (char === '<') pipeDepth++;
                                if (char === '>') pipeDepth--;
                                
                                if (char === '|' && pipeDepth === 0) {
                                    branches.push(content.substring(lastCut, j));
                                    lastCut = j + 1;
                                }
                            }
                            branches.push(content.substring(lastCut));
                            
                            // Heuristic Logic
                            let branchIndex = 0;
                            if (tag === 'mp') branchIndex = 1; // Play
                            if (tag === 'C') branchIndex = 0; // Art present
                            if (tag === 'pS') branchIndex = 0;
                            
                            const branchToRender = branches[branchIndex] !== undefined ? branches[branchIndex] : branches[0];
                            
                            if (branchToRender) {
                                parseString(branchToRender, ctx);
                            }

                            buffer = buffer.substring(endIdx + 1);
                            continue;
                        }
                    }

                    // -- IGNORED TAGS --
                    const ignoredTags = ['%wd', '%w', '%S', '%L', '%P', '%include', '%xl', '%T', '%t', '%Vl'];
                    let matchedIgnore = false;
                    for (const tag of ignoredTags) {
                        if (buffer.startsWith(tag)) {
                            if (tag === '%include') {
                                buffer = buffer.replace(/^%include:[^\n]*\n?/, '');
                            } else if (tag === '%T') {
                                const match = buffer.match(/^%T\([^)]+\)/);
                                buffer = buffer.substring(match ? match[0].length : 2);
                            } else {
                                buffer = buffer.substring(tag.length);
                            }
                            matchedIgnore = true;
                            break;
                        }
                    }
                    if (matchedIgnore) continue;
                }

                // 2. TEXT CONTENT
                // We must be careful not to capture broken tags as text.
                // Scan until next %
                let nextPercent = buffer.indexOf('%', 1);
                
                // If no next %, take all
                let textEndIdx = nextPercent === -1 ? buffer.length : nextPercent;
                
                let textContent = buffer.substring(0, textEndIdx);

                // Validation: Only add if it doesn't look like a broken tag part (e.g. starts with V, x, X, etc without %)
                // Actually, since we consume % tags above, anything here is theoretically literal text or unrecognized tags.
                
                if (textContent.length > 0) {
                     // Check for pipe artifacts from broken splits
                     if (!/^[\s|]+$/.test(textContent)) {
                        elements.push({
                            id: Math.random().toString(36).substr(2, 9),
                            name: 'Text',
                            type: ElementType.TEXT,
                            screen: ctx.screen,
                            x: ctx.vp.x,
                            y: ctx.vp.y,
                            width: ctx.vp.w,
                            height: 20,
                            visible: true, locked: false,
                            content: textContent,
                            fontId: ctx.font,
                            align: ctx.align,
                            color: ctx.fg
                        } as any);
                        ctx.vp.y += 20; 
                     }
                }

                buffer = buffer.substring(textEndIdx);
            }
        };

        const parseFileContent = (content: string, screen: ScreenType) => {
             // Clean comments first (lines starting with #)
             const cleanContent = content.split('\n').filter(l => !l.trim().startsWith('#')).join('\n');
             
             const context: ParserContext = {
                 screen,
                 vp: { x: 0, y: 0, w: 320, h: 240 },
                 fg: '#FFFFFF',
                 bg: '#000000',
                 font: '14-Nimbus.fnt',
                 align: 'left'
             };
             
             parseString(cleanContent, context);
        };

        // 4. Parse WPS
        const wpsZipPath = wpsPath.replace(/^\//, ''); 
        let wpsFile = loadedZip.file(wpsZipPath) || Object.values(loadedZip.files).find((f: any) => f.name.endsWith('.wps') && !f.name.startsWith('__MACOSX')) as any;
        if (wpsFile) {
            const wpsContent = await (wpsFile as any).async('string');
            parseFileContent(wpsContent, 'wps');
        }

        // 5. Parse SBS (if exists)
        if (sbsPath && sbsPath !== '-') {
             const sbsZipPath = sbsPath.replace(/^\//, '');
             let sbsFile = loadedZip.file(sbsZipPath) || Object.values(loadedZip.files).find((f: any) => f.name.endsWith('.sbs') && !f.name.startsWith('__MACOSX')) as any;
             if (sbsFile) {
                 const sbsContent = await (sbsFile as any).async('string');
                 parseFileContent(sbsContent, 'sbs');
             }
        }

        return {
            settings,
            elements,
            assets,
            selectedElementIds: []
        };

    } catch (e) {
        console.error("Failed to parse zip", e);
        alert("Could not parse this theme. Ensure it's a valid Rockbox .zip with a .cfg file.");
        return null;
    }
};
