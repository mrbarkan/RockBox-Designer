
import React from 'react';
import { ProjectState, User, ScreenType, WpsElement } from '../types';
import { ToolIconBtn } from './common/ToolButtons';

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
}

const TabButton = ({ id, label, activeId, onClick }: { id: ScreenType, label: string, activeId: ScreenType, onClick: (id: ScreenType) => void }) => (
    <button onClick={() => onClick(id)} className={`px-4 py-2 text-xs font-bold rounded-sm uppercase ${activeId === id ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}>{label}</button>
);

export const EditorHeader: React.FC<EditorHeaderProps> = ({
    project, user, onLogout, activeScreen, setActiveScreen, selectedElement, rightPanelMode,
    onAlign, showSource, setShowSource, showGrid, setShowGrid, zoom, setZoom
}) => {
    return (
        <div className="h-14 metal-gradient flex items-center px-6 justify-between border-b border-black select-none">
            <div className="flex items-center gap-6">
                <div className="font-bold text-sm text-gray-700 uppercase tracking-widest flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${user ? 'bg-green-500' : 'bg-red-500'} border border-black/20`}></div>
                    <span className="truncate max-w-[200px]">{project.settings.name}</span>
                </div>
                {user && ( <div className="px-3 py-1 bg-black text-white text-[10px] font-bold uppercase rounded flex items-center gap-3"><span>USER: {user.username}</span><button onClick={onLogout} className="text-orange-500 hover:text-white">✕</button></div> )}
                <div className="flex bg-[#d4d4d4] p-1 rounded border border-[#999] shadow-inner gap-1">
                    <TabButton id="wps" label="WPS" activeId={activeScreen} onClick={setActiveScreen} />
                    <TabButton id="sbs" label="SBS" activeId={activeScreen} onClick={setActiveScreen} />
                    <TabButton id="fms" label="FMS" activeId={activeScreen} onClick={setActiveScreen} />
                    <TabButton id="usb" label="USB" activeId={activeScreen} onClick={setActiveScreen} />
                </div>
                {selectedElement && rightPanelMode === 'inspector' && (
                    <div className="flex gap-2 border-l border-black/20 pl-6">
                        <ToolIconBtn onClick={() => onAlign('left')} title="Align Left">⇤</ToolIconBtn>
                        <ToolIconBtn onClick={() => onAlign('center')} title="Align Center">↔</ToolIconBtn>
                        <ToolIconBtn onClick={() => onAlign('right')} title="Align Right">⇥</ToolIconBtn>
                        <ToolIconBtn onClick={() => onAlign('top')} title="Align Top">⤒</ToolIconBtn>
                        <ToolIconBtn onClick={() => onAlign('middle')} title="Align Middle">⇳</ToolIconBtn>
                        <ToolIconBtn onClick={() => onAlign('bottom')} title="Align Bottom">⤓</ToolIconBtn>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-6 text-xs font-bold text-gray-700">
                <button onClick={() => setShowSource(!showSource)} className={`px-4 py-2 border border-gray-400 rounded-full ${showSource ? 'bg-orange-500 text-white border-orange-600' : 'bg-white hover:bg-gray-50'} transition-all`}>SOURCE_EDITOR</button>
                <label className="flex items-center gap-2 cursor-pointer select-none hover:text-black"><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="accent-orange-600 w-4 h-4" /> GRID</label>
                <div className="flex items-center gap-3 border-l border-black/20 pl-6"><span>ZOOM</span><button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="w-6 h-6 bg-white border border-gray-400 flex items-center justify-center hover:bg-gray-100">-</button><span className="w-10 text-center bg-white border border-gray-300 px-2 py-1 font-mono">{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="w-6 h-6 bg-white border border-gray-400 flex items-center justify-center hover:bg-gray-100">+</button></div>
            </div>
        </div>
    );
};
