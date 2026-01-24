import React, { useState, useRef, useEffect } from 'react';
import { ProjectState, ElementType, WpsElement, ImageElement, SongMetadata, SimulationState, ThemeConfig, LayoutStyle, ThemeFont, ScreenType } from './types';
import { DEFAULT_PROJECT, DEFAULT_SONG, DEFAULT_SIMULATION, IPOD_SCREEN_HEIGHT, IPOD_SCREEN_WIDTH } from './constants';
import { EditorCanvas } from './components/EditorCanvas';
import { PropertyPanel } from './components/PropertyPanel';
import { SimulationPanel } from './components/SimulationPanel';
import { CodePreview } from './components/CodePreview';
import { RemixModal } from './components/RemixModal';
import { FileBrowser } from './components/FileBrowser';
import { ElementLibraryModal } from './components/ElementLibraryModal';
import { MainMenuModal } from './components/MainMenuModal';
import { generateZip } from './services/rockboxCompiler';
import { parseZipTheme } from './services/rockboxParser';
import { generateThemeFromPrompt } from './services/geminiService';
import { applyThemeToProject } from './services/layoutEngine';
import { parseAudioFile } from './services/audioService';
import { useHistory } from './hooks/useHistory';

export default function App() {
  const { 
    state: project, 
    set: setProject, 
    undo, 
    redo, 
    canUndo, 
    canRedo 
  } = useHistory<ProjectState>(DEFAULT_PROJECT);

  const [song, setSong] = useState<SongMetadata>(DEFAULT_SONG);
  const [sim, setSim] = useState<SimulationState>(DEFAULT_SIMULATION);
  
  const [activeScreen, setActiveScreen] = useState<ScreenType>('wps');
  const [rightPanelMode, setRightPanelMode] = useState<'inspector' | 'files'>('inspector');
  const [showGrid, setShowGrid] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [showRemixModal, setShowRemixModal] = useState(false);
  const [showLibModal, setShowLibModal] = useState(false);
  const [showMainMenu, setShowMainMenu] = useState(false);
  
  // New state for Layer Stack
  const [isLayerStackCollapsed, setIsLayerStackCollapsed] = useState(false);

  const [zoom, setZoom] = useState(1.5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptText, setPromptText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadProjectInputRef = useRef<HTMLInputElement>(null);
  const importZipInputRef = useRef<HTMLInputElement>(null);
  const resourceInputRef = useRef<HTMLInputElement>(null);
  const globalFontInputRef = useRef<HTMLInputElement>(null);

  // Keyboard Shortcuts (Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (['Delete', 'Backspace'].includes(e.key)) {
            // Check if we are focusing an input, if so, don't delete element
            const activeTag = document.activeElement?.tagName.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea') return;
            
            if (project.selectedElementIds.length > 0) {
                const idToDelete = project.selectedElementIds[0];
                handleDeleteElement(idToDelete);
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project.selectedElementIds, project.elements]);

  const handleUpdateElement = (id: string, updates: Partial<WpsElement>) => {
    setProject({
      ...project,
      elements: project.elements.map(el => el.id === id ? { ...el, ...updates } as WpsElement : el)
    });
  };

  const handleSelectElement = (id: string) => {
    setProject({
      ...project,
      selectedElementIds: id ? [id] : []
    });
    // If selecting an element, switch to inspector to edit it
    if (id) setRightPanelMode('inspector');
  };

  const handleUpdateProjectSettings = (updates: Partial<ProjectState['settings']>, newAsset?: { name: string, data: string }) => {
    const newState = {
      ...project,
      settings: { ...project.settings, ...updates },
      assets: newAsset ? { ...project.assets, [newAsset.name]: newAsset.data } : project.assets
    };
    setProject(newState);
  };

  const handleAddPreset = (preset: Partial<WpsElement>) => {
      const newEl = {
          id: Math.random().toString(36).substr(2, 9),
          screen: activeScreen,
          x: 10, 
          y: 10,
          visible: true, 
          locked: false,
          fontId: '14-Nimbus.fnt', // Default font
          ...preset
      } as WpsElement;

      setProject({
        ...project,
        elements: [...project.elements, newEl],
        selectedElementIds: [newEl.id]
    });
  };

  const handleAddElement = (type: ElementType) => {
    if (type === ElementType.IMAGE) {
        fileInputRef.current?.click();
        return;
    }

    const base = {
        id: Math.random().toString(36).substr(2, 9),
        name: `New ${type}`,
        screen: activeScreen,
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

    setProject({
        ...project,
        elements: [...project.elements, newEl],
        selectedElementIds: [newEl.id]
    });
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
              screen: activeScreen,
              x: 0, y: 0,
              width: 100, height: 100, 
              visible: true, locked: false,
              src: result,
              filename: file.name
          };

          setProject({
              ...project,
              assets: { ...project.assets, [file.name]: result },
              elements: [...project.elements, newEl],
              selectedElementIds: [newEl.id]
          });
      };
      reader.readAsDataURL(file);
      e.target.value = ''; 
  };
  
  const handleResourceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Simulates loading firmware resources by adding them to assets
      const files = e.target.files;
      if (!files) return;

      const newAssets = { ...project.assets };
      
      Array.from(files).forEach(file => {
          const reader = new FileReader();
          reader.onload = (ev) => {
              newAssets[file.name] = ev.target?.result as string;
              // If last file
              setProject({ ...project, assets: newAssets });
          };
          reader.readAsDataURL(file);
      });
      e.target.value = '';
      alert(`${files.length} resources loaded. Images/Fonts are now available in the asset pool.`);
  };

  const handleGlobalFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.fnt')) {
          alert("Please upload a .fnt file");
          return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
          const result = ev.target?.result as string;
          // Add to assets, don't change selection
          setProject({
              ...project,
              assets: { ...project.assets, [file.name]: result }
          });
          alert(`Font "${file.name}" imported to Assets.`);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
  };

  const handleTrackUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
        const metadata = await parseAudioFile(file);
        setSong(metadata);
        // Reset simulation to start
        setSim(prev => ({ ...prev, playStatus: 'play' }));
    } catch (error) {
        console.error(error);
        alert("Failed to load audio file.");
    }
    e.target.value = '';
  };

  const handleDeleteElement = (id: string) => {
    setProject({
        ...project,
        elements: project.elements.filter(el => el.id !== id),
        selectedElementIds: []
    });
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

  const handleLoadProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Handle JSON import (native project format)
      if (file.name.endsWith('.json')) {
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
      } else {
          alert("Please upload a valid .json project file.");
      }
      e.target.value = '';
  };

  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
       const file = e.target.files?.[0];
       if (!file) return;
       
       if (file.name.endsWith('.zip')) {
          const importedProject = await parseZipTheme(file);
          if (importedProject) {
              setProject(importedProject);
              setShowRemixModal(true);
          }
      } else {
          alert("Please select a valid Rockbox .zip theme file.");
      }
      e.target.value = '';
  };

  const handleNewProject = () => {
      if (confirm("Create new project? Unsaved changes will be lost.")) {
          setProject(DEFAULT_PROJECT);
      }
  };

  const handleAiGenerate = async () => {
      if (!promptText.trim()) return;
      setIsGenerating(true);
      
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
    <div className="flex h-screen w-screen bg-[#333] text-[#111] overflow-hidden font-sans relative">
      
      {/* Code Preview Overlay */}
      {showCode && <CodePreview project={project} onClose={() => setShowCode(false)} />}
      
      {/* Remix Etiquette Modal */}
      <RemixModal isOpen={showRemixModal} onClose={() => setShowRemixModal(false)} />

      {/* Main Menu Modal */}
      <MainMenuModal 
        isOpen={showMainMenu} 
        onClose={() => setShowMainMenu(false)}
        onNew={handleNewProject}
        onOpen={() => loadProjectInputRef.current?.click()}
        onSave={handleSaveProject}
        onExport={handleExport}
        onImportZip={() => importZipInputRef.current?.click()}
        onImportFont={() => globalFontInputRef.current?.click()}
      />

      {/* Basic Elements Library Modal */}
      <ElementLibraryModal 
        isOpen={showLibModal} 
        onClose={() => setShowLibModal(false)} 
        onAddElement={handleAddPreset}
        activeScreen={activeScreen}
      />

      {/* AI Prompt Modal */}
      {promptOpen && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#e5e5e5] border-2 border-black p-6 w-full max-w-md shadow-[8px_8px_0px_rgba(0,0,0,1)]">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2 font-mono uppercase tracking-tighter">
                      <span className="text-orange-600">⚡</span> AI_Designer.exe
                  </h3>
                  <textarea 
                    value={promptText}
                    onChange={e => setPromptText(e.target.value)}
                    placeholder="Describe your theme... (e.g., 'Minimalist Dieter Rams style with orange accents and split layout')"
                    className="w-full h-32 bg-white border border-black p-3 text-sm focus:border-orange-500 outline-none resize-none mb-4 font-mono"
                  />
                  <div className="flex justify-end gap-3">
                      <button 
                        onClick={() => setPromptOpen(false)}
                        className="px-4 py-2 text-sm hover:bg-gray-300 font-bold border border-transparent hover:border-black uppercase"
                      >
                          Cancel
                      </button>
                      <button 
                        onClick={handleAiGenerate}
                        disabled={isGenerating}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold flex items-center gap-2 border border-black uppercase shadow-[2px_2px_0px_black] active:translate-y-[1px] active:shadow-none transition-all"
                      >
                          {isGenerating ? 'PROCESSING...' : 'RUN GENERATOR'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* TOOLBAR (Left) */}
      <div className="w-18 pinstripe border-r border-black flex flex-col items-center py-4 gap-4 z-20">
        <button 
            onClick={() => setShowMainMenu(true)}
            className="w-10 h-10 bg-orange-600 flex items-center justify-center font-bold text-white text-xl border border-black shadow-[2px_2px_0px_black] hover:bg-orange-500 active:translate-y-[1px] active:shadow-none transition-all"
        >
            R
        </button>
        
        <div className="flex flex-col gap-2 w-full px-2">
            <div className="text-[9px] font-bold text-center uppercase opacity-50 tracking-wider">Tools</div>
            {/* New Library Button */}
            <ToolButton 
                icon="⊕" 
                label="Library" 
                onClick={() => setShowLibModal(true)} 
                active={showLibModal}
                className="mb-2"
            />
            
            <ToolButton icon="T" label="Text" onClick={() => handleAddElement(ElementType.TEXT)} />
            <ToolButton icon="□" label="Rect" onClick={() => handleAddElement(ElementType.RECT)} />
            <ToolButton icon="=" label="Bar" onClick={() => handleAddElement(ElementType.PROGRESS_BAR)} />
            <ToolButton icon="IMG" label="Image" onClick={() => handleAddElement(ElementType.IMAGE)} />
        </div>
        
        <div className="w-full px-2">
            <div className="h-[2px] bg-black/10 my-2" />
        </div>
        
        <div className="flex flex-col gap-2 w-full px-2">
            <div className="text-[9px] font-bold text-center uppercase opacity-50 tracking-wider">Edit</div>
             <ToolButton 
                icon="↩" 
                label="Undo" 
                onClick={undo} 
                disabled={!canUndo} 
                className={!canUndo ? 'opacity-30' : ''}
             />
             <ToolButton 
                icon="↪" 
                label="Redo" 
                onClick={redo} 
                disabled={!canRedo} 
                className={!canRedo ? 'opacity-30' : ''}
             />
        </div>

        <div className="flex-1" />
        
        <button 
            onClick={() => resourceInputRef.current?.click()}
            className="w-10 h-10 rounded-sm border border-black flex items-center justify-center hover:bg-white hover:shadow-sm transition-colors bg-[#d4d4d4] group"
            title="Load Firmware Resources (Images/Fonts)"
        >
             <span className="text-lg">📦</span>
        </button>

        <button 
            onClick={() => setPromptOpen(true)}
            className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center hover:bg-yellow-400 transition-colors bg-white group shadow-[2px_2px_0px_rgba(0,0,0,0.2)]"
            title="AI Designer"
        >
            <span className="text-lg font-bold group-hover:scale-110 transition-transform">✨</span>
        </button>

        <div className="flex flex-col gap-2 w-full px-2 pb-2">
            <ToolButton icon="💾" label="Save" onClick={handleSaveProject} />
            <ToolButton icon="⬇" label="Zip" onClick={handleExport} />
        </div>
        
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
        <input type="file" ref={loadProjectInputRef} className="hidden" accept=".json" onChange={handleLoadProject} />
        <input type="file" ref={importZipInputRef} className="hidden" accept=".zip" onChange={handleImportZip} />
        <input type="file" ref={resourceInputRef} className="hidden" multiple onChange={handleResourceUpload} />
        <input type="file" ref={globalFontInputRef} className="hidden" accept=".fnt" onChange={handleGlobalFontUpload} />
      </div>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#2a2a2a]">
        {/* Top Bar (Metal Gradient) */}
        <div className="h-10 metal-gradient flex items-center px-4 justify-between border-b border-black select-none">
            <div className="flex items-center gap-4">
                 <div className="font-bold text-xs text-gray-600 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 border border-black/20"></div>
                    {project.settings.name}
                 </div>

                 {/* View Switcher (WPS / SBS) */}
                 <div className="flex bg-[#d4d4d4] p-0.5 rounded border border-[#999] shadow-inner">
                    <button 
                        onClick={() => setActiveScreen('wps')}
                        className={`px-3 py-0.5 text-[10px] font-bold rounded-sm ${activeScreen === 'wps' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}
                    >
                        WPS
                    </button>
                    <button 
                        onClick={() => setActiveScreen('sbs')}
                        className={`px-3 py-0.5 text-[10px] font-bold rounded-sm ${activeScreen === 'sbs' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}
                    >
                        SBS
                    </button>
                 </div>
                 
                 {/* Alignment Controls */}
                 {selectedElement && rightPanelMode === 'inspector' && (
                     <div className="flex gap-0.5 border-l border-black/20 pl-4">
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

            <div className="flex items-center gap-4 text-[10px] font-bold text-gray-700">
                 <button 
                    onClick={() => setShowCode(!showCode)}
                    className={`px-3 py-1 border border-gray-400 rounded-full ${showCode ? 'bg-orange-500 text-white border-orange-600' : 'bg-white hover:bg-gray-50'} transition-all`}
                 >
                    SOURCE_VIEW
                 </button>

                <div className="h-4 w-[1px] bg-black/20"></div>

                <label className="flex items-center gap-1 cursor-pointer select-none hover:text-black">
                    <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="accent-orange-600" /> GRID
                </label>
                <label className="flex items-center gap-1 cursor-pointer select-none hover:text-black">
                    <input type="checkbox" checked={showGuides} onChange={e => setShowGuides(e.target.checked)} className="accent-orange-600" /> GUIDES
                </label>
                <div className="flex items-center gap-2 border-l border-black/20 pl-4">
                    <span>ZOOM</span>
                    <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="w-5 h-5 bg-white border border-gray-400 flex items-center justify-center hover:bg-gray-100">-</button>
                    <span className="w-8 text-center bg-white border border-gray-300 px-1 py-0.5 font-mono">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="w-5 h-5 bg-white border border-gray-400 flex items-center justify-center hover:bg-gray-100">+</button>
                </div>
            </div>
        </div>

        {/* Canvas Scroll Area */}
        <div className="flex-1 overflow-auto bg-[#2a2a2a] relative flex items-center justify-center p-20 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
            <EditorCanvas 
                project={project}
                activeScreen={activeScreen}
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
            onLoadTrack={handleTrackUpload}
        />
      </div>

      {/* RIGHT PANEL (Inspector / Files) */}
      <div className="w-64 pinstripe border-l border-black flex flex-col z-20">
          <div className="h-10 metal-gradient border-b border-black flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-700 shadow-sm pl-4 pr-1">
              <span className="mr-2 opacity-50">///</span>
              <div className="flex bg-[#d4d4d4] rounded border border-[#999] p-0.5">
                  <button 
                    onClick={() => setRightPanelMode('inspector')}
                    className={`px-3 py-1 rounded-sm ${rightPanelMode === 'inspector' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}
                  >
                      Inspector
                  </button>
                  <button 
                    onClick={() => setRightPanelMode('files')}
                    className={`px-3 py-1 rounded-sm ${rightPanelMode === 'files' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}
                  >
                      Files
                  </button>
              </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
             <div className="flex-1 overflow-y-auto">
                 {rightPanelMode === 'inspector' ? (
                    <>
                        <PropertyPanel 
                            element={selectedElement} 
                            project={project} 
                            onUpdate={handleUpdateElement}
                            onUpdateProject={handleUpdateProjectSettings}
                            onDelete={handleDeleteElement}
                            onDeselect={() => handleSelectElement('')}
                        />
                    </>
                 ) : (
                     <FileBrowser project={project} />
                 )}
             </div>

             {/* Minimizable Layer Stack */}
             {rightPanelMode === 'inspector' && (
                <div 
                    className={`border-t border-black flex flex-col bg-[#e0e0e0] sticky bottom-0 flex-shrink-0 transition-all duration-300 ease-in-out
                    ${isLayerStackCollapsed ? 'h-8' : 'h-1/3'}`}
                >
                     <div 
                        onClick={() => setIsLayerStackCollapsed(!isLayerStackCollapsed)}
                        className="h-8 bg-[#d4d4d4] border-b border-black flex items-center justify-between px-4 text-[10px] font-bold uppercase tracking-wider text-gray-600 cursor-pointer hover:bg-gray-300 select-none"
                     >
                        <span>Layer_Stack ({activeScreen.toUpperCase()})</span>
                        <span>{isLayerStackCollapsed ? '▲' : '▼'}</span>
                     </div>
                     
                     {!isLayerStackCollapsed && (
                         <div className="flex-1 overflow-y-auto p-2 space-y-1">
                             {project.elements.filter(el => el.screen === activeScreen).map(el => (
                                 <div 
                                    key={el.id}
                                    onClick={() => handleSelectElement(el.id)}
                                    className={`text-[10px] px-2 py-2 border border-transparent cursor-pointer flex items-center gap-2 font-mono ${project.selectedElementIds.includes(el.id) ? 'bg-orange-600 text-white border-black shadow-sm' : 'text-gray-600 hover:bg-white hover:border-gray-300'}`}
                                 >
                                    <span className="opacity-50 w-4 text-center font-bold">
                                        {el.type === ElementType.TEXT ? 'T' : 
                                         el.type === ElementType.RECT ? '□' : 
                                         el.type === ElementType.IMAGE ? 'IMG' : '='}
                                    </span>
                                    <span className="truncate uppercase">{el.name}</span>
                                 </div>
                             ))}
                         </div>
                     )}
                </div>
             )}
          </div>
      </div>

    </div>
  );
}

const ToolButton = ({ icon, label, onClick, active, disabled, className }: any) => (
    <button 
        onClick={onClick}
        disabled={disabled}
        className={`w-full h-8 rounded-sm flex items-center justify-center gap-2 transition-all te-button
            ${active 
                ? 'bg-orange-600 text-white border border-black shadow-none translate-y-[1px]' 
                : 'bg-white text-black border border-gray-400 border-b-gray-600 border-r-gray-600 hover:bg-gray-50'} 
            ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-200 border-gray-300' : ''}
            ${className}`}
        title={label}
    >
        <span className="text-xs font-bold font-mono">{icon}</span>
    </button>
);

const ToolIconBtn = ({ children, onClick, title }: any) => (
    <button 
        onClick={onClick} 
        className="w-6 h-6 hover:bg-black/10 rounded-sm text-black text-sm flex items-center justify-center leading-none active:translate-y-[1px]"
        title={title}
    >
        {children}
    </button>
);