
import { ProjectState, ScreenType, SimulationState, SongMetadata, RenderList, RenderOp, ElementType, TextElement, ImageElement, ProgressBarElement, RectElement } from '../types';
import { checkCondition, parseRockboxString } from './rockboxTagParser';
import { ROCKBOX_STANDARD_FONTS, GRAPHIC_ASSETS } from '../constants';

// --- HELPERS ---

const resolveFont = (fontId: string): string => {
    let match = fontId ? fontId.match(/^(\d+)-(.+?)(?:\.fnt)?$/) : null;
    let size = 12;
    let family = 'sans-serif';
    
    if (match) {
        size = parseInt(match[1]);
        const name = match[2].toLowerCase();
        if (name.includes('mono') || name.includes('term') || name.includes('fixed')) family = '"JetBrains Mono", monospace';
        else if (name.includes('serif')) family = '"Times New Roman", serif';
        else family = '"Inter", sans-serif';
    }
    
    // Adjust size slightly as Canvas pixels != Rockbox pixels exactly
    return `${size}px ${family}`;
};

// --- EVALUATOR ---

export const evaluateTheme = (
    project: ProjectState, 
    screen: ScreenType, 
    sim: SimulationState, 
    song: SongMetadata
): RenderList => {
    const ops: RenderList = [];
    const elements = project.elements.filter(el => el.screen === screen);
    
    // 1. Draw Backdrop
    if (project.settings.backdrop && project.assets[project.settings.backdrop]) {
        ops.push({
            type: 'image',
            x: 0, y: 0, w: 320, h: 240,
            assetKey: project.settings.backdrop
        });
    } else if (screen === 'usb') {
        // Default USB BG
        ops.push({ type: 'rect', x: 0, y: 0, w: 320, h: 240, color: '#000000' });
    }

    // 2. Iterate Elements
    for (const el of elements) {
        if (!el.visible) continue;
        if (!checkCondition(el.condition, sim, song)) continue;

        switch (el.type) {
            case ElementType.RECT: {
                ops.push({
                    type: 'rect',
                    x: el.x, y: el.y, w: el.width, h: el.height,
                    color: (el as RectElement).color
                });
                break;
            }

            case ElementType.TEXT: {
                const tel = el as TextElement;
                let text = parseRockboxString(tel.content, sim, song);
                
                // Volume Format handling
                if (tel.category === 'volume_text') {
                    if (tel.volumeFormat === 'db') text = `${sim.volume}dB`;
                    else if (tel.volumeFormat === 'percent') {
                        const pct = Math.round(((sim.volume + 60) / 60) * 100);
                        text = `${Math.max(0, pct)}%`;
                    } else {
                        const vol = Math.round(((sim.volume + 60) / 60) * 100); 
                        text = `${Math.max(0, vol)}`;
                    }
                }

                // Font Resolver
                const fontCss = resolveFont(tel.fontId || project.settings.uiFont);
                
                ops.push({
                    type: 'text',
                    x: el.x, y: el.y, w: el.width, h: el.height,
                    text,
                    font: fontCss,
                    color: tel.color,
                    align: tel.align,
                    scroll: !!tel.scroll,
                    scrollOffset: tel.scroll ? (sim.sublineCycle * 30) : 0 // Simple scroll simulation
                });
                break;
            }

            case ElementType.IMAGE: {
                const imgEl = el as ImageElement;
                
                // Special: Album Art
                if (imgEl.name === 'Album Art' || imgEl.category === 'art') {
                    if (song.albumArt) {
                        ops.push({
                            type: 'image',
                            x: el.x, y: el.y, w: el.width, h: el.height,
                            assetKey: 'ALBUM_ART' // Special key to be resolved by renderer to song.albumArt
                        });
                    } else {
                        // Placeholder
                        if (imgEl.filename && project.assets[imgEl.filename]) {
                             ops.push({
                                type: 'image',
                                x: el.x, y: el.y, w: el.width, h: el.height,
                                assetKey: imgEl.filename
                            });
                        } else {
                             ops.push({ type: 'rect', x: el.x, y: el.y, w: el.width, h: el.height, color: '#cccccc' });
                             ops.push({ type: 'text', x: el.x, y: el.y + el.height/2 - 6, w: el.width, h: 12, text: 'NO ART', font: '10px monospace', align: 'center', color: '#666', scroll: false });
                        }
                    }
                    continue;
                }

                if (!imgEl.filename) continue;

                // Handle Sprites / Strips
                let sx = 0, sy = 0, sw = 0, sh = 0;
                let isSprite = false;

                // A) Battery Strip Legacy Logic
                if (imgEl.imageType === 'battery_strip' || imgEl.filename.startsWith('batt_')) {
                    if (sim.isCharging) {
                        // Render charging icon logic skipped for brevity
                    } 
                    const frames = imgEl.frameCount || 10;
                    // Passing `sx` as -1 tells renderer "calculate based on frame index".
                    const frameIdx = Math.min(frames - 1, Math.floor(sim.batteryLevel / (100 / frames)));
                    ops.push({
                        type: 'image',
                        x: el.x, y: el.y, w: el.width, h: el.height,
                        assetKey: imgEl.filename,
                        sx: -1, sy: frameIdx, sw: frames, sh: 0 // Hack: passing frames in sw, index in sy
                    });
                    isSprite = true;
                }
                
                // B) Generic Sprite Config (from %xd)
                else if (imgEl.spriteConfig) {
                    const { offsetX, offsetY, frameIndex, count } = imgEl.spriteConfig;
                    ops.push({
                        type: 'image',
                        x: el.x, y: el.y, w: el.width, h: el.height,
                        assetKey: imgEl.filename,
                        sx: -2, // Magic code for "Use SpriteConfig"
                        sy: frameIndex || 0,
                        sw: count,
                        sh: offsetX // Hack: Pass offset X
                    });
                    isSprite = true;
                }

                if (!isSprite) {
                    ops.push({
                        type: 'image',
                        x: el.x, y: el.y, w: el.width, h: el.height,
                        assetKey: imgEl.filename
                    });
                }
                break;
            }

            case ElementType.PROGRESS_BAR: {
                const pb = el as ProgressBarElement;
                const isVolume = pb.pbMode === 'volume' || (pb.pbMode === 'auto' && project.selectedElementIds.includes(el.id));
                
                let percent = 0;
                if (isVolume) percent = Math.max(0, (sim.volume + 60) / 60); // 0.0 - 1.0
                else percent = song.totalSec > 0 ? (song.currentSec / song.totalSec) : 0;
                
                percent = Math.min(1, Math.max(0, percent));

                // Adwaita Style
                if (pb.pbStyle === 'adwaita') {
                    const { BACKDROP, ICONS, SLIDER_BG, SLIDER_FG } = GRAPHIC_ASSETS.VOLUME_OVERLAY;
                    
                    // Center the overlay group relative to element rect
                    const cx = el.x + el.width / 2;
                    const cy = el.y + el.height / 2;
                    const ox = cx - 90; // 180w
                    const oy = cy - 22.5; // 45h

                    ops.push({ type: 'image', x: ox, y: oy, w: 180, h: 45, assetKey: BACKDROP.filename });
                    
                    // Icon Frame
                    let iconIdx = 0;
                    if (sim.volume > -30) iconIdx = 3;
                    else if (sim.volume > -60) iconIdx = 2;
                    else if (sim.volume > -90) iconIdx = 1;
                    
                    ops.push({ 
                        type: 'image', x: ox + 12, y: oy + 10, w: 24, h: 21, assetKey: ICONS.filename,
                        sx: -1, sy: iconIdx, sw: 4, sh: 0 
                    });

                    // Slider BG
                    ops.push({ type: 'image', x: ox + 46, y: oy + 20, w: 117, h: 5, assetKey: SLIDER_BG.filename });
                    
                    // Slider FG (Clipped)
                    ops.push({ type: 'push_clip', x: ox + 46, y: oy + 20, w: 117 * percent, h: 5 });
                    ops.push({ type: 'image', x: ox + 46, y: oy + 20, w: 117, h: 5, assetKey: SLIDER_FG.filename });
                    ops.push({ type: 'pop_clip' });

                } else if (pb.pbStyle === 'image' && pb.backgroundImage) {
                    ops.push({ type: 'push_clip', x: el.x, y: el.y, w: el.width * percent, h: el.height });
                    ops.push({ type: 'image', x: el.x, y: el.y, w: el.width, h: el.height, assetKey: pb.backgroundImage });
                    ops.push({ type: 'pop_clip' });
                } else if (pb.pbStyle === 'segmented') {
                    const segs = 20;
                    const gap = 1;
                    const segW = (el.width - (segs-1)*gap) / segs;
                    const activeSegs = Math.floor(percent * segs);
                    
                    ops.push({ type: 'rect', x: el.x, y: el.y, w: el.width, h: el.height, color: pb.backColor }); // bg
                    for(let i=0; i<activeSegs; i++) {
                        ops.push({ type: 'rect', x: el.x + i*(segW+gap), y: el.y, w: segW, h: el.height, color: pb.foreColor });
                    }
                } else {
                    // Flat / Rounded
                    ops.push({ type: 'rect', x: el.x, y: el.y, w: el.width, h: el.height, color: pb.backColor });
                    ops.push({ type: 'rect', x: el.x, y: el.y, w: el.width * percent, h: el.height, color: pb.foreColor });
                }
                break;
            }
            
            case ElementType.TOUCH_REGION:
                // Visual debug for touch regions
                ops.push({ type: 'rect', x: el.x, y: el.y, w: el.width, h: el.height, color: 'rgba(255, 0, 0, 0.1)' });
                break;
        }
    }

    // 3. System Overlay (Status Bar)
    if (project.settings.statusBarTop) {
        ops.push({ type: 'rect', x: 0, y: 0, w: 320, h: 14, color: 'rgba(0,0,0,0.2)' });
        ops.push({ type: 'line', x1: 0, y1: 14, x2: 320, y2: 14, color: 'rgba(0,0,0,0.1)', width: 1 });
        ops.push({ type: 'text', x: 2, y: 1, w: 20, h: 12, text: '▶', font: 'bold 9px monospace', color: project.settings.foregroundColor, align: 'left', scroll: false });
        ops.push({ type: 'text', x: 30, y: 1, w: 260, h: 12, text: sim.currentTime, font: '9px monospace', color: project.settings.foregroundColor, align: 'center', scroll: false });
        ops.push({ type: 'text', x: 280, y: 1, w: 38, h: 12, text: `${sim.batteryLevel}%`, font: '9px monospace', color: project.settings.foregroundColor, align: 'right', scroll: false });
    }

    return ops;
};

