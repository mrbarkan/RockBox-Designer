import React from 'react';
import { WpsElement, ElementType, ProjectState, ROCKBOX_FONTS } from '../types';

interface PropertyPanelProps {
  element: WpsElement | null;
  project: ProjectState;
  onUpdate: (id: string, updates: Partial<WpsElement>) => void;
  onUpdateProject: (updates: Partial<ProjectState['settings']>) => void;
  onDelete: (id: string) => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({ element, project, onUpdate, onUpdateProject, onDelete }) => {
  if (!element) {
    return (
      <div className="p-4 text-gray-400 text-sm">
        <h3 className="font-bold text-gray-200 mb-4">Project Settings</h3>
        
        <div className="space-y-4">
            <div>
                <label className="block text-xs mb-1">Project Name</label>
                <input 
                    type="text" 
                    value={project.settings.name}
                    onChange={(e) => onUpdateProject({ name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm"
                />
            </div>
            <div>
                <label className="block text-xs mb-1">Background Color</label>
                <div className="flex gap-2">
                    <input 
                        type="color" 
                        value={project.settings.backgroundColor}
                        onChange={(e) => onUpdateProject({ backgroundColor: e.target.value })}
                        className="h-8 w-8 bg-transparent border-0 cursor-pointer"
                    />
                    <input 
                        type="text" 
                        value={project.settings.backgroundColor}
                        onChange={(e) => onUpdateProject({ backgroundColor: e.target.value })}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm font-mono"
                    />
                </div>
            </div>
             <div>
                <label className="flex items-center gap-2 text-xs">
                    <input 
                        type="checkbox"
                        checked={project.settings.statusBarTop}
                        onChange={(e) => onUpdateProject({ statusBarTop: e.target.checked })}
                    />
                    Show System Status Bar
                </label>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 text-sm text-gray-300">
      <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
        <h3 className="font-bold text-gray-200">{element.type.toUpperCase()}</h3>
        <button onClick={() => onDelete(element.id)} className="text-red-400 hover:text-red-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>

      <div className="space-y-4">
        {/* Common Props */}
        <div>
            <label className="block text-xs mb-1">Name</label>
            <input 
                type="text" 
                value={element.name}
                onChange={(e) => onUpdate(element.id, { name: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"
            />
        </div>

        <div className="grid grid-cols-2 gap-2">
            <div>
                <label className="block text-xs mb-1">X</label>
                <input 
                    type="number" 
                    value={element.x}
                    onChange={(e) => onUpdate(element.id, { x: parseInt(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white font-mono"
                />
            </div>
            <div>
                <label className="block text-xs mb-1">Y</label>
                <input 
                    type="number" 
                    value={element.y}
                    onChange={(e) => onUpdate(element.id, { y: parseInt(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white font-mono"
                />
            </div>
            <div>
                <label className="block text-xs mb-1">Width</label>
                <input 
                    type="number" 
                    value={element.width}
                    onChange={(e) => onUpdate(element.id, { width: parseInt(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white font-mono"
                />
            </div>
            <div>
                <label className="block text-xs mb-1">Height</label>
                <input 
                    type="number" 
                    value={element.height}
                    onChange={(e) => onUpdate(element.id, { height: parseInt(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white font-mono"
                />
            </div>
        </div>

        {/* Text Specific */}
        {element.type === ElementType.TEXT && (
            <>
                <div>
                    <label className="block text-xs mb-1">Content (Tag)</label>
                    <input 
                        type="text" 
                        value={(element as any).content}
                        onChange={(e) => onUpdate(element.id, { content: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-yellow-400 font-mono"
                    />
                    <div className="text-[10px] text-gray-500 mt-1 flex gap-2">
                        <span className="cursor-pointer hover:text-white" onClick={() => onUpdate(element.id, { content: '%s'})}>%s Title</span>
                        <span className="cursor-pointer hover:text-white" onClick={() => onUpdate(element.id, { content: '%?mp<Stop|Play|Pause>'})}>Logic</span>
                    </div>
                </div>
                
                <div>
                     <label className="block text-xs mb-1">Font</label>
                     <select 
                        value={(element as any).fontId}
                        onChange={(e) => onUpdate(element.id, { fontId: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                     >
                        {ROCKBOX_FONTS.map(f => (
                            <option key={f.id} value={f.id}>{f.label}</option>
                        ))}
                     </select>
                </div>

                <div>
                    <label className="block text-xs mb-1">Color</label>
                    <input 
                        type="color" 
                        value={(element as any).color}
                        onChange={(e) => onUpdate(element.id, { color: e.target.value })}
                        className="w-full h-8 bg-transparent cursor-pointer"
                    />
                </div>
                <div>
                     <label className="block text-xs mb-1">Alignment</label>
                     <div className="flex bg-gray-800 rounded border border-gray-700">
                        {['left', 'center', 'right'].map(align => (
                            <button 
                                key={align}
                                onClick={() => onUpdate(element.id, { align: align as any })}
                                className={`flex-1 py-1 text-xs capitalize ${ (element as any).align === align ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                            >
                                {align}
                            </button>
                        ))}
                     </div>
                </div>
            </>
        )}

        {/* Rect Specific */}
        {(element.type === ElementType.RECT || element.type === ElementType.PROGRESS_BAR) && (
             <div>
                <label className="block text-xs mb-1">Color</label>
                <input 
                    type="color" 
                    value={(element as any).color || (element as any).foreColor}
                    onChange={(e) => {
                        if (element.type === ElementType.RECT) onUpdate(element.id, { color: e.target.value });
                        else onUpdate(element.id, { foreColor: e.target.value });
                    }}
                    className="w-full h-8 bg-transparent cursor-pointer"
                />
            </div>
        )}
      </div>
    </div>
  );
};
