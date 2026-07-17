
import { ProjectState, ElementType, TextElement, WpsElement, ImageElement, ScreenType, RectElement, ProgressBarElement } from '../types';
import { GRAPHIC_ASSETS } from '../constants';
import { serializeDocument } from './rockboxAstSerializer';
import { parseRockbox, serializeRockbox } from '../rockbox/syntax';
import {
    createThemeAsset,
    exportThemePackage,
    parseCfg,
    ThemeAsset,
    ThemePackage
} from '../rockbox/packages';
import { stringifyProjectData } from './projectSerialization';

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

  const hasScreen = (screen: ScreenType) => Boolean(
    (screen === 'wps' && (project.wpsDocument || project.wpsAst)) ||
    (screen === 'sbs' && (project.sbsDocument || project.sbsAst)) ||
    (screen === 'fms' && (project.fmsDocument || project.fmsAst)) ||
    project.elements.some(element => element.screen === screen)
  );
  let cfg = `# Generated by RockBox Designer
wps: /.rockbox/wps/${themeName}.wps
${hasScreen('sbs') ? `sbs: /.rockbox/wps/${themeName}.sbs\n` : ''}${hasScreen('fms') ? `fms: /.rockbox/wps/${themeName}.fms\n` : ''}font: /.rockbox/fonts/${s.uiFont}
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

function dataURItoBytes(dataURI: string): Uint8Array {
    const byteString = atob(dataURI.split(',')[1]);
    const bytes = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
    return bytes;
}

export const generateZip = async (project: ProjectState): Promise<Blob | null> => {
    const themeName = project.settings.name.replace(/\s+/g, '_').toLowerCase();
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

    const existingAssetMap = new Map<string, ThemeAsset>();
    for (const asset of project.themePackage?.assets ?? []) existingAssetMap.set(asset.archivePath, asset);
    for (const asset of project.projectAssets ?? []) existingAssetMap.set(asset.archivePath, asset);
    for (const asset of project.componentAssets ?? []) {
        if (!existingAssetMap.has(asset.archivePath)) existingAssetMap.set(asset.archivePath, asset);
    }
    const existingAssets = [...existingAssetMap.values()];
    const existingBasenames = new Set(existingAssets.map(asset => asset.basename));
    const addedAssets: ThemeAsset[] = [];
    for (const [filename, dataUri] of Object.entries(assetsToInclude)) {
        if (existingBasenames.has(filename) || !dataUri.startsWith('data:')) continue;
        const path = filename.toLowerCase().endsWith('.fnt')
            ? `.rockbox/fonts/${filename}`
            : filename === project.settings.backdrop
            ? `.rockbox/wps/${themeName}_bg.bmp`
            : `.rockbox/wps/${themeName}_img/${filename}`;
        addedAssets.push(await createThemeAsset(path, dataURItoBytes(dataUri)));
    }

    const projectJson = stringifyProjectData({ ...project, themePackage: undefined }, 2);
    const projectAsset = await createThemeAsset('rockbox_designer_project.json', new TextEncoder().encode(projectJson));
    const base = project.themePackage;
    const hasScreen = (screen: ScreenType) => Boolean(
        compileAstScreen(project, screen) || project.elements.some(element => element.screen === screen)
    );
    const screens: ThemePackage['screens'] = base ? { ...base.screens } : {};
    const screenPaths: ThemePackage['screenPaths'] = base ? { ...base.screenPaths } : {};
    for (const screen of ['wps', 'sbs', 'fms'] as const) {
        const document = screen === 'wps' ? project.wpsDocument : screen === 'sbs' ? project.sbsDocument : project.fmsDocument;
        if (document) screens[screen] = document;
        if (!base && hasScreen(screen)) {
            screens[screen] = document ?? parseRockbox(compileScreen(project, screen));
            screenPaths[screen] = `.rockbox/wps/${themeName}.${screen}`;
        }
    }
    const theme: ThemePackage = {
        cfg: base?.cfg ?? parseCfg(compileCfg(project)),
        cfgPath: base?.cfgPath ?? `.rockbox/themes/${themeName}.cfg`,
        screens,
        screenPaths,
        assets: [...existingAssets.filter(asset => asset.archivePath !== 'rockbox_designer_project.json'), ...addedAssets, projectAsset],
        manifest: base?.manifest ?? { files: [] },
        diagnostics: base?.diagnostics ?? []
    };
    const bytes = await exportThemePackage(theme);
    return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], { type: 'application/zip' });
};
