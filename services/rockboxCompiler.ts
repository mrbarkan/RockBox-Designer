
import { ProjectState, ElementType, TextElement, WpsElement, ImageElement, ScreenType, RectElement, ProgressBarElement } from '../types';
import { GRAPHIC_ASSETS } from '../constants';
import { serializeDocument } from './rockboxAstSerializer';
import { serializeRockbox } from '../rockbox/syntax';

// Convert hex to Rockbox hex (strip #)
const toRbHex = (hex: string) => hex ? hex.replace('#', '') : 'FFFFFF';

/**
 * Compiles a single WpsElement into Rockbox tag string
 */
const compileElement = (el: WpsElement, safeName: string): string => {
    let code = ``;
    
    // 1. Auto Mode Progress Bar Special Case
    if (el.type === ElementType.PROGRESS_BAR && (el as ProgressBarElement).pbMode === 'auto') {
        const pb = el as ProgressBarElement;
        const vId = `vol_${el.id.substr(0,4)}`;
        const pId = `trk_${el.id.substr(0,4)}`;
        
        code += `\n# Auto Progress Bar (Volume Overlay)\n`;
        code += `%?mv(1)<%Vd(${vId})|%Vd(${pId})>\n`;
        
        // Track Layer
        code += `%Vl(${pId},${el.x},${el.y},${el.width},${el.height},-)\n`;
        if (pb.pbStyle === 'flat' || pb.pbStyle === 'rounded') {
            code += `%Vf(${toRbHex(pb.foreColor)})\n%Vb(${toRbHex(pb.backColor)})\n%pb(0,0,${el.width},${el.height},-)\n`;
        } else {
             code += `%Vf(${toRbHex(pb.foreColor)})\n%pb(0,0,${el.width},${el.height},-)\n`;
        }

        // Volume Layer
        code += `%Vl(${vId},${el.x},${el.y},${el.width},${el.height},-)\n`;
        if (pb.pbStyle === 'adwaita') {
             code += `%xd(VolumeBackdrop)\n`;
             code += `%?if(%pv, =, -90)<%xd(VolumeIcons,1)>\n`;
             code += `%?and(%if(%pv, <=, -60),%if(%pv, >, -90))<%xd(VolumeIcons,2)>\n`;
             code += `%?and(%if(%pv, <=, -30),%if(%pv, >, -60))<%xd(VolumeIcons,3)>\n`;
             code += `%?if(%pv, >, -30)<%xd(VolumeIcons,4)>\n`;
             code += `%Vl(slider_sub,46,20,117,5,-)\n%xd(VolumeSliderBackdrop)\n%pv(0,0,117,5,VolumeSlider.bmp)\n`;
        } else {
             code += `%Vf(${toRbHex(pb.foreColor)})\n%Vb(${toRbHex(pb.backColor)})\n%pv(0,0,${el.width},${el.height},-)\n`;
        }
        return code;
    }

    // 2. Standard Elements
    code += `\n# Element: ${el.name}\n`;
    
    if (el.touchAction) {
        code += `%T(${el.x},${el.y},${el.width},${el.height},${el.touchAction})\n`;
    }

    if (el.type === ElementType.VIEWPORT) {
        code += `%Vi(${el.x},${el.y},${el.width},${el.height}, -)\n`;
        return code; 
    }

    code += `%V(${el.x},${el.y},${el.width},${el.height},-)\n`;

    if (el.condition) code += `${el.condition}<`; 

    switch (el.type) {
      case ElementType.RECT:
        code += `%Vf(${toRbHex((el as RectElement).color)})\n`; 
        code += `%Cl(0,0,${el.width},${el.height},c,c)\n`; 
        break;

      case ElementType.TEXT:
        const textEl = el as TextElement;
        code += `%Vf(${toRbHex(textEl.color)})\n`;
        let alignTag = '%ac';
        if (textEl.align === 'left') alignTag = '%al';
        if (textEl.align === 'right') alignTag = '%ar';
        
        let content = textEl.content;
        if (textEl.category === 'volume_text') {
            if (textEl.volumeFormat === 'db') content = '%pv dB';
            else if (textEl.volumeFormat === 'percent') content = '%pv%';
            else content = '%pv'; 
        }

        code += `${alignTag}${content}\n`;
        break;

      case ElementType.PROGRESS_BAR:
        const pb = el as ProgressBarElement;
        code += `%Vf(${toRbHex(pb.foreColor)})\n`;
        code += `%Vb(${toRbHex(pb.backColor)})\n`;
        if (pb.pbMode === 'volume') {
            code += `%pv(0,0,${el.width},${el.height},-)\n`;
        } else {
            code += `%pb(0,0,${el.width},${el.height},-)\n`;
        }
        break;
        
      case ElementType.IMAGE:
        const imgEl = el as ImageElement;
        if (imgEl.filename) {
             if (imgEl.imageType === 'battery_strip' && imgEl.preloadId) {
                 const frames = imgEl.frameCount || 10;
                 code += `%xd(${imgEl.preloadId}, %bl, ${frames})\n`;
             } else {
                 code += `%x|${safeName}_img/${imgEl.filename}|\n`;
             }
        }
        break;
    }

    if (el.condition) code += `|>\n`; 
    return code;
};

