import { ProjectState, ThemeConfig, LayoutStyle, WpsElement, ElementType, ThemeFont } from '../types';
import { IPOD_SCREEN_WIDTH, IPOD_SCREEN_HEIGHT } from '../constants';

/**
 * Applies a high-level ThemeConfig to the ProjectState by generating specific elements.
 * This acts as a "smart reset" of the current canvas.
 */
export const applyThemeToProject = (project: ProjectState, theme: ThemeConfig): ProjectState => {
    const newElements: WpsElement[] = [];
    const { colors, layout, font } = theme;

    // Helper to generate ID
    const genId = (prefix: string) => `${prefix}-${Math.random().toString(36).substr(2, 5)}`;

    // 1. Background (simulated via project setting, but we also ensure a base rect for consistency in export if needed)
    // Actually, Rockbox viewport clearing handles background, so we just update project settings.
    const newSettings = {
        ...project.settings,
        name: theme.name,
        backgroundColor: colors.background,
        statusBarTop: theme.statusBar
    };

    // 2. Status Bar (If enabled, usually Rockbox handles it, but we might want custom elements)
    // For this engine, we assume the native status bar is used if theme.statusBar is true.
    
    // 3. Layout Logic
    let artY = 0;
    let artH = 0;
    let textY = 0;

    if (layout === LayoutStyle.MINIMAL) {
        // Art small, top-left. Text right.
        if (theme.showAlbumArt) {
            newElements.push({
                id: genId('art'),
                name: 'Album Art',
                type: ElementType.IMAGE,
                x: 10, y: 30, width: 100, height: 100,
                visible: true, locked: true,
                src: '', // Placeholder, logic handles actual art render in canvas
                filename: '' // Logic handled in compiler
            });
            textY = 30;
        } else {
            textY = 30;
        }

        // Song Title
        newElements.push({
            id: genId('title'),
            name: 'Title',
            type: ElementType.TEXT,
            x: theme.showAlbumArt ? 120 : 10, 
            y: textY, 
            width: theme.showAlbumArt ? 190 : 300, 
            height: 20,
            visible: true, locked: false,
            content: '%s',
            fontId: font,
            align: theme.showAlbumArt ? 'left' : 'center',
            color: colors.foreground
        });

        // Artist
        newElements.push({
            id: genId('artist'),
            name: 'Artist',
            type: ElementType.TEXT,
            x: theme.showAlbumArt ? 120 : 10, 
            y: textY + 25, 
            width: theme.showAlbumArt ? 190 : 300, 
            height: 20,
            visible: true, locked: false,
            content: '%a',
            fontId: font,
            align: theme.showAlbumArt ? 'left' : 'center',
            color: colors.foreground
        });

    } else if (layout === LayoutStyle.SPLIT) {
        // Top half art, bottom half text
        if (theme.showAlbumArt) {
            newElements.push({
                id: genId('art'),
                name: 'Album Art (Viewport)',
                type: ElementType.IMAGE,
                x: 0, y: 20, width: 320, height: 130,
                visible: true, locked: true,
                src: '', 
                filename: ''
            });
        }

        // Metadata Container Background
        newElements.push({
            id: genId('meta-bg'),
            name: 'Metadata Background',
            type: ElementType.RECT,
            x: 0, y: 150, width: 320, height: 90,
            visible: true, locked: true,
            color: colors.barBackground // Use bar/accent color for split
        });

        // Title
        newElements.push({
            id: genId('title'),
            name: 'Title',
            type: ElementType.TEXT,
            x: 10, y: 160, width: 300, height: 24,
            visible: true, locked: false,
            content: '%s',
            fontId: font,
            align: 'center',
            color: colors.barForeground
        });

        // Artist
        newElements.push({
            id: genId('artist'),
            name: 'Artist',
            type: ElementType.TEXT,
            x: 10, y: 185, width: 300, height: 20,
            visible: true, locked: false,
            content: '%a',
            fontId: font,
            align: 'center',
            color: colors.barForeground
        });

    } else {
        // FULL_ART (or default)
        // In editor, difficult to represent full screen art without an image. 
        // We will assume standard layout but with overlay text.
        
        // Title (Overlay)
        newElements.push({
            id: genId('title-bg'),
            name: 'Title Backdrop',
            type: ElementType.RECT,
            x: 0, y: 180, width: 320, height: 60,
            visible: true, locked: true,
            color: 'rgba(0,0,0,0.5)' // Semi transparent black usually, but we use hex.
        });

        newElements.push({
            id: genId('title'),
            name: 'Title',
            type: ElementType.TEXT,
            x: 10, y: 190, width: 300, height: 20,
            visible: true, locked: false,
            content: '%s',
            fontId: font,
            align: 'center',
            color: '#FFFFFF'
        });
    }

    // 4. Progress Bar (Common)
    newElements.push({
        id: genId('pb'),
        name: 'Progress',
        type: ElementType.PROGRESS_BAR,
        x: 0, y: IPOD_SCREEN_HEIGHT - 8, width: IPOD_SCREEN_WIDTH, height: 8,
        visible: true, locked: false,
        foreColor: colors.accent,
        backColor: colors.barBackground
    });

    // 5. System Indicators (Battery/Volume) if requested
    if (theme.showVolume) {
         newElements.push({
            id: genId('vol'),
            name: 'Volume',
            type: ElementType.TEXT,
            x: 260, y: IPOD_SCREEN_HEIGHT - 25, width: 50, height: 15,
            visible: true, locked: false,
            content: 'Vol: %pv',
            fontId: '12-Sys-Fixed.fnt',
            align: 'right',
            color: colors.foreground
        });
    }

    return {
        ...project,
        settings: newSettings,
        elements: newElements,
        selectedElementIds: []
    };
};