// --- RENDERER ---

export const renderToCanvas = (
    ctx: CanvasRenderingContext2D, 
    ops: RenderList, 
    assets: Record<string, HTMLImageElement>
) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.textBaseline = 'top';
    
    // Initial state
    ctx.save(); 

    for (const op of ops) {
        if (op.type === 'push_clip') {
            ctx.save(); // Save before clipping so we can restore to unclipped
            ctx.beginPath();
            ctx.rect(op.x, op.y, op.w, op.h);
            ctx.clip();
            continue;
        }

        if (op.type === 'pop_clip') {
            ctx.restore(); // Undo the last push_clip
            continue;
        }

        // For drawing ops, we might want local state (color/font)
        // But we don't want to break the clip stack.
        // So we save, draw, restore.
        ctx.save();

        switch (op.type) {
            case 'rect':
                ctx.fillStyle = op.color;
                ctx.fillRect(op.x, op.y, op.w, op.h);
                break;
            case 'line':
                ctx.strokeStyle = op.color;
                ctx.lineWidth = op.width;
                ctx.beginPath();
                ctx.moveTo(op.x1, op.y1);
                ctx.lineTo(op.x2, op.y2);
                ctx.stroke();
                break;
            case 'text':
                ctx.font = op.font;
                ctx.fillStyle = op.color;
                let tx = op.x;
                if (op.align === 'center') tx = op.x + op.w / 2;
                if (op.align === 'right') tx = op.x + op.w;
                ctx.textAlign = op.align;
                
                // Internal Text Clip (Standard Rockbox behavior: text doesn't overflow its box)
                ctx.beginPath();
                ctx.rect(op.x, op.y, op.w, op.h);
                ctx.clip();

                let drawX = tx;
                if (op.scroll) {
                    const measure = ctx.measureText(op.text);
                    const textWidth = measure.width;
                    if (textWidth > op.w) {
                        const offset = (op.scrollOffset || 0) % (textWidth + 50); 
                        drawX = tx - offset;
                        if (drawX + textWidth < op.x + op.w) {
                             ctx.fillText(op.text, drawX + textWidth + 50, op.y);
                        }
                    }
                }
                ctx.fillText(op.text, drawX, op.y);
                break;
            case 'image':
                const img = assets[op.assetKey];
                if (img) {
                    if (op.sx !== undefined) {
                        let srcX = 0, srcY = 0, srcW = img.naturalWidth, srcH = img.naturalHeight;
                        if (op.sx === -1) { // Battery
                            const frames = op.sw!; const idx = op.sy!;
                            srcW = img.naturalWidth / frames; srcX = srcW * idx;
                        } else if (op.sx === -2) { // Config
                            const count = op.sw || 1; const idx = op.sy || 0; const offX = op.sh || 0;
                            srcW = (img.naturalWidth) / count; srcX = offX + (srcW * idx);
                        } else {
                            srcX = op.sx; srcY = op.sy!; srcW = op.sw!; srcH = op.sh!;
                        }
                        // Check bounds to prevent index size error
                        if (srcX >= 0 && srcX < img.naturalWidth) {
                             const drawW = Math.min(srcW, img.naturalWidth - srcX);
                             ctx.drawImage(img, srcX, srcY, drawW, srcH, op.x, op.y, op.w, op.h);
                        }
                    } else {
                        ctx.drawImage(img, op.x, op.y, op.w, op.h);
                    }
                }
                break;
        }
        ctx.restore(); // Restore local draw state
    }
    
    ctx.restore(); // Restore initial state
}