export const compileScreen = (project: ProjectState, screen: ScreenType): string => {
  const { elements, settings } = project;
  const safeName = settings.name.replace(/\s+/g, '_').toLowerCase();
  
  let code = `%wd\n`; // Clear display

  if (settings.backdrop) {
       code += `%X|${safeName}_bg.bmp|\n`; 
  }
  
  // Preload Images Logic
  const stripElements = elements.filter(el => 
      el.screen === screen && 
      el.type === ElementType.IMAGE && 
      (el as ImageElement).imageType === 'battery_strip'
  ) as ImageElement[];

  const getNextHandle = (index: number) => String.fromCharCode(65 + index);

  stripElements.forEach((el, index) => {
      const handle = getNextHandle(index);
      el.preloadId = handle; 
      if (el.filename) {
          code += `%xl|${handle}|${safeName}_img/${el.filename}|0|0|\n`;
      }
  });

  // Preload Adwaita Assets if used
  const adwaitaElements = elements.filter(el => 
      el.screen === screen && 
      el.type === ElementType.PROGRESS_BAR && 
      (el as ProgressBarElement).pbStyle === 'adwaita'
  );
  if (adwaitaElements.length > 0) {
      const { VOLUME_OVERLAY } = GRAPHIC_ASSETS;
      code += `%xl|VolumeBackdrop|${safeName}_img/${VOLUME_OVERLAY.BACKDROP.filename}|0|0|\n`;
      code += `%xl|VolumeIcons|${safeName}_img/${VOLUME_OVERLAY.ICONS.filename}|0|0|4\n`; 
      code += `%xl|VolumeSliderBackdrop|${safeName}_img/${VOLUME_OVERLAY.SLIDER_BG.filename}|0|0|\n`;
      code += `%xl|VolumeSlider|${safeName}_img/${VOLUME_OVERLAY.SLIDER_FG.filename}|0|0|\n`;
  }

  // Compile Elements
  elements.filter(el => el.screen === screen).forEach(el => {
    if (!el.visible) return;
    code += compileElement(el, safeName);
  });

  return code;
};

export const compileWps = (project: ProjectState) => compileScreen(project, 'wps');
export const compileSbs = (project: ProjectState) => compileScreen(project, 'sbs');
export const compileFms = (project: ProjectState) => compileScreen(project, 'fms');

export const compileAstScreen = (project: ProjectState, screen: ScreenType): string | null => {
  if (screen === 'wps' && project.wpsDocument) return serializeRockbox(project.wpsDocument);
  if (screen === 'sbs' && project.sbsDocument) return serializeRockbox(project.sbsDocument);
  if (screen === 'fms' && project.fmsDocument) return serializeRockbox(project.fmsDocument);
  // Deprecated saved-project fallback. New imports and edits use the lossless document above.
  if (screen === 'wps' && project.wpsAst) return serializeDocument(project.wpsAst);
  if (screen === 'sbs' && project.sbsAst) return serializeDocument(project.sbsAst);
  if (screen === 'fms' && project.fmsAst) return serializeDocument(project.fmsAst);
  return null;
};

