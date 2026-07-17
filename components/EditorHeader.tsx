
import React from 'react';
import { ProjectState, User, ScreenType, WpsElement } from '../types';
import { ToolIconBtn } from './common/ToolButtons';
import { getDeviceProfile, getMainScreenFiles } from '../rockbox/devices';
import { previewSourceLabel } from '../rockbox/screens';

interface EditorHeaderProps {
    project: ProjectState;
    user: User | null;
    onLogout: () => void;
    activeScreen: ScreenType;
    setActiveScreen: (s: ScreenType) => void;
    selectedElement: WpsElement | null;
    rightPanelMode: string;
    onAlign: (align: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
    showSource: boolean;
    setShowSource: (v: boolean) => void;
    showGrid: boolean;
    setShowGrid: (v: boolean) => void;
    zoom: number;
    setZoom: React.Dispatch<React.SetStateAction<number>>;
    debugMode: boolean;
    setDebugMode: (v: boolean) => void;
    useAstPreview: boolean;
    setUseAstPreview: (v: boolean) => void;
    onOpenPlay: () => void;
    onOpenAssets: () => void;
    onOpenFirmware: () => void;
}

const TabButton = ({ id, label, activeId, onClick }: { id: ScreenType, label: string, activeId: ScreenType, onClick: (id: ScreenType) => void }) => (
    <button type="button" onClick={() => onClick(id)} className={`shrink-0 px-3 py-2 text-xs font-bold rounded-sm uppercase ${activeId === id ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}>{label}</button>
);

export const EditorHeader: React.FC<EditorHeaderProps> = ({
    project, user, onLogout, activeScreen, setActiveScreen, selectedElement, rightPanelMode,
    onAlign, showSource, setShowSource, showGrid, setShowGrid, zoom, setZoom,
    debugMode, setDebugMode, useAstPreview, setUseAstPreview, onOpenPlay, onOpenAssets, onOpenFirmware
}) => {
    const deviceProfile = getDeviceProfile(project.settings.target);
    const screenFiles = getMainScreenFiles(deviceProfile);
    return (
        <div className="metal-gradient flex-none border-b border-black select-none">
            <div className="flex min-h-14 items-center gap-3 overflow-x-auto px-3 py-2">
                <div className="flex min-w-0 shrink items-center gap-3 font-bold text-sm text-gray-700 uppercase tracking-widest">
                    <div className={`w-3 h-3 rounded-full ${user ? 'bg-green-500' : 'bg-red-500'} border border-black/20`}></div>
                    <span className="truncate max-w-[150px]">{project.settings.name}</span>
                </div>
                {user && ( <div className="flex shrink-0 items-center gap-3 rounded bg-black px-3 py-1 text-[10px] font-bold uppercase text-white"><span>USER: {user.username}</span><button type="button" onClick={onLogout} className="text-orange-500 hover:text-white">✕</button></div> )}
                <nav aria-label="Theme screens" className="flex shrink-0 gap-1 rounded border border-[#999] bg-[#d4d4d4] p-1 shadow-inner">
                    {screenFiles.map(screen => (
                        <React.Fragment key={screen}>
                            <TabButton id={screen} label={screen.toUpperCase()} activeId={activeScreen} onClick={setActiveScreen} />
                        </React.Fragment>
                    ))}
                    <TabButton id="usb" label="USB" activeId={activeScreen} onClick={setActiveScreen} />
                </nav>
                {activeScreen === 'usb' ? (
                    <div className="shrink-0 border-2 border-black bg-[#20bd8b] px-2 py-1 font-mono text-[9px] font-black uppercase leading-tight shadow-[2px_2px_0_#111]">
                        {previewSourceLabel(activeScreen)}
                    </div>
                ) : null}
                <div className="ml-auto flex shrink-0 items-center gap-2 text-xs font-bold text-gray-700">
                <button
                    type="button"
                    onClick={onOpenAssets}
                    className="border-2 border-black bg-white px-3 py-2 font-mono text-[10px] font-black uppercase text-black shadow-[3px_3px_0_#111] hover:bg-[#ffd23f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                    title="Inspect, convert, replace, rename, and package real Rockbox assets"
                >
                    ASSETS
                </button>
                <button
                    type="button"
                    onClick={onOpenFirmware}
                    className="border-2 border-black bg-[#ffd23f] px-3 py-2 font-mono text-[10px] font-black uppercase text-black shadow-[3px_3px_0_#111] hover:bg-[#ffe271] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                    title="Optional source packages for compiled Rockbox assets and fallback behavior"
                >
                    FW ASSETS
                </button>
                <button
                    type="button"
                    onClick={onOpenPlay}
                    className="border-2 border-black bg-[#20bd8b] px-4 py-2 font-mono text-[11px] font-black text-black shadow-[3px_3px_0_#111] hover:bg-[#35d8a5] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                    ▶ PLAY
                </button>
                </div>
            </div>
            <div className="flex min-h-10 items-center gap-2 overflow-x-auto border-t border-black/20 bg-white/35 px-3 py-1.5 text-xs font-bold text-gray-700">
                {selectedElement && rightPanelMode === 'inspector' && (
                    <div className="flex shrink-0 gap-1 border-r border-black/20 pr-2">
                        <ToolIconBtn onClick={() => onAlign('left')} title="Align Left">⇤</ToolIconBtn>
                        <ToolIconBtn onClick={() => onAlign('center')} title="Align Center">↔</ToolIconBtn>
                        <ToolIconBtn onClick={() => onAlign('right')} title="Align Right">⇥</ToolIconBtn>
                        <ToolIconBtn onClick={() => onAlign('top')} title="Align Top">⤒</ToolIconBtn>
                        <ToolIconBtn onClick={() => onAlign('middle')} title="Align Middle">⇳</ToolIconBtn>
                        <ToolIconBtn onClick={() => onAlign('bottom')} title="Align Bottom">⤓</ToolIconBtn>
                    </div>
                )}
                <button 
                    type="button"
                    onClick={() => setDebugMode(!debugMode)} 
                    className={`shrink-0 px-3 py-1 border border-gray-400 font-mono text-[10px] ${debugMode ? 'bg-magenta-700 text-white border-magenta-900 animate-pulse' : 'bg-gray-200 text-gray-500'}`}
                >
                    DEBUG_OVL
                </button>
                <button 
                    type="button"
                    onClick={() => setUseAstPreview(!useAstPreview)} 
                    className={`shrink-0 px-3 py-1 border border-gray-400 font-mono text-[10px] ${useAstPreview ? 'bg-orange-600 text-white border-orange-700' : 'bg-gray-200 text-gray-500'}`}
                >
                    {useAstPreview ? 'SOURCE_RENDER: ON' : 'SOURCE_RENDER: OFF'}
                </button>
                <button type="button" onClick={() => setShowSource(!showSource)} className={`shrink-0 px-4 py-2 border border-gray-400 rounded-full ${showSource ? 'bg-orange-500 text-white border-orange-600' : 'bg-white hover:bg-gray-50'} transition-all`}>SOURCE_EDITOR</button>
                <label className="flex shrink-0 items-center gap-2 cursor-pointer select-none hover:text-black"><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="accent-orange-600 w-4 h-4" /> GRID</label>
                <div className="flex shrink-0 items-center gap-1 border-l border-black/20 pl-2"><span>ZOOM</span><button type="button" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="w-6 h-6 bg-white border border-gray-400 flex items-center justify-center hover:bg-gray-100">-</button><span className="w-10 text-center bg-white border border-gray-300 px-2 py-1 font-mono">{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="w-6 h-6 bg-white border border-gray-400 flex items-center justify-center hover:bg-gray-100">+</button></div>
            </div>
        </div>
    );
};
