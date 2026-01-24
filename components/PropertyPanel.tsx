import React, { useRef } from 'react';
import { WpsElement, ElementType, ProjectState, ROCKBOX_FONTS } from '../types';

interface PropertyPanelProps {
  element: WpsElement | null;
  project: ProjectState;
  onUpdate: (id: string, updates: Partial<WpsElement>) => void;
  onUpdateProject: (updates: Partial<ProjectState['settings']>, newAsset?: { name: string, data: string }) => void;
  onDelete: (id: string) => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({ element, project, onUpdate, onUpdateProject, onDelete }) => {
  const backdropInputRef = useRef<HTMLInputElement>(null);

  const handleBackdropUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          const result = ev.target?.result as string;
          onUpdateProject(
              { backdrop: file.name },
              { name: file.name, data: result }
          );
      };
      reader.readAsDataURL(file);
      e.target.value = '';
  };

  if (!element) {
    return (
      <div className="p-4 text-black text-xs font-mono">
        <h3 className="font-bold text-gray-500 uppercase tracking-widest mb-4 border-b border-gray-300 pb-1">Global Config</h3>
        
        <div className="space-y-4">
            <div>
                <label className="block mb-1 font-bold text-gray-600">PROJECT_NAME</label>
                <input 
                    type="text" 
                    value={project.settings.name}
                    onChange={(e) => onUpdateProject({ name: e.target.value })}
                    className="w-full bg-white border border-black p-1 text-black focus:outline-none focus:bg-orange-50"
                />
            </div>
            <div>
                <label className="block mb-1 font-bold text-gray-600">BG_COLOR_HEX</label>
                <div className="flex gap-2">
                    <input 
                        type="color" 
                        value={project.settings.backgroundColor}
                        onChange={(e) => onUpdateProject({ backgroundColor: e.target.value })}
                        className="h-6 w-6 border border-black p-0 cursor-pointer"
                    />
                    <input 
                        type="text" 
                        value={project.settings.backgroundColor}
                        onChange={(e) => onUpdateProject({ backgroundColor: e.target.value })}
                        className="flex-1 bg-white border border-black p-1 text-black font-mono uppercase"
                    />
                </div>
            </div>
            
            <div>
                <label className="block mb-1 font-bold text-gray-600">BACKDROP_IMG</label>
                <div className="flex flex-col gap-2">
                    <button 
                        onClick={() => backdropInputRef.current?.click()}
                        className="w-full py-1 bg-[#d4d4d4] border border-gray-400 hover:bg-white hover:border-black uppercase text-[9px] font-bold shadow-sm"
                    >
                        {project.settings.backdrop ? 'REPLACE FILE' : 'UPLOAD BMP'}
                    </button>
                    <input 
                        type="file" 
                        ref={backdropInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleBackdropUpload} 
                    />
                    {project.settings.backdrop && (
                        <div className="flex justify-between items-center bg-gray-200 px-1 py-0.5 border border-gray-300">
                             <span className="truncate max-w-[120px] text-gray-600">{project.settings.backdrop}</span>
                             <button onClick={() => onUpdateProject({ backdrop: undefined })} className="text-red-600 hover:text-red-800 font-bold">×</button>
                        </div>
                    )}
                </div>
            </div>

             <div className="pt-2 border-t border-gray-300">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                        type="checkbox"
                        checked={project.settings.statusBarTop}
                        onChange={(e) => onUpdateProject({ statusBarTop: e.target.checked })}
                        className="accent-black w-4 h-4"
                    />
                    <span className="font-bold text-gray-600">NATIVE_STATUS_BAR</span>
                </label>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 text-xs font-mono text-black">
      <div className="flex justify-between items-center mb-4 border-b border-black pb-2 bg-yellow-50 -mx-4 px-4 pt-2 border-t">
        <h3 className="font-bold text-black uppercase tracking-wider">{element.type} NODE</h3>
        <button onClick={() => onDelete(element.id)} className="text-red-500 hover:text-white hover:bg-red-500 w-5 h-5 flex items-center justify-center border border-transparent hover:border-black transition-all">
            ✕
        </button>
      </div>

      <div className="space-y-4">
        {/* Common Props */}
        <div>
            <label className="block mb-1 text-gray-500 font-bold">ID_TAG</label>
            <input 
                type="text" 
                value={element.name}
                onChange={(e) => onUpdate(element.id, { name: e.target.value })}
                className="w-full bg-white border border-black p-1 text-black focus:ring-1 focus:ring-orange-500 focus:outline-none"
            />
        </div>

        <div className="grid grid-cols-2 gap-3">
            <div>
                <label className="block mb-1 text-gray-500 font-bold">POS_X</label>
                <input 
                    type="number" 
                    value={element.x}
                    onChange={(e) => onUpdate(element.id, { x: parseInt(e.target.value) })}
                    className="w-full bg-gray-100 border-b border-black p-1 text-black font-mono text-right"
                />
            </div>
            <div>
                <label className="block mb-1 text-gray-500 font-bold">POS_Y</label>
                <input 
                    type="number" 
                    value={element.y}
                    onChange={(e) => onUpdate(element.id, { y: parseInt(e.target.value) })}
                    className="w-full bg-gray-100 border-b border-black p-1 text-black font-mono text-right"
                />
            </div>
            <div>
                <label className="block mb-1 text-gray-500 font-bold">WIDTH</label>
                <input 
                    type="number" 
                    value={element.width}
                    onChange={(e) => onUpdate(element.id, { width: parseInt(e.target.value) })}
                    className="w-full bg-gray-100 border-b border-black p-1 text-black font-mono text-right"
                />
            </div>
            <div>
                <label className="block mb-1 text-gray-500 font-bold">HEIGHT</label>
                <input 
                    type="number" 
                    value={element.height}
                    onChange={(e) => onUpdate(element.id, { height: parseInt(e.target.value) })}
                    className="w-full bg-gray-100 border-b border-black p-1 text-black font-mono text-right"
                />
            </div>
        </div>

        {/* Text Specific */}
        {element.type === ElementType.TEXT && (
            <div className="border border-gray-300 p-2 bg-white mt-4 relative">
                <span className="absolute -top-2 left-2 bg-white px-1 text-[9px] text-gray-400 font-bold">TEXT_PROPS</span>
                
                <div className="mb-3 mt-1">
                    <label className="block mb-1 text-gray-500 font-bold">DATA_SOURCE</label>
                    <input 
                        type="text" 
                        value={(element as any).content}
                        onChange={(e) => onUpdate(element.id, { content: e.target.value })}
                        className="w-full bg-black text-orange-500 border border-gray-500 p-1 font-mono"
                    />
                    <div className="flex gap-2 mt-1">
                         <button className="text-[9px] bg-gray-200 px-1 border border-gray-400 hover:bg-white" onClick={() => onUpdate(element.id, { content: '%s'})}>TITLE</button>
                         <button className="text-[9px] bg-gray-200 px-1 border border-gray-400 hover:bg-white" onClick={() => onUpdate(element.id, { content: '%a'})}>ARTIST</button>
                    </div>
                </div>
                
                <div className="mb-3">
                     <label className="block mb-1 text-gray-500 font-bold">TYPEFACE</label>
                     <select 
                        value={(element as any).fontId}
                        onChange={(e) => onUpdate(element.id, { fontId: e.target.value })}
                        className="w-full bg-gray-100 border border-gray-300 p-1 text-xs"
                     >
                        {ROCKBOX_FONTS.map(f => (
                            <option key={f.id} value={f.id}>{f.label}</option>
                        ))}
                     </select>
                </div>

                <div className="mb-3">
                    <label className="block mb-1 text-gray-500 font-bold">INK_COLOR</label>
                    <div className="flex gap-2 items-center">
                        <input 
                            type="color" 
                            value={(element as any).color}
                            onChange={(e) => onUpdate(element.id, { color: e.target.value })}
                            className="h-6 w-6 border border-black cursor-pointer p-0"
                        />
                         <span className="font-mono">{ (element as any).color }</span>
                    </div>
                </div>
                <div>
                     <label className="block mb-1 text-gray-500 font-bold">ALIGN</label>
                     <div className="flex bg-gray-200 border border-gray-400">
                        {['left', 'center', 'right'].map(align => (
                            <button 
                                key={align}
                                onClick={() => onUpdate(element.id, { align: align as any })}
                                className={`flex-1 py-1 text-[9px] uppercase font-bold ${ (element as any).align === align ? 'bg-black text-white' : 'text-gray-500 hover:text-black'}`}
                            >
                                {align}
                            </button>
                        ))}
                     </div>
                </div>
            </div>
        )}

        {/* Rect/Bar Specific */}
        {(element.type === ElementType.RECT || element.type === ElementType.PROGRESS_BAR) && (
             <div className="border border-gray-300 p-2 bg-white mt-4 relative">
                <span className="absolute -top-2 left-2 bg-white px-1 text-[9px] text-gray-400 font-bold">FILL_PROPS</span>
                
                <div className="mt-2">
                    <label className="block mb-1 text-gray-500 font-bold">FILL_COLOR</label>
                    <div className="flex gap-2 items-center">
                        <input 
                            type="color" 
                            value={(element as any).color || (element as any).foreColor}
                            onChange={(e) => {
                                if (element.type === ElementType.RECT) onUpdate(element.id, { color: e.target.value });
                                else onUpdate(element.id, { foreColor: e.target.value });
                            }}
                            className="h-6 w-6 border border-black cursor-pointer p-0"
                        />
                        <span className="font-mono">
                            {(element as any).color || (element as any).foreColor}
                        </span>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
