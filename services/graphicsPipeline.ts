
import { ProjectState, ScreenType, SimulationState, SongMetadata, RenderList, RenderOp, ElementType, TextElement, ImageElement, ProgressBarElement, RectElement } from '../types';
import { checkCondition, parseRockboxString } from './rockboxTagParser';
import { ROCKBOX_STANDARD_FONTS, GRAPHIC_ASSETS } from '../constants';
import { getDeviceProfile } from '../rockbox/devices';
import { themeScreenForPreview } from '../rockbox/screens';

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
    const sourceScreen = themeScreenForPreview(screen);
    const elements = project.elements.filter(el => el.screen === sourceScreen);
    const profile = getDeviceProfile(project.settings.target);
    const screenWidth = profile.mainScreen.width;
    const screenHeight = profile.mainScreen.height;
    
    // Evaluator State
    let currentViewport = { x: 0, y: 0, w: screenWidth, h: screenHeight };
    let artClipRect = { x: 0, y: 0, w: screenWidth, h: screenHeight }; // For %Cl

    // 1. Draw Backdrop (Global)
    if (project.settings.backdrop && project.assets[project.settings.backdrop]) {
        ops.push({
            type: 'image',
            x: 0, y: 0, w: screenWidth, h: screenHeight,
            assetKey: project.settings.backdrop
        });
    }

    // 2. Iterate Elements with State
    for (const el of elements) {
        if (!el.visible) continue;
        if (!checkCondition(el.condition, sim, song)) continue;

        switch (el.type) {
            case ElementType.VIEWPORT: {
                // Rockbox %V(x,y,w,h) sets the new drawing region and clips it
                currentViewport = { x: el.x, y: el.y, w: el.width, h: el.height };
                ops.push({ 
                    type: 'set_viewport', 
                    x: el.x, y: el.y, w: el.width, h: el.height,
                    clip: true
                });
                break;
            }

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
                
                // Special handling for Volume Text to respect format
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

                const fontCss = resolveFont(tel.fontId || project.settings.uiFont);
                ops.push({
                    type: 'text',
                    x: el.x, y: el.y, w: el.width, h: el.height,
                    text,
                    font: fontCss,
                    color: tel.color,
                    align: tel.align,
                    scroll: !!tel.scroll,
                    scrollOffset: tel.scroll ? (sim.sublineCycle * 30) : 0
                });
                break;
            }

            case ElementType.IMAGE: {
                const imgEl = el as ImageElement;
                
                // A) Album Art Handling (%Cl / %Cd logic)
                // In Rockbox, %Cl defines the rect, %Cd draws.
                // In IDE, we might have an Image element named 'Album Art' OR separate %Cl/%Cd elements if parsed.
                // This block handles the high-level IDE 'Album Art' element which acts as both.
                if (imgEl.name === 'Album Art' || imgEl.category === 'art') {
                    if (song.albumArt) {
                        ops.push({
                            type: 'image',
                            x: el.x, y: el.y, w: el.width, h: el.height,
                            assetKey: 'ALBUM_ART' 
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
                
                // B) Custom Draw (%Cd) specifically
                if (imgEl.imageType === 'art') {
                     // This mimics %Cd. It should fill the current viewport or specific rect?
                     // Usually %Cd doesn't take args, it uses %Cl rect.
                     // We'll use the element's rect as the %Cl rect.
                     if (song.albumArt) {
                        ops.push({ type: 'image', x: el.x, y: el.y, w: el.width, h: el.height, assetKey: 'ALBUM_ART' });
                     }
                     continue;
                }

                if (!imgEl.filename) continue;

                // C) Sprites / Strips
                let sx = 0, sy = 0, sw = 0, sh = 0;
                let isSprite = false;

                if (imgEl.imageType === 'battery_strip' || imgEl.filename.startsWith('batt_')) {
                    const frames = imgEl.frameCount || 10;
                    const frameIdx = Math.min(frames - 1, Math.floor(sim.batteryLevel / (100 / frames)));
                    ops.push({
                        type: 'image',
                        x: el.x, y: el.y, w: el.width, h: el.height,
                        assetKey: imgEl.filename,
                        sx: -1, sy: frameIdx, sw: frames, sh: 0 
                    });
                    isSprite = true;
                }
                else if (imgEl.spriteConfig) {
                    const { offsetX, offsetY, frameIndex, count } = imgEl.spriteConfig;
                    ops.push({
                        type: 'image',
                        x: el.x, y: el.y, w: el.width, h: el.height,
                        assetKey: imgEl.filename,
                        sx: -2, 
                        sy: frameIndex || 0,
                        sw: count,
                        sh: offsetX 
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
                if (isVolume) percent = Math.max(0, (sim.volume + 60) / 60); 
                else percent = song.totalSec > 0 ? (song.currentSec / song.totalSec) : 0;
                percent = Math.min(1, Math.max(0, percent));

                if (pb.pbStyle === 'adwaita') {
                    const { BACKDROP, ICONS, SLIDER_BG, SLIDER_FG } = GRAPHIC_ASSETS.VOLUME_OVERLAY;
                    const cx = el.x + el.width / 2;
                    const cy = el.y + el.height / 2;
                    const ox = cx - 90; 
                    const oy = cy - 22.5; 

                    ops.push({ type: 'image', x: ox, y: oy, w: 180, h: 45, assetKey: BACKDROP.filename });
                    
                    let iconIdx = 0;
                    if (sim.volume > -30) iconIdx = 3;
                    else if (sim.volume > -60) iconIdx = 2;
                    else if (sim.volume > -90) iconIdx = 1;
                    
                    ops.push({ type: 'image', x: ox + 12, y: oy + 10, w: 24, h: 21, assetKey: ICONS.filename, sx: -1, sy: iconIdx, sw: 4, sh: 0 });
                    ops.push({ type: 'image', x: ox + 46, y: oy + 20, w: 117, h: 5, assetKey: SLIDER_BG.filename });
                    
                    // Manual Clip for slider
                    ops.push({ type: 'set_viewport', x: ox + 46, y: oy + 20, w: 117 * percent, h: 5, clip: true });
                    ops.push({ type: 'image', x: ox + 46, y: oy + 20, w: 117, h: 5, assetKey: SLIDER_FG.filename });
                    // Restore viewport to context (IDE assumes absolute, so we restore full screen clip? 
                    // Or we just rely on next viewport set? 
                    // For correctness, we should restore previous viewport. 
                    // But our simplistic evaluator relies on the list order.
                    // We'll set viewport back to currentViewport.
                    ops.push({ type: 'set_viewport', ...currentViewport, clip: true }); 

                } else if (pb.pbStyle === 'image' && pb.backgroundImage) {
                    ops.push({ type: 'set_viewport', x: el.x, y: el.y, w: el.width * percent, h: el.height, clip: true });
                    ops.push({ type: 'image', x: el.x, y: el.y, w: el.width, h: el.height, assetKey: pb.backgroundImage });
                    ops.push({ type: 'set_viewport', ...currentViewport, clip: true });

                } else if (pb.pbStyle === 'segmented') {
                    const segs = 20;
                    const gap = 1;
                    const segW = (el.width - (segs-1)*gap) / segs;
                    const activeSegs = Math.floor(percent * segs);
                    
                    ops.push({ type: 'rect', x: el.x, y: el.y, w: el.width, h: el.height, color: pb.backColor }); 
                    for(let i=0; i<activeSegs; i++) {
                        ops.push({ type: 'rect', x: el.x + i*(segW+gap), y: el.y, w: segW, h: el.height, color: pb.foreColor });
                    }
                } else {
                    ops.push({ type: 'rect', x: el.x, y: el.y, w: el.width, h: el.height, color: pb.backColor });
                    ops.push({ type: 'rect', x: el.x, y: el.y, w: el.width * percent, h: el.height, color: pb.foreColor });
                }
                break;
            }
            
            case ElementType.TOUCH_REGION:
                ops.push({ type: 'debug_rect', x: el.x, y: el.y, w: el.width, h: el.height, label: 'TOUCH' });
                break;
        }
    }

    // 3. System Overlay
    if (project.settings.statusBarTop) {
        ops.push({ type: 'set_viewport', x: 0, y: 0, w: screenWidth, h: 14, clip: false });
        ops.push({ type: 'rect', x: 0, y: 0, w: screenWidth, h: 14, color: 'rgba(0,0,0,0.2)' });
        ops.push({ type: 'line', x1: 0, y1: 14, x2: screenWidth, y2: 14, color: 'rgba(0,0,0,0.1)', width: 1 });
        ops.push({ type: 'text', x: 2, y: 1, w: 20, h: 12, text: '▶', font: 'bold 9px monospace', color: project.settings.foregroundColor, align: 'left', scroll: false });
        ops.push({ type: 'text', x: 30, y: 1, w: Math.max(0, screenWidth - 60), h: 12, text: sim.currentTime, font: '9px monospace', color: project.settings.foregroundColor, align: 'center', scroll: false });
        ops.push({ type: 'text', x: Math.max(0, screenWidth - 40), y: 1, w: 38, h: 12, text: `${sim.batteryLevel}%`, font: '9px monospace', color: project.settings.foregroundColor, align: 'right', scroll: false });
    }

    return ops;
};

// --- RENDERER ---

export const renderToCanvas = (
    ctx: CanvasRenderingContext2D, 
    ops: RenderList, 
    assets: Record<string, HTMLImageElement>,
    direction: SimulationState['textDirection'] = 'ltr'
) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.textBaseline = 'top';
    
    // Global State
    ctx.save(); 

    for (const op of ops) {
        if (op.type === 'set_viewport') {
            // Restore to clear previous clip/transform
            ctx.restore(); 
            ctx.save();
            
            if (op.clip) {
                ctx.beginPath();
                ctx.rect(op.x, op.y, op.w, op.h);
                ctx.clip();
            }
            // Note: We don't translate(op.x, op.y) because current Evaluator assumes Absolute coordinates.
            // If Evaluator used relative, we would translate here.
            continue;
        }

        ctx.save(); // Local op state

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
            case 'debug_rect':
                 ctx.strokeStyle = 'red';
                 ctx.lineWidth = 1;
                 ctx.setLineDash([2, 2]);
                 ctx.strokeRect(op.x, op.y, op.w, op.h);
                 break;
            case 'text':
                ctx.font = op.font;
                ctx.fillStyle = op.color;
                ctx.direction = direction;
                let tx = op.x;
                if (op.align === 'center') tx = op.x + op.w / 2;
                if (op.align === 'right') tx = op.x + op.w;
                ctx.textAlign = op.align;
                
                // Implicit Text Clipping (Rockbox standard)
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
                        
                        // Sprite Logic mapped from Evaluator
                        if (op.sx === -1) { // Battery
                            const frames = op.sw!; const idx = op.sy!;
                            srcW = img.naturalWidth / frames; srcX = srcW * idx;
                        } else if (op.sx === -2) { // Config
                            const count = op.sw || 1; const idx = op.sy || 0; const offX = op.sh || 0;
                            srcW = (img.naturalWidth) / count; srcX = offX + (srcW * idx);
                        } else {
                            srcX = op.sx; srcY = op.sy!; srcW = op.sw!; srcH = op.sh!;
                        }
                        
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
        ctx.restore(); // Restore local op state
    }
    
    ctx.restore(); // Restore global
}
