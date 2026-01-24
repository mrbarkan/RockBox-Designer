import React from 'react';
import { ElementType, ScreenType, WpsElement } from '../types';

interface ElementLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddElement: (element: Partial<WpsElement>) => void;
    activeScreen: ScreenType;
}

// Simple grey square placeholder for album art
const PLACEHOLDER_ART = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAE0lEQVR4nGP4wAAgkwB5mk0yBAAAOfEB4m25sAAAAABJRU5ErkJggg==";

export const ElementLibraryModal: React.FC<ElementLibraryModalProps> = ({ isOpen, onClose, onAddElement, activeScreen }) => {
    if (!isOpen) return null;

    const PRESETS = [
        { category: 'Metadata', items: [
            { label: 'Song Title', icon: 'T', type: ElementType.TEXT, content: '%s', name: 'Song Title', width: 280, height: 20, align: 'center', color: '#000000' },
            { label: 'Artist Name', icon: 'T', type: ElementType.TEXT, content: '%a', name: 'Artist', width: 280, height: 20, align: 'center', color: '#666666' },
            { label: 'Album Title', icon: 'T', type: ElementType.TEXT, content: '%id', name: 'Album', width: 280, height: 20, align: 'center', color: '#666666' },
            { label: 'Next Track', icon: 'T', type: ElementType.TEXT, content: 'Next: %It', name: 'Next Track', width: 280, height: 20, align: 'left', color: '#888888' },
            { label: 'Track Info', icon: 'T', type: ElementType.TEXT, content: '%in / %it', name: 'Track Num', width: 100, height: 20, align: 'center', color: '#000000' },
            { label: 'File Info', icon: 'T', type: ElementType.TEXT, content: '%fc %fbkbps', name: 'File Info', width: 120, height: 16, align: 'center', color: '#888888' },
        ]},
        { category: 'Graphics', items: [
            { label: 'Album Art', icon: '🖼️', type: ElementType.IMAGE, name: 'Album Art', width: 120, height: 120, src: PLACEHOLDER_ART, filename: 'cover_placeholder.bmp' },
            { label: 'Progress Bar', icon: '▬', type: ElementType.PROGRESS_BAR, name: 'Progress Bar', width: 280, height: 8, foreColor: '#000000', backColor: '#aaaaaa' },
            { label: 'Separator', icon: '—', type: ElementType.RECT, name: 'Separator', width: 300, height: 2, color: '#000000' },
            { label: 'Backdrop Box', icon: '□', type: ElementType.RECT, name: 'Box', width: 300, height: 50, color: '#eeeeee' },
        ]},
        { category: 'Status', items: [
            { label: 'Digital Clock', icon: '🕒', type: ElementType.TEXT, content: '%cH:%cM', name: 'Clock', width: 60, height: 20, align: 'center', color: '#000000' },
            { label: 'Battery %', icon: '🔋', type: ElementType.TEXT, content: '%bl%%', name: 'Battery', width: 40, height: 20, align: 'right', color: '#000000' },
            { label: 'Volume Text', icon: '🔊', type: ElementType.TEXT, content: 'Vol: %pv', name: 'Volume', width: 60, height: 20, align: 'left', color: '#000000' },
            { label: 'Play State', icon: '▶', type: ElementType.TEXT, content: '%?mp<Stop|Play|Pause>', name: 'Status', width: 80, height: 20, align: 'center', color: '#000000' },
            { label: 'Shuffle Icon', icon: '🔀', type: ElementType.TEXT, content: '%?ps<|S>', name: 'Shuffle', width: 20, height: 20, align: 'center', color: '#000000' },
        ]}
    ];

    return (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#e0e0e0] border-2 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] z-[60] w-[400px] max-h-[80vh] flex flex-col font-mono text-sm animate-bounce-in">
             <div className="h-8 bg-gradient-to-b from-[#f2f2f2] to-[#d4d4d4] border-b border-black flex items-center justify-between px-2 cursor-move select-none">
                <div className="flex items-center gap-2">
                    <span className="text-orange-600 font-bold">⊕</span>
                    <span className="font-bold uppercase tracking-widest text-gray-700">Add_Element</span>
                </div>
                <button onClick={onClose} className="w-4 h-4 bg-red-500 rounded-full border border-black hover:bg-red-400 flex items-center justify-center text-xs font-bold leading-none shadow-sm">
                    <span className="mt-[-2px]">×</span>
                </button>
            </div>
            
            <div className="overflow-y-auto p-4 flex-1 bg-[#dcdcdc] custom-scrollbar">
                {PRESETS.map(cat => (
                    <div key={cat.category} className="mb-4 last:mb-0">
                        <div className="text-[10px] font-bold uppercase text-gray-500 mb-2 border-b border-gray-400 pb-1 flex justify-between">
                            <span>{cat.category}</span>
                            <span className="opacity-50">///</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {cat.items.map((item, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        // @ts-ignore
                                        onAddElement({ ...item, screen: activeScreen });
                                        onClose();
                                    }}
                                    className="flex items-center gap-3 p-2 bg-white border border-gray-400 shadow-[2px_2px_0px_rgba(0,0,0,0.1)] hover:bg-orange-50 hover:border-orange-500 hover:shadow-[2px_2px_0px_rgba(255,88,0,0.3)] active:translate-y-[1px] active:shadow-none transition-all text-left group"
                                >
                                    <span className="w-6 h-6 flex items-center justify-center bg-gray-100 border border-gray-300 rounded-sm text-xs font-bold group-hover:bg-white group-hover:text-orange-600">{item.icon}</span>
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-bold text-gray-800 text-xs truncate group-hover:text-black">{item.label}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="p-2 bg-[#d4d4d4] border-t border-black text-[9px] text-gray-600 text-center flex justify-between px-4">
                <span>TARGET: <span className="font-bold text-black">{activeScreen.toUpperCase()}</span></span>
                <span>SELECT TO INSERT</span>
            </div>
        </div>
    );
};
