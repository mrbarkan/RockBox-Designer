import React, { useRef, useState, useEffect, useMemo } from 'react';
import { WpsElement, ElementType, ProjectState, FontDefinition } from '../types';
import { ROCKBOX_STANDARD_FONTS } from '../constants';

interface PropertyPanelProps {
  element: WpsElement | null;
  project: ProjectState;
  onUpdate: (id: string, updates: Partial<WpsElement>) => void;
  onUpdateProject: (updates: Partial<ProjectState['settings']>, newAsset?: { name: string, data: string }) => void;
  onDelete: (id: string) => void;
  onDeselect: () => void;
}

// Helper to parse "14-Nimbus.fnt" into size and family
const parseFontId = (fontId: string): { size: number, family: string } => {
    const match = fontId.match(/^(\d+)-(.+?)(?:\.fnt)?$/);
    if (match) {
        return { size: parseInt(match[1]), family: match[2] };
    }
    // Fallback for weird names like "Sys-Fixed-12.fnt" or just "MyFont.fnt"
    return { size: 12, family: fontId.replace('.fnt', '') };
};

// Helper to construct "14-Nimbus.fnt"
const buildFontId = (size: number, family: string): string => {
    return `${size}-${family}.fnt`;
};

export const PropertyPanel: React.FC<PropertyPanelProps> = ({ element, project, onUpdate, onUpdateProject, onDelete, onDeselect }) => {
  const backdropInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Build the list of available fonts (Standard + Imported from Assets)
  const availableFonts = useMemo(() => {
      const fonts: Record<string, FontDefinition> = { ...ROCKBOX_STANDARD_FONTS };
      
      // Scan assets for .fnt files
      Object.keys(project.assets).forEach(filename => {
          if (filename.toLowerCase().endsWith('.fnt')) {
              const { size, family } = parseFontId(filename);
              
              if (!fonts[family]) {
                  fonts[family] = {
                      family,
                      sizes: [],
                      type: 'sans' // Default type for imported
                  };
              }
              if (!fonts[family].sizes.includes(size)) {
                  fonts[family].sizes.push(size);
                  fonts[family].sizes.sort((a, b) => a - b);
              }
          }
      });
      return fonts;
  }, [project.assets]);

  const fontFamilies = Object.keys(availableFonts).sort();

  // Reset delete confirmation if selection changes
  useEffect(() => {
      setShowDeleteConfirm(false);
  }, [element?.id]);

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

  const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.fnt')) {
          alert("Please upload a Rockbox .fnt file.");
          return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
          // .fnt files are binary or text, but for the IDE we just need the filename reference 
          // and store it as a placeholder to allow export. 
          // Note: In a real app we might parse the FNT to render it, but here we mock render.
          const result = ev.target?.result as string;
          onUpdateProject(
              {}, // No settings update yet
              { name: file.name, data: result }
          );
          alert(`Imported font: ${file.name}`);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
  };

  const resetColors = () => {
      onUpdateProject({
          backgroundColor: '#111111',
          foregroundColor: '#FFFFFF',
          selectorColor: '#ff5800',
          selectorTextColor: '#FFFFFF',
          lineSelectorEndColor: '#ff5800',
          lineSelectorType: 'bar_color'
      });
  };

  const FontSelector = ({ currentFontId, onChange }: { currentFontId: string, onChange: (newId: string) => void }) => {
      const { size, family } = parseFontId(currentFontId);
      
      // Ensure current family exists in list (handle edge case of custom font removed)
      const validFamily = availableFonts[family] ? family : 'Nimbus';
      const sizes = availableFonts[validFamily]?.sizes || [14];

      return (
          <div className="space-y-2">
              <div className="flex gap-2">
                  <div className="flex-1">
                      <label className="block mb-1 text-[9px] text-gray-500 font-bold">FAMILY</label>
                      <select 
                          value={validFamily}
                          onChange={(e) => {
                              const newFamily = e.target.value;
                              // Default to first size of new family
                              const newSize = availableFonts[newFamily].sizes[0] || 12;
                              onChange(buildFontId(newSize, newFamily));
                          }}
                          className="w-full bg-gray-100 border border-gray-300 p-1 text-xs"
                      >
                          {fontFamilies.map(f => (
                              <option key={f} value={f}>{f}</option>
                          ))}
                      </select>
                  </div>
                  <div className="w-16">
                      <label className="block mb-1 text-[9px] text-gray-500 font-bold">SIZE</label>
                      <select 
                          value={size}
                          onChange={(e) => {
                              onChange(buildFontId(parseInt(e.target.value), validFamily));
                          }}
                          className="w-full bg-gray-100 border border-gray-300 p-1 text-xs"
                      >
                          {sizes.map(s => (
                              <option key={s} value={s}>{s}</option>
                          ))}
                      </select>
                  </div>
              </div>
              <div className="flex justify-end">
                   <button 
                        onClick={() => fontInputRef.current?.click()}
                        className="text-[9px] text-blue-600 hover:underline flex items-center gap-1"
                   >
                       <span>+ Import .fnt</span>
                   </button>
                   <input type="file" ref={fontInputRef} className="hidden" accept=".fnt" onChange={handleFontUpload} />
              </div>
          </div>
      );
  };

  if (!element) {
    return (
      <div className="p-4 text-black text-xs font-mono">
        <h3 className="font-bold text-gray-500 uppercase tracking-widest mb-4 border-b border-gray-300 pb-1">Global Config</h3>
        
        <div className="space-y-4">
            {/* Project Name */}
            <div>
                <label className="block mb-1 font-bold text-gray-600">PROJECT_NAME</label>
                <input 
                    type="text" 
                    value={project.settings.name}
                    onChange={(e) => onUpdateProject({ name: e.target.value })}
                    className="w-full bg-white border border-black p-1 text-black focus:outline-none focus:bg-orange-50"
                />
            </div>

            {/* Typography & Icons */}
            <div className="bg-white p-2 border border-gray-300">
                <div className="text-[9px] font-bold text-gray-400 mb-2 uppercase">Typography & Icons</div>
                
                 <div className="mb-2">
                     <FontSelector 
                        currentFontId={project.settings.uiFont || '14-Nimbus.fnt'} 
                        onChange={(newId) => onUpdateProject({ uiFont: newId })}
                     />
                </div>
                
                <label className="flex items-center gap-2 cursor-pointer mt-2 border-t border-gray-200 pt-2">
                    <input 
                        type="checkbox"
                        checked={project.settings.showIcons}
                        onChange={(e) => onUpdateProject({ showIcons: e.target.checked })}
                        className="accent-black w-3 h-3"
                    />
                    <span className="font-bold text-gray-600">SHOW_ICONS</span>
                </label>
            </div>

            {/* Backdrop */}
            <div className="bg-white p-2 border border-gray-300">
                <div className="text-[9px] font-bold text-gray-400 mb-2 uppercase">Backdrop</div>
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <button 
                            onClick={() => backdropInputRef.current?.click()}
                            className="flex-1 py-1 bg-[#d4d4d4] border border-gray-400 hover:bg-white hover:border-black uppercase text-[9px] font-bold shadow-sm"
                        >
                            {project.settings.backdrop ? 'REPLACE' : 'UPLOAD BMP'}
                        </button>
                        {project.settings.backdrop && (
                            <button 
                                onClick={() => onUpdateProject({ backdrop: undefined })}
                                className="px-2 bg-red-100 border border-red-300 text-red-600 hover:bg-red-500 hover:text-white font-bold"
                                title="Clear Backdrop"
                            >
                                ×
                            </button>
                        )}
                    </div>
                    <input 
                        type="file" 
                        ref={backdropInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleBackdropUpload} 
                    />
                    {project.settings.backdrop && (
                         <span className="truncate text-[9px] text-gray-500">{project.settings.backdrop}</span>
                    )}
                </div>
            </div>

            {/* Status & Scrollbar */}
            <div className="bg-white p-2 border border-gray-300">
                <div className="text-[9px] font-bold text-gray-400 mb-2 uppercase">Status & Scrollbar</div>
                
                <div className="mb-2">
                     <label className="block mb-1 font-bold text-gray-600">SCROLLBAR</label>
                     <div className="flex gap-1 mb-1">
                        {['off', 'left', 'right'].map(opt => (
                            <button
                                key={opt}
                                onClick={() => onUpdateProject({ scrollbar: opt as any })}
                                className={`flex-1 text-[9px] border py-1 uppercase ${project.settings.scrollbar === opt ? 'bg-black text-white border-black' : 'bg-gray-100 text-gray-500 border-gray-300'}`}
                            >
                                {opt}
                            </button>
                        ))}
                     </div>
                     {project.settings.scrollbar !== 'off' && (
                         <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-gray-500 w-8">WIDTH</span>
                            <input 
                                type="number" 
                                min="1" max="20"
                                value={project.settings.scrollbarWidth || 6}
                                onChange={(e) => onUpdateProject({ scrollbarWidth: parseInt(e.target.value) })}
                                className="w-12 border border-black p-0.5 text-center bg-white"
                            />
                            <span className="text-[9px]">px</span>
                         </div>
                     )}
                </div>

                <div className="space-y-1 pt-2 border-t border-gray-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox"
                            checked={project.settings.statusBarTop}
                            onChange={(e) => onUpdateProject({ statusBarTop: e.target.checked })}
                            className="accent-black w-3 h-3"
                        />
                        <span className="font-bold text-gray-600">NATIVE_STATUS_BAR</span>
                    </label>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                        <label className="block mb-1 font-bold text-gray-600 text-[9px]">VOL_DISPLAY</label>
                        <select 
                            value={project.settings.volumeDisplay}
                            onChange={(e) => onUpdateProject({ volumeDisplay: e.target.value as any })}
                            className="w-full bg-gray-100 border border-gray-300 text-[9px] p-0.5"
                        >
                            <option value="graphic">Graphic</option>
                            <option value="numeric">Numeric</option>
                        </select>
                    </div>
                    <div>
                        <label className="block mb-1 font-bold text-gray-600 text-[9px]">BATT_DISPLAY</label>
                        <select 
                             value={project.settings.batteryDisplay}
                             onChange={(e) => onUpdateProject({ batteryDisplay: e.target.value as any })}
                             className="w-full bg-gray-100 border border-gray-300 text-[9px] p-0.5"
                        >
                            <option value="graphic">Graphic</option>
                            <option value="numeric">Numeric</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Line Selector */}
            <div className="bg-white p-2 border border-gray-300">
                <div className="text-[9px] font-bold text-gray-400 mb-2 uppercase">Line Selector</div>
                
                <div className="mb-2">
                    <label className="block mb-1 font-bold text-gray-600">STYLE</label>
                    <select 
                        value={project.settings.lineSelectorType || 'bar_color'}
                        onChange={(e) => onUpdateProject({ lineSelectorType: e.target.value as any })}
                        className="w-full bg-gray-100 border border-black p-1 text-xs mb-2"
                    >
                        <option value="bar_color">Bar (Solid)</option>
                        <option value="bar_gradient">Bar (Gradient)</option>
                        <option value="bar_inverse">Bar (Inverse)</option>
                        <option value="pointer">Pointer (Icon)</option>
                    </select>
                </div>

                {project.settings.lineSelectorType !== 'pointer' && project.settings.lineSelectorType !== 'bar_inverse' && (
                    <div className="space-y-2">
                        <div>
                             <label className="block mb-1 font-bold text-gray-600 text-[9px]">START_COLOR</label>
                             <div className="flex gap-2">
                                <input 
                                    type="color" 
                                    value={project.settings.selectorColor || '#ff5800'}
                                    onChange={(e) => onUpdateProject({ selectorColor: e.target.value })}
                                    className="h-5 w-5 border border-black p-0 cursor-pointer"
                                />
                                <input 
                                    type="text" 
                                    value={project.settings.selectorColor}
                                    onChange={(e) => onUpdateProject({ selectorColor: e.target.value })}
                                    className="flex-1 bg-white border border-black p-0.5 text-black font-mono uppercase text-[10px]"
                                />
                            </div>
                        </div>
                        {project.settings.lineSelectorType === 'bar_gradient' && (
                            <div>
                                <label className="block mb-1 font-bold text-gray-600 text-[9px]">END_COLOR</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="color" 
                                        value={project.settings.lineSelectorEndColor || '#ff5800'}
                                        onChange={(e) => onUpdateProject({ lineSelectorEndColor: e.target.value })}
                                        className="h-5 w-5 border border-black p-0 cursor-pointer"
                                    />
                                    <input 
                                        type="text" 
                                        value={project.settings.lineSelectorEndColor}
                                        onChange={(e) => onUpdateProject({ lineSelectorEndColor: e.target.value })}
                                        className="flex-1 bg-white border border-black p-0.5 text-black font-mono uppercase text-[10px]"
                                    />
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block mb-1 font-bold text-gray-600 text-[9px]">TEXT_COLOR</label>
                            <div className="flex gap-2">
                                <input 
                                    type="color" 
                                    value={project.settings.selectorTextColor || '#ffffff'}
                                    onChange={(e) => onUpdateProject({ selectorTextColor: e.target.value })}
                                    className="h-5 w-5 border border-black p-0 cursor-pointer"
                                />
                                <input 
                                    type="text" 
                                    value={project.settings.selectorTextColor}
                                    onChange={(e) => onUpdateProject({ selectorTextColor: e.target.value })}
                                    className="flex-1 bg-white border border-black p-0.5 text-black font-mono uppercase text-[10px]"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Colors */}
            <div className="bg-white p-2 border border-gray-300">
                <div className="text-[9px] font-bold text-gray-400 mb-2 uppercase flex justify-between items-center">
                    <span>Global Colors</span>
                    <button onClick={resetColors} className="text-[8px] underline text-red-500 hover:text-red-700">RESET</button>
                </div>
                
                <div className="mb-2">
                    <label className="block mb-1 font-bold text-gray-600">PRIMARY (BG)</label>
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

                <div className="mb-2">
                    <label className="block mb-1 font-bold text-gray-600">TEXT (FG)</label>
                    <div className="flex gap-2">
                        <input 
                            type="color" 
                            value={project.settings.foregroundColor || '#ffffff'}
                            onChange={(e) => onUpdateProject({ foregroundColor: e.target.value })}
                            className="h-6 w-6 border border-black p-0 cursor-pointer"
                        />
                         <input 
                            type="text" 
                            value={project.settings.foregroundColor}
                            onChange={(e) => onUpdateProject({ foregroundColor: e.target.value })}
                            className="flex-1 bg-white border border-black p-1 text-black font-mono uppercase"
                        />
                    </div>
                </div>
            </div>

        </div>
      </div>
    );
  }

  return (
    <div className="p-4 text-xs font-mono text-black relative">
      <div className="flex justify-between items-center mb-4 border-b border-black pb-2 bg-yellow-50 -mx-4 px-4 pt-2 border-t">
        <h3 className="font-bold text-black uppercase tracking-wider">{element.type} NODE</h3>
        <button onClick={onDeselect} className="text-gray-400 hover:text-black w-5 h-5 flex items-center justify-center border border-transparent hover:border-black transition-all" title="Deselect">
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
        
        {/* Viewport Specific Info */}
        {element.type === ElementType.VIEWPORT && (
            <div className="bg-blue-50 border border-blue-200 p-2 text-[10px] text-blue-800 mt-4">
                <strong>UI VIEWPORT (%Vi)</strong>
                <p className="mt-1 opacity-75">
                    This area defines where the main menu, playlists, and file browser will appear. Content is simulated using global theme colors.
                </p>
                <p className="mt-2 font-bold">
                    Edit colors in Global Config (click background).
                </p>
            </div>
        )}

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
                     <FontSelector 
                        currentFontId={(element as any).fontId} 
                        onChange={(newId) => onUpdate(element.id, { fontId: newId })}
                     />
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

        {/* Delete Element Button */}
        <div className="pt-6 mt-4 border-t border-gray-300">
            <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-2 bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white hover:border-black font-bold uppercase text-[10px] shadow-sm active:translate-y-[1px] active:shadow-none transition-all"
            >
                Delete Element
            </button>
        </div>

        {/* Confirmation Modal */}
        {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-[#e0e0e0] border-2 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] w-full max-w-xs p-4 text-center animate-bounce-in">
                    <div className="w-10 h-10 bg-white border border-black rounded-full flex items-center justify-center mx-auto mb-3 shadow-[2px_2px_0px_rgba(0,0,0,0.1)]">
                         <span className="text-xl">🗑️</span>
                    </div>
                    <h4 className="font-bold text-sm uppercase mb-2 tracking-wide text-gray-800">Confirm Deletion</h4>
                    <p className="text-[10px] text-gray-600 mb-6 leading-relaxed bg-white border border-gray-300 p-2 font-mono">
                        Permanently remove <br/>
                        <span className="font-bold text-black uppercase">"{element.name}"</span> 
                        <br/>
                        <span className="opacity-50">({element.type})</span> ?
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button 
                            onClick={() => setShowDeleteConfirm(false)}
                            className="flex-1 py-2 bg-white border border-black font-bold hover:bg-gray-50 uppercase text-[10px] shadow-[2px_2px_0px_rgba(0,0,0,0.1)] active:translate-y-[1px] active:shadow-none"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => {
                                onDelete(element.id);
                                setShowDeleteConfirm(false);
                            }}
                            className="flex-1 py-2 bg-red-600 text-white font-bold border border-black shadow-[2px_2px_0px_black] active:translate-y-[1px] active:shadow-none hover:bg-red-500 uppercase text-[10px]"
                        >
                            Yes, Delete
                        </button>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};
