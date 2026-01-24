import React, { useState, useRef } from 'react';
import { ProjectState, ElementType, WpsElement, ImageElement, SongMetadata, SimulationState, ThemeConfig, LayoutStyle, ThemeFont } from './types';
import { DEFAULT_PROJECT, DEFAULT_SONG, DEFAULT_SIMULATION, IPOD_SCREEN_HEIGHT, IPOD_SCREEN_WIDTH } from './constants';
import { EditorCanvas } from './components/EditorCanvas';
import { PropertyPanel } from './components/PropertyPanel';
import { SimulationPanel } from './components/SimulationPanel';
import { generateZip } from './services/rockboxCompiler';
import { generateThemeFromPrompt } from './services/geminiService';
import { applyThemeToProject } from './services/layoutEngine';

export default function App() {
  const [project, setProject] = useState<ProjectState>(DEFAULT_PROJECT);
  const [song, setSong] = useState<SongMetadata>(DEFAULT_SONG);
  const [sim, setSim] = useState<SimulationState>(DEFAULT_SIMULATION);
  
  const [showGrid, setShowGrid] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [zoom, setZoom] = useState(1.5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptText, setPromptText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadProjectInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateElement = (id: string, updates: Partial<WpsElement>) => {
    setProject(prev => ({
      ...prev,
      elements: prev.elements.map(el => el.id === id ? { ...el, ...updates } as WpsElement : el)
    }));
  };

  const handleSelectElement = (id: string) => {
    setProject(prev => ({
      ...prev,
      selectedElementIds: id ? [id] : []
    }));
  };

  const handleUpdateProjectSettings = (updates: Partial<ProjectState['settings']>) => {
    setProject(prev => ({
      ...prev,
      settings: { ...prev.settings, ...updates }
    }));
  };

  const handleAddElement = (type: ElementType) => {
    if (type === ElementType.IMAGE) {
        fileInputRef.current?.click();
        return;
    }

    const base = {
        id: Math.random().toString(36).substr(2, 9),
        name: `New ${type}`,
        x: 10, y: 10,
        visible: true, locked: false,
    };

    let newEl: WpsElement;

    switch (type) {
        case ElementType.TEXT:
            newEl = { ...base, type, width: 100, height: 20, content: 'Text', fontId: '14-Nimbus.fnt', align: 'left', color: '#FFFFFF' } as any;
            break;
        case ElementType.RECT:
            newEl = { ...base, type, width: 50, height: 50, color: '#FF0000' } as any;
            break;
        case ElementType.PROGRESS_BAR:
            newEl = { ...base, type, width: 200, height: 10, foreColor: '#FFFFFF', backColor: '#555555' } as any;
            break;
        default: return;
    }

    setProject(prev => ({
        ...prev,
        elements: [...prev.elements, newEl],
        selectedElementIds: [newEl.id]
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
          const result = ev.target?.result as string;
          const newEl: ImageElement = {
              id: Math.random().toString(36).substr(2, 9),
              name: file.name,
              type: ElementType.IMAGE,
              x: 0, y: 0,
              width: 100, height: 100, 
              visible: true, locked: false,
              src: result,
              filename: file.name
          };

          setProject(prev => ({
              ...prev,
              assets: { ...prev.assets, [file.name]: result },
              elements: [...prev.elements, newEl],
              selectedElementIds: [newEl.id]
          }));
      };
      reader.readAsDataURL(file);
      e.target.value = ''; 
  };

  const handleDeleteElement = (id: string) => {
    setProject(prev => ({
        ...prev,
        elements: prev.elements.filter(el => el.id !== id),
        selectedElementIds: []
    }));
  };

  const handleExport = async () => {
    const zipBlob = await generateZip(project);
    if (zipBlob) {
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.settings.name.replace(/\s+/g, '_').toLowerCase()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } else {
        alert("Failed to generate ZIP. Is JSZip loaded?");
    }
  };

  const handleSaveProject = () => {
      const json = JSON.stringify(project, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.settings.name.replace(/\s+/g, '_').toLowerCase()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const loaded = JSON.parse(ev.target?.result as string);
              setProject(loaded);
          } catch (err) {
              alert("Invalid Project JSON");
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const handleAiGenerate = async () => {
      if (!promptText.trim()) return;
      setIsGenerating(true);
      
      // Current config as a base
      const currentConfig: ThemeConfig = {
          name: project.settings.name,
          colors: {
              background: project.settings.backgroundColor,
              foreground: '#ffffff',
              accent: '#ff0000',
              barBackground: '#333333',
              barForeground: '#ffffff'
          },
          font: ThemeFont.NIMBUS_14,
          showAlbumArt: true,
          showNextSong: false,
          statusBar: project.settings.statusBarTop,
          layout: LayoutStyle.MINIMAL
      };

      const generatedConfig = await generateThemeFromPrompt(promptText, currentConfig);
      
      if (generatedConfig) {
          // Merge partial config with defaults where necessary
          const fullConfig: ThemeConfig = { ...currentConfig, ...generatedConfig };
          const newProject = applyThemeToProject(project, fullConfig);
          setProject(newProject);
          setPromptOpen(false);
          setPromptText('');
      } else {
          alert("Could not generate theme. Check API Key or try a different prompt.");
      }
      setIsGenerating(false);
  };

  const alignElement = (align: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
      const id = project.selectedElementIds[0];
      if (!id) return;
      
      const el = project.elements.find(e => e.id === id);
      if (!el) return;

      let newX = el.x;
      let newY = el.y;

      switch(align) {
          case 'left': newX = 0; break;
          case 'center': newX = Math.round((IPOD_SCREEN_WIDTH - el.width) / 2); break;
          case 'right': newX = IPOD_SCREEN_WIDTH - el.width; break;
          case 'top': newY = 0; break;
          case 'middle': newY = Math.round((IPOD_SCREEN_HEIGHT - el.height) / 2); break;
          case 'bottom': newY = IPOD_SCREEN_HEIGHT - el.height; break;
      }
      handleUpdateElement(id, { x: newX, y: newY });
  };

  const selectedElement = project.elements.find(el => project.selectedElementIds.includes(el.id)) || null;

  return (
    <div className="flex h-screen w-screen bg-[#111] text-gray-200 overflow-hidden font-sans relative">
      
      {/* AI Prompt Modal */}
      {promptOpen && (
          <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-[#252525] border border-[#333] rounded-lg p-6 w-full max-w-md shadow-2xl">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <span className="text-orange-500">✨</span> AI Designer
                  </h3>
                  <textarea 
                    value={promptText}
                    onChange={e => setPromptText(e.target.value)}
                    placeholder="Describe your theme... (e.g., 'Minimalist Dieter Rams style with orange accents and split layout')"
                    className="w-full h-32 bg-[#111] border border-[#333] rounded p-3 text-sm focus:border-orange-500 outline-none resize-none mb-4"
                  />
                  <div className="flex justify-end gap-3">
                      <button 
                        onClick={() => setPromptOpen(false)}
                        className="px-4 py-2 rounded text-sm hover:bg-[#333]"
                      >
                          Cancel
                      </button>
                      <button 
                        onClick={handleAiGenerate}
                        disabled={isGenerating}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded text-sm font-medium flex items-center gap-2"
                      >
                          {isGenerating ? 'Designing...' : 'Generate Theme'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* TOOLBAR (Left) */}
      <div className="w-16 bg-[#1e1e1e] border-r border-[#333] flex flex-col items-center py-4 gap-4 z-20">
        <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center font-bold text-white mb-4">R</div>
        
        <ToolButton icon="T" label="Text" onClick={() => handleAddElement(ElementType.TEXT)} />
        <ToolButton icon="□" label="Rect" onClick={() => handleAddElement(ElementType.RECT)} />
        <ToolButton icon="=" label="Bar" onClick={() => handleAddElement(ElementType.PROGRESS_BAR)} />
        <ToolButton icon="IMG" label="Image" onClick={() => handleAddElement(ElementType.IMAGE)} />
        
        <div className="w-8 h-[1px] bg-[#333] my-2" />
        
        <button 
            onClick={() => setPromptOpen(true)}
            className="w-10 h-10 rounded flex flex-col items-center justify-center gap-0.5 hover:bg-[#333] transition-colors text-yellow-400 group"
            title="AI Designer"
        >
            <span className="text-lg font-bold group-hover:scale-110 transition-transform">✨</span>
        </button>

        <ToolButton icon="💾" label="Save" onClick={handleSaveProject} />
        <ToolButton icon="📂" label="Open" onClick={() => loadProjectInputRef.current?.click()} />

        <div className="flex-1" />
        <ToolButton icon="⬇" label="Zip" onClick={handleExport} active />
        
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
        <input type="file" ref={loadProjectInputRef} className="hidden" accept=".json" onChange={handleLoadProject} />
      </div>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="h-12 bg-[#1e1e1e] border-b border-[#333] flex items-center px-4 justify-between">
            <div className="flex items-center gap-4">
                 <div className="font-medium text-sm text-gray-400">{project.settings.name}</div>
                 
                 {/* Alignment Controls */}
                 {selectedElement && (
                     <div className="flex gap-1 border-l border-[#333] pl-4">
                        <ToolIconBtn onClick={() => alignElement('left')} title="Align Left">⇤</ToolIconBtn>
                        <ToolIconBtn onClick={() => alignElement('center')} title="Align Center">↔</ToolIconBtn>
                        <ToolIconBtn onClick={() => alignElement('right')} title="Align Right">⇥</ToolIconBtn>
                        <span className="w-2" />
                        <ToolIconBtn onClick={() => alignElement('top')} title="Align Top">⤒</ToolIconBtn>
                        <ToolIconBtn onClick={() => alignElement('middle')} title="Align Middle">↕</ToolIconBtn>
                        <ToolIconBtn onClick={() => alignElement('bottom')} title="Align Bottom">⤓</ToolIconBtn>
                     </div>
                 )}
            </div>

            <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} /> Grid
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={showGuides} onChange={e => setShowGuides(e.target.checked)} /> Guides
                </label>
                <div className="flex items-center gap-2 border-l border-[#333] pl-4">
                    <span>Zoom</span>
                    <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="hover:bg-gray-700 px-1 rounded">-</button>
                    <span className="w-8 text-center">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="hover:bg-gray-700 px-1 rounded">+</button>
                </div>
            </div>
        </div>

        {/* Canvas Scroll Area */}
        <div className="flex-1 overflow-auto bg-[#111] relative flex items-center justify-center p-20">
            <EditorCanvas 
                project={project} 
                song={song}
                sim={sim}
                scale={zoom}
                showGrid={showGrid}
                showGuides={showGuides}
                onSelectElement={handleSelectElement}
                onUpdateElement={handleUpdateElement}
            />
        </div>
        
        {/* Simulation Control Panel */}
        <SimulationPanel 
            sim={sim}
            meta={song}
            onUpdateSim={(updates) => setSim(prev => ({ ...prev, ...updates }))}
            onUpdateMeta={(updates) => setSong(prev => ({ ...prev, ...updates }))}
        />
      </div>

      {/* PROPERTIES (Right) */}
      <div className="w-64 bg-[#1e1e1e] border-l border-[#333] flex flex-col z-20">
          <div className="h-8 bg-[#252525] border-b border-[#333] flex items-center px-4 text-xs font-bold uppercase tracking-wider text-gray-500">
              Inspector
          </div>
          <div className="flex-1 overflow-y-auto">
            <PropertyPanel 
                element={selectedElement} 
                project={project} 
                onUpdate={handleUpdateElement}
                onUpdateProject={handleUpdateProjectSettings}
                onDelete={handleDeleteElement}
            />
          </div>
          
          <div className="h-1/3 border-t border-[#333] flex flex-col">
             <div className="h-8 bg-[#252525] border-b border-[#333] flex items-center px-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                Layers
             </div>
             <div className="flex-1 overflow-y-auto p-2 space-y-1">
                 {project.elements.map(el => (
                     <div 
                        key={el.id}
                        onClick={() => handleSelectElement(el.id)}
                        className={`text-xs px-2 py-2 rounded cursor-pointer flex items-center gap-2 ${project.selectedElementIds.includes(el.id) ? 'bg-blue-900 text-white' : 'text-gray-400 hover:bg-[#333]'}`}
                     >
                        <span className="opacity-50 w-4 text-center">
                            {el.type === ElementType.TEXT ? 'T' : 
                             el.type === ElementType.RECT ? '□' : 
                             el.type === ElementType.IMAGE ? 'IMG' : '='}
                        </span>
                        <span className="truncate">{el.name}</span>
                     </div>
                 ))}
             </div>
          </div>
      </div>

    </div>
  );
}

const ToolButton = ({ icon, label, onClick, active }: any) => (
    <button 
        onClick={onClick}
        className={`w-10 h-10 rounded flex flex-col items-center justify-center gap-0.5 hover:bg-[#333] transition-colors ${active ? 'bg-orange-600 hover:bg-orange-500 text-white' : 'text-gray-400'}`}
        title={label}
    >
        <span className="text-sm font-bold">{icon}</span>
    </button>
);

const ToolIconBtn = ({ children, onClick, title }: any) => (
    <button 
        onClick={onClick} 
        className="w-6 h-6 hover:bg-gray-700 rounded text-gray-300 text-lg flex items-center justify-center leading-none"
        title={title}
    >
        {children}
    </button>
);
