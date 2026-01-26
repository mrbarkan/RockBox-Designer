
import React from 'react';
import { ProjectState, WpsElement, ScreenType, ElementType } from '../types';
import { FileBrowser } from './FileBrowser';
import { PropertyPanel } from './PropertyPanel';

interface EditorSidebarProps {
    rightPanelMode: 'inspector' | 'files' | 'settings';
    setRightPanelMode: (mode: 'inspector' | 'files' | 'settings') => void;
    project: ProjectState;
    selectedElementIds: string[];
    onUploadResources: (files: FileList) => void;
    onUpdateElement: (id: string, updates: Partial<WpsElement>) => void;
    onUpdateProject: (updates: Partial<ProjectState['settings']>, newAsset?: { name: string, data: string }) => void;
    onDeleteElement: (id: string) => void;
    onSelectElement: (id: string) => void;
    isLayerStackCollapsed: boolean;
    setIsLayerStackCollapsed: (v: boolean) => void;
    activeScreen: ScreenType;
}

export const EditorSidebar: React.FC<EditorSidebarProps> = ({
    rightPanelMode, setRightPanelMode, project, selectedElementIds, onUploadResources,
    onUpdateElement, onUpdateProject, onDeleteElement, onSelectElement,
    isLayerStackCollapsed, setIsLayerStackCollapsed, activeScreen
}) => {
    
    const selectedElement = project.elements.find(el => selectedElementIds.includes(el.id)) || null;

    return (
        <div className="w-80 pinstripe border-l border-black flex flex-col z-20">
            <div className="h-14 metal-gradient border-b border-black flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-700 shadow-sm pl-6 pr-2">
                <span className="mr-3 opacity-50">///</span>
                <div className="flex bg-[#d4d4d4] rounded border border-[#999] p-1 gap-1">
                    <button onClick={() => setRightPanelMode('inspector')} className={`px-3 py-1.5 rounded-sm ${rightPanelMode === 'inspector' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}>Edit</button>
                    <button onClick={() => setRightPanelMode('settings')} className={`px-3 py-1.5 rounded-sm ${rightPanelMode === 'settings' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}>Project</button>
                    <button onClick={() => setRightPanelMode('files')} className={`px-3 py-1.5 rounded-sm ${rightPanelMode === 'files' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}>Files</button>
                </div>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto">
                    {rightPanelMode === 'files' ? ( 
                        <FileBrowser project={project} onUploadResources={onUploadResources} /> 
                    ) : (
                        <PropertyPanel 
                            element={rightPanelMode === 'inspector' ? selectedElement : null} 
                            project={project} 
                            onUpdate={onUpdateElement} 
                            onUpdateProject={onUpdateProject} 
                            onDelete={onDeleteElement} 
                            onDeselect={() => onSelectElement('')} 
                        />
                    )}
                </div>
                {rightPanelMode === 'inspector' && (
                    <div className={`border-t border-black flex flex-col bg-[#e0e0e0] sticky bottom-0 flex-shrink-0 transition-all duration-300 ease-in-out ${isLayerStackCollapsed ? 'h-10' : 'h-1/3'}`}>
                        <div onClick={() => setIsLayerStackCollapsed(!isLayerStackCollapsed)} className="h-10 bg-[#d4d4d4] border-b border-black flex items-center justify-between px-6 text-xs font-bold uppercase tracking-wider text-gray-600 cursor-pointer hover:bg-gray-300 select-none"><span>Layer_Stack ({activeScreen.toUpperCase()})</span><span>{isLayerStackCollapsed ? '▲' : '▼'}</span></div>
                        {!isLayerStackCollapsed && (
                            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                {project.elements.filter(el => el.screen === activeScreen).map(el => (
                                    <div key={el.id} onClick={() => onSelectElement(el.id)} className={`text-xs px-3 py-3 border border-transparent cursor-pointer flex items-center gap-3 font-mono ${project.selectedElementIds.includes(el.id) ? 'bg-orange-600 text-white border-black shadow-sm' : 'text-gray-600 hover:bg-white hover:border-gray-300'}`}>
                                        <span className="opacity-50 w-5 text-center font-bold">{el.type === ElementType.TEXT ? 'T' : el.type === ElementType.RECT ? '□' : el.type === ElementType.IMAGE ? 'IMG' : '='}</span>
                                        <span className="truncate uppercase">{el.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
