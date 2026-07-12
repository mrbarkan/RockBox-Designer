import { ProjectState, ThemeConfig, LayoutStyle, WpsElement, ElementType, ThemeFont } from '../types';
import { getDeviceProfile } from '../rockbox/devices';

/**
 * Applies a high-level ThemeConfig to the ProjectState by generating specific elements.
 * This acts as a "smart reset" of the current canvas.
 */
export const applyThemeToProject = (project: ProjectState, theme: ThemeConfig): ProjectState => {
    const newElements: WpsElement[] = [];
    const { colors, layout, font } = theme;
    const profile = getDeviceProfile(project.settings.target);
    const screenWidth = profile.mainScreen.width;
    const screenHeight = profile.mainScreen.height;

    // Helper to generate ID
    const genId = (prefix: string) => `${prefix}-${Math.random().toString(36).substr(2, 5)}`;

    const newSettings = {
        ...project.settings,
        name: theme.name,
        backgroundColor: colors.background,
        statusBarTop: theme.statusBar
    };

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
                screen: 'wps',
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
            screen: 'wps',
            x: theme.showAlbumArt ? 120 : 10, 
            y: textY, 
            width: theme.showAlbumArt ? Math.max(20, screenWidth - 130) : Math.max(20, screenWidth - 20),
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
            screen: 'wps',
            x: theme.showAlbumArt ? 120 : 10, 
            y: textY + 25, 
            width: theme.showAlbumArt ? Math.max(20, screenWidth - 130) : Math.max(20, screenWidth - 20),
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
                screen: 'wps',
                x: 0, y: 20, width: screenWidth, height: 130,
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
            screen: 'wps',
            x: 0, y: 150, width: screenWidth, height: Math.max(20, screenHeight - 150),
            visible: true, locked: true,
            color: colors.barBackground // Use bar/accent color for split
        });

        // Title
        newElements.push({
            id: genId('title'),
            name: 'Title',
            type: ElementType.TEXT,
            screen: 'wps',
            x: 10, y: 160, width: Math.max(20, screenWidth - 20), height: 24,
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
            screen: 'wps',
            x: 10, y: 185, width: Math.max(20, screenWidth - 20), height: 20,
            visible: true, locked: false,
            content: '%a',
            fontId: font,
            align: 'center',
            color: colors.barForeground
        });

    } else {
        // FULL_ART (or default)
        // Title (Overlay)
        newElements.push({
            id: genId('title-bg'),
            name: 'Title Backdrop',
            type: ElementType.RECT,
            screen: 'wps',
            x: 0, y: Math.max(0, screenHeight - 60), width: screenWidth, height: 60,
            visible: true, locked: true,
            color: 'rgba(0,0,0,0.5)' // Semi transparent black usually, but we use hex.
        });

        newElements.push({
            id: genId('title'),
            name: 'Title',
            type: ElementType.TEXT,
            screen: 'wps',
            x: 10, y: Math.max(0, screenHeight - 50), width: Math.max(20, screenWidth - 20), height: 20,
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
        screen: 'wps',
        x: 0, y: screenHeight - 8, width: screenWidth, height: 8,
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
            screen: 'wps',
            x: Math.max(0, screenWidth - 60), y: screenHeight - 25, width: 50, height: 15,
            visible: true, locked: false,
            content: 'Vol: %pv',
            fontId: '12-Sys-Fixed.fnt',
            align: 'right',
            color: colors.foreground
        });
    }
    
    // 6. Default SBS Bar
    newElements.push({
        id: genId('sbs'),
        name: 'SBS Status',
        type: ElementType.TEXT,
        screen: 'sbs',
        x: 5, y: 0, width: Math.max(20, screenWidth - 10), height: 16,
        visible: true, locked: false,
        content: '%?mp<Stop|Play|Pause> %ac%cH:%cM %ar%bl%%',
        fontId: font,
        align: 'center',
        color: colors.foreground
    });

    return {
        ...project,
        settings: newSettings,
        elements: newElements,
        selectedElementIds: []
    };
};