export const compileCfg = (project: ProjectState): string => {
  const themeName = project.settings.name.replace(/\s+/g, '_').toLowerCase();
  const s = project.settings;

  let cfg = `# Generated by RockBox Designer
wps: /.rockbox/wps/${themeName}.wps
sbs: /.rockbox/wps/${themeName}.sbs
fms: /.rockbox/wps/${themeName}.fms
font: /.rockbox/fonts/${s.uiFont}
foreground color: ${toRbHex(s.foregroundColor)}
background color: ${toRbHex(s.backgroundColor)}
line selector start color: ${toRbHex(s.selectorColor)}
line selector end color: ${toRbHex(s.lineSelectorEndColor || s.selectorColor)}
line selector text color: ${toRbHex(s.selectorTextColor)}
selector type: ${s.lineSelectorType === 'bar_gradient' ? 'bar (gradient)' : s.lineSelectorType === 'bar_inverse' ? 'bar (inverse)' : s.lineSelectorType === 'pointer' ? 'pointer' : 'bar (color)'}
statusbar: ${s.statusBarTop ? 'top' : 'off'}
scrollbar: ${s.scrollbar}
scrollbar width: ${s.scrollbarWidth}
volume display: ${s.volumeDisplay}
battery display: ${s.batteryDisplay}
show icons: ${s.showIcons ? 'on' : 'off'}
backdrop: -
`;

  // New Options
  if (s.iconset) cfg += `iconset: ${s.iconset}\n`;
  if (s.viewersIconset) cfg += `viewers iconset: ${s.viewersIconset}\n`;
  if (s.scrollSpeed) cfg += `scroll speed: ${s.scrollSpeed}\n`;
  if (s.scrollDelay) cfg += `scroll delay: ${s.scrollDelay}\n`;
  if (s.scrollStep) cfg += `scroll step: ${s.scrollStep}\n`;
  if (s.backlightOnHold) cfg += `backlight on button hold: ${s.backlightOnHold}\n`;
  if (s.qsTop) cfg += `qs top: ${s.qsTop}\n`;
  if (s.qsBottom) cfg += `qs bottom: ${s.qsBottom}\n`;
  if (s.qsLeft) cfg += `qs left: ${s.qsLeft}\n`;
  if (s.qsRight) cfg += `qs right: ${s.qsRight}\n`;

  return cfg;
};

function dataURItoBlob(dataURI: string): Blob {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    return new Blob([ab], { type: mimeString });
}

export const generateZip = async (project: ProjectState): Promise<Blob | null> => {
    // @ts-ignore
    if (typeof JSZip === 'undefined') return null;
    // @ts-ignore
    const zip = new JSZip();
    const themeName = project.settings.name.replace(/\s+/g, '_').toLowerCase();
    const assetsFolder = `${themeName}_img`;
    const builtinAssets: Record<string, string> = {};

    GRAPHIC_ASSETS.BATTERY.forEach(asset => { builtinAssets[asset.filename] = asset.src; });
    GRAPHIC_ASSETS.SHUFFLE.forEach(asset => { builtinAssets[asset.filename] = asset.src; });
    GRAPHIC_ASSETS.REPEAT.forEach(asset => { builtinAssets[asset.filename] = asset.src; });
    Object.values(GRAPHIC_ASSETS.VOLUME_OVERLAY).forEach(asset => { builtinAssets[asset.filename] = asset.src; });

    const assetsToInclude: Record<string, string> = { ...project.assets };
    project.elements.forEach(el => {
        if (el.type === ElementType.IMAGE) {
            const filename = (el as ImageElement).filename;
            if (filename && builtinAssets[filename] && !assetsToInclude[filename]) {
                assetsToInclude[filename] = builtinAssets[filename];
            }
        }
        if (el.type === ElementType.PROGRESS_BAR && (el as ProgressBarElement).pbStyle === 'adwaita') {
            Object.values(GRAPHIC_ASSETS.VOLUME_OVERLAY).forEach(asset => {
                if (!assetsToInclude[asset.filename]) {
                    assetsToInclude[asset.filename] = asset.src;
                }
            });
        }
    });

    zip.file(`.rockbox/themes/${themeName}.cfg`, compileCfg(project));
    const wpsAst = compileAstScreen(project, 'wps');
    const sbsAst = compileAstScreen(project, 'sbs');
    const fmsAst = compileAstScreen(project, 'fms');
    zip.file(`.rockbox/wps/${themeName}.wps`, wpsAst ?? compileWps(project));
    zip.file(`.rockbox/wps/${themeName}.sbs`, sbsAst ?? compileSbs(project));
    zip.file(`.rockbox/wps/${themeName}.fms`, fmsAst ?? compileFms(project));

    const imgFolder = zip.folder(`.rockbox/wps/${assetsFolder}`);
    if (imgFolder) {
        Object.keys(assetsToInclude).forEach(filename => {
            const base64 = assetsToInclude[filename];
            if (filename === project.settings.backdrop) {
                zip.file(`.rockbox/wps/${themeName}_bg.bmp`, dataURItoBlob(base64)); 
            } else {
                imgFolder.file(filename, dataURItoBlob(base64));
            }
        });
    }
    zip.file(`rockbox_designer_project.json`, JSON.stringify(project, null, 2));
    return await zip.generateAsync({ type: "blob" });
};
