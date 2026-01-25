
import React, { useState, useRef, useEffect } from 'react';
import { ProjectState, ElementType, WpsElement, ImageElement, SongMetadata, SimulationState, ThemeConfig, LayoutStyle, ThemeFont, ScreenType, User } from './types';
import { DEFAULT_PROJECT, DEFAULT_SONG, DEFAULT_SIMULATION, IPOD_SCREEN_HEIGHT, IPOD_SCREEN_WIDTH } from './constants';
import { EditorCanvas } from './components/EditorCanvas';
import { PropertyPanel } from './components/PropertyPanel';
import { SimulationPanel } from './components/SimulationPanel';
import { SourceEditor } from './components/SourceEditor';
import { RemixModal } from './components/RemixModal';
import { FileBrowser } from './components/FileBrowser';
import { ElementLibraryModal } from './components/ElementLibraryModal';
import { MainMenuModal } from './components/MainMenuModal';
import { LoginModal } from './components/LoginModal';
import { ProjectManagerModal } from './components/ProjectManagerModal';
import { ColorPaletteModal } from './components/ColorPaletteModal';
import { generateZip } from './services/rockboxCompiler';
import { parseZipTheme } from './services/rockboxParser';
import { generateThemeFromPrompt } from './services/geminiService';
import { applyThemeToProject } from './services/layoutEngine';
import { parseAudioFile } from './services/audioService';
import { storageService } from './services/storageService';
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

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showCloudProjects, setShowCloudProjects] = useState(false);

  const [song, setSong] = useState<SongMetadata>(DEFAULT_SONG);
  const [sim, setSim] = useState<SimulationState>(DEFAULT_SIMULATION);
  
  const [activeScreen, setActiveScreen] = useState<ScreenType>('wps');
  const [rightPanelMode, setRightPanelMode] = useState<'inspector' | 'files' | 'settings'>('inspector');
  const [showGrid, setShowGrid] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [showSource, setShowSource] = useState(false);
  const [showRemixModal, setShowRemixModal] = useState(false);
  const [showLibModal, setShowLibModal] = useState(false);
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  
  const [isLayerStackCollapsed, setIsLayerStackCollapsed] = useState(false);
  const [zoom, setZoom] = useState(1.5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptText, setPromptText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadProjectInputRef = useRef<HTMLInputElement>(null);
  const importZipInputRef = useRef<HTMLInputElement>(null);
  const globalFontInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      const session = storageService.getSession();
      if (session) {
          setUser(session);
      } else {
          setShowLogin(true);
      }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (['Delete', 'Backspace'].includes(e.key)) {
            const activeTag = document.activeElement?.tagName.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea') return;
            if (project.selectedElementIds.length > 0) {
                handleDeleteElement(project.selectedElementIds[0]);
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
    setProject({ ...project, selectedElementIds: id ? [id] : [] });
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
          x: 10, y: 10, visible: true, locked: false,
          fontId: '14-Nimbus.fnt',
          ...preset
      } as WpsElement;

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
              x: 0, y: 0, width: 100, height: 100, 
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
  
  const handleResourceUpload = (files: FileList) => {
      if (!files) return;
      const newAssets = { ...project.assets };
      Array.from(files).forEach(file => {
          const reader = new FileReader();
          reader.onload = (ev) => {
              newAssets[file.name] = ev.target?.result as string;
              setProject({ ...project, assets: newAssets });
          };
          reader.readAsDataURL(file);
      });
      alert(`${files.length} resources loaded.`);
  };

  const handleGlobalFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.fnt')) { alert("Please upload a .fnt file"); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
          setProject({ ...project, assets: { ...project.assets, [file.name]: ev.target?.result as string } });
          alert(`Font "${file.name}" imported.`);
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
        setSim(prev => ({ ...prev, playStatus: 'play' }));
    } catch (error) {
        alert("Failed to load audio file.");
    }
    e.target.value = '';
  };

  const handleDeleteElement = (id: string) => {
    setProject({ ...project, elements: project.elements.filter(el => el.id !== id), selectedElementIds: [] });
  };

  const handleDuplicateElement = () => {
     const id = project.selectedElementIds[0];
     if (!id) return;
     const el = project.elements.find(e => e.id === id);
     if (!el) return;
     const newEl = { ...el, id: Math.random().toString(36).substr(2, 9), name: `${el.name} (Copy)`, x: el.x + 10, y: el.y + 10 };
     setProject({ ...project, elements: [...project.elements, newEl], selectedElementIds: [newEl.id] });
  };

  const handleMoveLayer = (direction: 'up' | 'down') => {
      const id = project.selectedElementIds[0];
      if (!id) return;
      const idx = project.elements.findIndex(e => e.id === id);
      if (idx === -1) return;
      const newElements = [...project.elements];
      if (direction === 'up' && idx < newElements.length - 1) {
          [newElements[idx], newElements[idx + 1]] = [newElements[idx + 1], newElements[idx]];
      } else if (direction === 'down' && idx > 0) {
          [newElements[idx], newElements[idx - 1]] = [newElements[idx - 1], newElements[idx]];
      }
      setProject({ ...project, elements: newElements });
  };

  const handleToggleLock = () => {
      const id = project.selectedElementIds[0];
      if (id) {
          const el = project.elements.find(e => e.id === id);
          if (el) handleUpdateElement(id, { locked: !el.locked });
      }
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

  const handleSaveProject = async () => {
      if (user) {
          try {
             await storageService.saveProject(user, project);
             alert(`Project "${project.settings.name}" saved to cloud!`);
          } catch (e: any) { alert(e.message || "Failed to save"); }
      } else {
          const json = JSON.stringify(project, null, 2);
          const blob = new Blob([json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${project.settings.name.replace(/\s+/g, '_').toLowerCase()}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
      }
  };

  const handleLoadProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.name.endsWith('.json')) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              try { setProject(JSON.parse(ev.target?.result as string)); } catch (err) { alert("Invalid Project JSON"); }
          };
          reader.readAsText(file);
      } else { alert("Please upload a valid .json project file."); }
      e.target.value = '';
  };

  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
       const file = e.target.files?.[0];
       if (!file) return;
       if (file.name.endsWith('.zip')) {
          const importedProject = await parseZipTheme(file);
          if (importedProject) { setProject(importedProject); setShowRemixModal(true); }
      } else { alert("Please select a valid Rockbox .zip theme file."); }
      e.target.value = '';
  };

  const handleNewProject = () => { if (confirm("Create new project? Unsaved changes will be lost.")) setProject(DEFAULT_PROJECT); };

  const handleAiGenerate = async () => {
      if (!promptText.trim()) return;
      setIsGenerating(true);
      const currentConfig: ThemeConfig = {
          name: project.settings.name,
          colors: { background: project.settings.backgroundColor, foreground: '#ffffff', accent: '#ff0000', barBackground: '#333333', barForeground: '#ffffff' },
          font: ThemeFont.NIMBUS_14, showAlbumArt: true, showNextSong: false, statusBar: project.settings.statusBarTop, layout: LayoutStyle.MINIMAL
      };
      const generatedConfig = await generateThemeFromPrompt(promptText, currentConfig);
      if (generatedConfig) {
          const fullConfig: ThemeConfig = { ...currentConfig, ...generatedConfig };
          setProject(applyThemeToProject(project, fullConfig));
          setPromptOpen(false); setPromptText('');
      } else { alert("Could not generate theme."); }
      setIsGenerating(false);
  };

  const alignElement = (align: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
      const id = project.selectedElementIds[0];
      if (!id) return;
      const el = project.elements.find(e => e.id === id);
      if (!el) return;
      let newX = el.x; let newY = el.y;
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

  const handleLogout = () => { if(confirm("Log out? Unsaved work will be cleared.")) { storageService.logout(); setUser(null); setShowLogin(true); } }
  const selectedElement = project.elements.find(el => project.selectedElementIds.includes(el.id)) || null;

  const TabButton = ({ id, label }: { id: ScreenType, label: string }) => (
      <button onClick={() => setActiveScreen(id)} className={`px-4 py-2 text-xs font-bold rounded-sm uppercase ${activeScreen === id ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}>{label}</button>
  );

  return (
    <div className="flex h-screen w-screen bg-[#333] text-[#111] overflow-hidden font-sans relative">
      <LoginModal isOpen={showLogin && !user} onLoginSuccess={(u) => { setUser(u); setShowLogin(false); }} />
      {user && <ProjectManagerModal isOpen={showCloudProjects} onClose={() => setShowCloudProjects(false)} user={user} onLoadProject={(p) => setProject(p)} />}
      {showSource && <SourceEditor project={project} onClose={() => setShowSource(false)} onApplyChanges={() => {}} />}
      <RemixModal isOpen={showRemixModal} onClose={() => setShowRemixModal(false)} />
      <MainMenuModal isOpen={showMainMenu} onClose={() => setShowMainMenu(false)} onNew={handleNewProject} onOpen={() => setShowCloudProjects(true)} onSave={handleSaveProject} onExport={handleExport} onImportZip={() => importZipInputRef.current?.click()} onImportFont={() => globalFontInputRef.current?.click()} />
      <ElementLibraryModal isOpen={showLibModal} onClose={() => setShowLibModal(false)} onAddElement={handleAddPreset} activeScreen={activeScreen} />
      <ColorPaletteModal isOpen={showPalette} onClose={() => setShowPalette(false)} palette={project.settings.palette} onUpdatePalette={(p) => handleUpdateProjectSettings({ palette: p })} />

      {/* AI Prompt Modal */}
      {promptOpen && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#e5e5e5] border-2 border-black p-6 w-full max-w-md shadow-[8px_8px_0px_rgba(0,0,0,1)]">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2 font-mono uppercase tracking-tighter"><span className="text-orange-600">⚡</span> AI_Designer.exe</h3>
                  <textarea value={promptText} onChange={e => setPromptText(e.target.value)} placeholder="Describe your theme..." className="w-full h-32 bg-white border border-black p-3 text-sm focus:border-orange-500 outline-none resize-none mb-4 font-mono" />
                  <div className="flex justify-end gap-3">
                      <button onClick={() => setPromptOpen(false)} className="px-5 py-3 text-sm hover:bg-gray-300 font-bold border border-transparent hover:border-black uppercase">Cancel</button>
                      <button onClick={handleAiGenerate} disabled={isGenerating} className="px-5 py-3 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold flex items-center gap-2 border border-black uppercase shadow-[2px_2px_0px_black] active:translate-y-[1px] active:shadow-none transition-all">{isGenerating ? 'PROCESSING...' : 'RUN GENERATOR'}</button>
                  </div>
              </div>
          </div>
      )}

      {/* TOOLBAR */}
      <div className="w-24 pinstripe border-r border-black flex flex-col items-center py-6 gap-5 z-20">
        <button onClick={() => setShowMainMenu(true)} className="w-14 h-14 bg-orange-600 flex items-center justify-center font-bold text-white text-2xl border border-black shadow-[3px_3px_0px_black] hover:bg-orange-500 active:translate-y-[1px] active:shadow-none transition-all">R</button>
        <div className="flex flex-col gap-4 w-full px-3">
            <button onClick={() => setShowLibModal(true)} className="w-full h-14 rounded-sm bg-[#4caf50] hover:bg-[#43a047] active:translate-y-[1px] border border-black shadow-[3px_3px_0px_black] active:shadow-none text-white flex items-center justify-center transition-all" title="Add New Element"><span className="text-3xl font-bold leading-none">+</span></button>
            <div className="h-[2px] bg-black/10 my-1" />
            <div className="flex flex-col gap-3">
                 <div className="text-[10px] font-bold text-center uppercase opacity-50 tracking-wider">Modify</div>
                 <div className="grid grid-cols-2 gap-2">
                     <ToolIconBtn onClick={handleDuplicateElement} title="Duplicate">📄</ToolIconBtn>
                     <ToolIconBtn onClick={handleToggleLock} title="Lock">🔒</ToolIconBtn>
                     <ToolIconBtn onClick={() => handleMoveLayer('up')} title="Up">▲</ToolIconBtn>
                     <ToolIconBtn onClick={() => handleMoveLayer('down')} title="Down">▼</ToolIconBtn>
                 </div>
                 <button onClick={() => setShowPalette(true)} className="w-full h-10 bg-white border border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 text-xs font-bold uppercase hover:bg-gray-50 active:translate-y-[1px] active:shadow-none transition-all">
                     <span className="w-4 h-4 rounded-full border border-black" style={{ background: 'linear-gradient(135deg, red, blue)' }}></span> Colors
                 </button>
                 <div className="flex gap-2 mt-2">
                    <ToolButton icon="↩" onClick={undo} disabled={!canUndo} className={!canUndo ? 'opacity-30' : ''} />
                    <ToolButton icon="↪" onClick={redo} disabled={!canRedo} className={!canRedo ? 'opacity-30' : ''} />
                 </div>
            </div>
        </div>
        <div className="flex-1" />
        <button onClick={() => setPromptOpen(true)} className="w-12 h-12 rounded-full border-2 border-black flex items-center justify-center hover:bg-yellow-400 transition-colors bg-white group shadow-[3px_3px_0px_rgba(0,0,0,0.2)]" title="AI Designer"><span className="text-xl font-bold group-hover:scale-110 transition-transform">✨</span></button>
        <div className="flex flex-col gap-3 w-full px-3 pb-3">
            <TeActionButton onClick={handleSaveProject} color="blue" label="SAVE" icon="☁" />
            <TeActionButton onClick={handleExport} color="green" label="ZIP" icon="⬇" />
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
        <input type="file" ref={loadProjectInputRef} className="hidden" accept=".json" onChange={handleLoadProject} />
        <input type="file" ref={importZipInputRef} className="hidden" accept=".zip" onChange={handleImportZip} />
        <input type="file" ref={globalFontInputRef} className="hidden" accept=".fnt" onChange={handleGlobalFontUpload} />
      </div>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#2a2a2a]">
        {/* Top Bar */}
        <div className="h-14 metal-gradient flex items-center px-6 justify-between border-b border-black select-none">
            <div className="flex items-center gap-6">
                 <div className="font-bold text-sm text-gray-700 uppercase tracking-widest flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${user ? 'bg-green-500' : 'bg-red-500'} border border-black/20`}></div>
                    <span className="truncate max-w-[200px]">{project.settings.name}</span>
                 </div>
                 {user && ( <div className="px-3 py-1 bg-black text-white text-[10px] font-bold uppercase rounded flex items-center gap-3"><span>USER: {user.username}</span><button onClick={handleLogout} className="text-orange-500 hover:text-white">✕</button></div> )}
                 <div className="flex bg-[#d4d4d4] p-1 rounded border border-[#999] shadow-inner gap-1"><TabButton id="wps" label="WPS" /><TabButton id="sbs" label="SBS" /><TabButton id="fms" label="FMS" /><TabButton id="usb" label="USB" /></div>
                 {selectedElement && rightPanelMode === 'inspector' && (
                     <div className="flex gap-2 border-l border-black/20 pl-6">
                        <ToolIconBtn onClick={() => alignElement('left')} title="Align Left">⇤</ToolIconBtn>
                        <ToolIconBtn onClick={() => alignElement('center')} title="Align Center">↔</ToolIconBtn>
                        <ToolIconBtn onClick={() => alignElement('right')} title="Align Right">⇥</ToolIconBtn>
                        <ToolIconBtn onClick={() => alignElement('top')} title="Align Top">⤒</ToolIconBtn>
                        <ToolIconBtn onClick={() => alignElement('middle')} title="Align Middle">↕</ToolIconBtn>
                        <ToolIconBtn onClick={() => alignElement('bottom')} title="Align Bottom">⤓</ToolIconBtn>
                     </div>
                 )}
            </div>
            <div className="flex items-center gap-6 text-xs font-bold text-gray-700">
                 <button onClick={() => setShowSource(!showSource)} className={`px-4 py-2 border border-gray-400 rounded-full ${showSource ? 'bg-orange-500 text-white border-orange-600' : 'bg-white hover:bg-gray-50'} transition-all`}>SOURCE_EDITOR</button>
                <label className="flex items-center gap-2 cursor-pointer select-none hover:text-black"><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="accent-orange-600 w-4 h-4" /> GRID</label>
                <div className="flex items-center gap-3 border-l border-black/20 pl-6"><span>ZOOM</span><button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="w-6 h-6 bg-white border border-gray-400 flex items-center justify-center hover:bg-gray-100">-</button><span className="w-10 text-center bg-white border border-gray-300 px-2 py-1 font-mono">{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="w-6 h-6 bg-white border border-gray-400 flex items-center justify-center hover:bg-gray-100">+</button></div>
            </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#2a2a2a] relative flex items-center justify-center p-20 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
            <EditorCanvas project={project} activeScreen={activeScreen} song={song} sim={sim} scale={zoom} showGrid={showGrid} showGuides={showGuides} onSelectElement={handleSelectElement} onUpdateElement={handleUpdateElement} />
        </div>
        <SimulationPanel sim={sim} meta={song} onUpdateSim={(updates) => setSim(prev => ({ ...prev, ...updates }))} onUpdateMeta={(updates) => setSong(prev => ({ ...prev, ...updates }))} onLoadTrack={handleTrackUpload} />
      </div>

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
                 {rightPanelMode === 'files' ? ( <FileBrowser project={project} onUploadResources={handleResourceUpload} /> ) : (
                    <PropertyPanel element={rightPanelMode === 'inspector' ? selectedElement : null} project={project} onUpdate={handleUpdateElement} onUpdateProject={handleUpdateProjectSettings} onDelete={handleDeleteElement} onDeselect={() => handleSelectElement('')} />
                 )}
             </div>
             {rightPanelMode === 'inspector' && (
                <div className={`border-t border-black flex flex-col bg-[#e0e0e0] sticky bottom-0 flex-shrink-0 transition-all duration-300 ease-in-out ${isLayerStackCollapsed ? 'h-10' : 'h-1/3'}`}>
                     <div onClick={() => setIsLayerStackCollapsed(!isLayerStackCollapsed)} className="h-10 bg-[#d4d4d4] border-b border-black flex items-center justify-between px-6 text-xs font-bold uppercase tracking-wider text-gray-600 cursor-pointer hover:bg-gray-300 select-none"><span>Layer_Stack ({activeScreen.toUpperCase()})</span><span>{isLayerStackCollapsed ? '▲' : '▼'}</span></div>
                     {!isLayerStackCollapsed && (
                         <div className="flex-1 overflow-y-auto p-3 space-y-2">
                             {project.elements.filter(el => el.screen === activeScreen).map(el => (
                                 <div key={el.id} onClick={() => handleSelectElement(el.id)} className={`text-xs px-3 py-3 border border-transparent cursor-pointer flex items-center gap-3 font-mono ${project.selectedElementIds.includes(el.id) ? 'bg-orange-600 text-white border-black shadow-sm' : 'text-gray-600 hover:bg-white hover:border-gray-300'}`}>
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
    </div>
  );
}

const ToolButton = ({ icon, onClick, active, disabled, className }: any) => (
    <button onClick={onClick} disabled={disabled} className={`flex-1 h-10 rounded-sm flex items-center justify-center gap-2 transition-all te-button ${active ? 'bg-orange-600 text-white border border-black shadow-none translate-y-[1px]' : 'bg-white text-black border border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:bg-gray-50'} ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-200 border-gray-300 shadow-none' : ''} ${className}`}><span className="text-sm font-bold font-mono">{icon}</span></button>
);

const ToolIconBtn = ({ children, onClick, title }: any) => (
    <button onClick={onClick} className="w-full h-10 rounded-sm text-black text-base flex items-center justify-center leading-none active:translate-y-[1px] hover:bg-orange-50 active:shadow-none transition-all bg-white border border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] font-bold" title={title}>{children}</button>
);

const TeActionButton = ({ onClick, color, label, icon }: any) => (
    <button onClick={onClick} className={`w-full h-10 rounded-sm flex items-center justify-center gap-2 transition-all bg-${color}-600 text-white border border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:bg-${color}-500 active:translate-y-[1px] active:shadow-none`}><span className="text-sm font-bold font-mono">{icon} {label}</span></button>
);
