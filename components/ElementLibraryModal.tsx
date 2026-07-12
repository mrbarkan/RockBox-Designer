
import React from 'react';
import { ElementType, ScreenType, WpsElement } from '../types';
import { GRAPHIC_ASSETS } from '../constants';
import { canAuthorFm, canAuthorTouch, DeviceProfile } from '../rockbox/devices';

interface ElementLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddElement: (element: Partial<WpsElement>) => void;
    activeScreen: ScreenType;
    deviceProfile: DeviceProfile;
}

const PLACEHOLDER_ART = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAE0lEQVR4nGP4wAAgkwB5mk0yBAAAOfEB4m25sAAAAABJRU5ErkJggg==";

export const ElementLibraryModal: React.FC<ElementLibraryModalProps> = ({ isOpen, onClose, onAddElement, activeScreen, deviceProfile }) => {
    if (!isOpen) return null;

    const DEFAULT_BATT = GRAPHIC_ASSETS.BATTERY[0];
    const DEFAULT_SHUFFLE = GRAPHIC_ASSETS.SHUFFLE[0];
    const DEFAULT_REPEAT = GRAPHIC_ASSETS.REPEAT[0];

    const ELEMENTS = [
        // ... (The same elements list as before, preserved)
        { label: 'ID3 Text Box', icon: 'T', type: ElementType.TEXT, category: 'id3', content: '%s', name: 'ID3 Text', width: 280, height: 20 },
        { label: 'Volume Text', icon: '🔊', type: ElementType.TEXT, category: 'volume_text', content: '%pv', name: 'Volume Level', width: 60, height: 20 },
        { label: 'Next Track Info', icon: '⏭', type: ElementType.TEXT, category: 'next_track', content: '%It', name: 'Next Info', width: 280, height: 20 },
        { label: 'Power Related Info', icon: '⚡', type: ElementType.TEXT, category: 'power', content: '%bl%%', name: 'Power Info', width: 60, height: 20 },
        { label: 'Real Time Clock', icon: '🕒', type: ElementType.TEXT, category: 'rtc', content: '%cH:%cM', name: 'Clock', width: 80, height: 20 },
        { label: 'Progress Bar', icon: '▬', type: ElementType.PROGRESS_BAR, category: 'default', content: '', name: 'Progress Bar', width: 300, height: 8, pbMode: 'track', pbStyle: 'flat', foreColor: '#3584e4', backColor: '#333333' },
        { label: 'File Info', icon: '📄', type: ElementType.TEXT, category: 'file', content: '%fn', name: 'File Info', width: 280, height: 20 },
        { label: 'Playlist/Song Info', icon: 'ℹ', type: ElementType.TEXT, category: 'playlist_info', content: '%pc', name: 'Track Time', width: 80, height: 20 },
        { label: 'Playlist Viewer', icon: '☰', type: ElementType.VIEWPORT, category: 'viewport', name: 'Menu Viewport', width: deviceProfile.mainScreen.width, height: Math.max(20, deviceProfile.mainScreen.height - 40), x:0, y:20 },
        { label: 'Runtime DB / RG', icon: '💿', type: ElementType.TEXT, category: 'database', content: '%rp', name: 'DB Info', width: 80, height: 20 },
        { label: 'Hold Switches', icon: '🔒', type: ElementType.IMAGE, category: 'hold', name: 'Hold Icon', width: 16, height: 16, src: PLACEHOLDER_ART, filename: 'icon_hold.bmp', condition: '%?mh' },
        { label: 'Virtual LED', icon: '🔴', type: ElementType.IMAGE, category: 'led', name: 'HDD LED', width: 10, height: 10, src: PLACEHOLDER_ART, filename: 'led_hdd.bmp', condition: '%?lh' },
        { label: 'Repeat Mode', icon: '🔁', type: ElementType.IMAGE, category: 'repeat', name: 'Repeat Icon', width: DEFAULT_REPEAT.width, height: DEFAULT_REPEAT.height, src: DEFAULT_REPEAT.src, filename: DEFAULT_REPEAT.filename, imageType: 'repeat_icon', condition: '%?mm' },
        { label: 'Playback Mode', icon: '▶', type: ElementType.TEXT, category: 'playback', content: '%?mp<Stop|Play|Pause>', name: 'Play Status', width: 80, height: 20 },
        { label: 'Crossfade', icon: '⤮', type: ElementType.TEXT, category: 'crossfade', content: '%?cf<Off|On>', name: 'Crossfade', width: 80, height: 20 },
        { label: 'Image', icon: 'IMG', type: ElementType.IMAGE, category: 'image', name: 'Static Image', width: 50, height: 50, src: PLACEHOLDER_ART, filename: 'image.bmp' },
        { label: 'Bitmap Strips / Anim', icon: '🎞', type: ElementType.IMAGE, category: 'strip', name: 'Battery Strip', width: DEFAULT_BATT.width, height: DEFAULT_BATT.height, src: DEFAULT_BATT.src, filename: DEFAULT_BATT.filename, imageType: 'battery_strip', frameCount: 10 },
        { label: 'Album Art', icon: '🖼', type: ElementType.IMAGE, category: 'art', name: 'Album Art', width: 120, height: 120, src: PLACEHOLDER_ART, filename: 'cover_placeholder.bmp', imageType: 'static' },
        { label: 'FM Radio Tokens', icon: '📻', type: ElementType.TEXT, category: 'fm', content: '%tf', name: 'FM Freq', width: 80, height: 20 },
        { label: 'Touch Region', icon: '⌁', type: ElementType.TOUCH_REGION, category: 'touch', name: 'Touch Region', width: 80, height: 40, touchAction: 'play' },
    ].filter(item =>
        (item.category !== 'fm' || canAuthorFm(deviceProfile)) &&
        (item.category !== 'touch' || canAuthorTouch(deviceProfile))
    );

    return (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#e0e0e0] border-2 border-black shadow-[12px_12px_0px_rgba(0,0,0,1)] z-[60] w-[600px] max-h-[85vh] flex flex-col font-mono text-sm animate-bounce-in">
             <div className="h-12 bg-gradient-to-b from-[#f2f2f2] to-[#d4d4d4] border-b border-black flex items-center justify-between px-4 cursor-move select-none">
                <div className="flex items-center gap-3">
                    <span className="text-orange-600 font-bold text-lg">⊕</span>
                    <span className="font-bold uppercase tracking-widest text-gray-700">Add Element</span>
                </div>
                <button onClick={onClose} className="w-6 h-6 bg-red-500 rounded-full border border-black hover:bg-red-400 flex items-center justify-center text-sm font-bold leading-none shadow-sm">
                    <span className="mt-[-2px]">×</span>
                </button>
            </div>
            
            <div className="overflow-y-auto p-6 flex-1 bg-[#dcdcdc] custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                    {ELEMENTS.map((item, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                const newElement: any = { 
                                    ...item, 
                                    screen: activeScreen,
                                    visible: true,
                                    locked: false
                                };
                                if (item.type === ElementType.TEXT) {
                                    newElement.fontId = '14-Nimbus.fnt';
                                    if (item.category === 'volume_text') {
                                        newElement.volumeFormat = 'numeric'; // Default
                                    }
                                    newElement.align = 'left';
                                    newElement.color = '#000000';
                                }
                                onAddElement(newElement);
                                onClose();
                            }}
                            className="flex items-center gap-4 p-4 bg-white border border-gray-400 shadow-[2px_2px_0px_rgba(0,0,0,0.1)] hover:bg-orange-50 hover:border-orange-500 hover:shadow-[3px_3px_0px_rgba(255,88,0,0.3)] active:translate-y-[1px] active:shadow-none transition-all text-left group"
                        >
                            <span className="w-8 h-8 flex items-center justify-center bg-gray-100 border border-gray-300 rounded-sm text-sm font-bold group-hover:bg-white group-hover:text-orange-600 overflow-hidden shrink-0">
                                {item.icon}
                            </span>
                            <div className="flex flex-col min-w-0">
                                <span className="font-bold text-gray-800 text-sm truncate group-hover:text-black">{idx + 1}. {item.label}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="p-3 bg-[#d4d4d4] border-t border-black text-[10px] text-gray-600 text-center flex justify-between px-6">
                <span>TARGET: <span className="font-bold text-black">{activeScreen.toUpperCase()}</span></span>
                <span>SELECT TO INSERT</span>
            </div>
        </div>
    );
};
