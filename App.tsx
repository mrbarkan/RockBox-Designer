
import React, { useState, useRef, useEffect } from 'react';
import { ProjectState, ElementType, WpsElement, ImageElement, SongMetadata, SimulationState, ThemeConfig, LayoutStyle, ThemeFont, ScreenType, User } from './types';
import { DEFAULT_PROJECT, DEFAULT_SONG, DEFAULT_SIMULATION, IPOD_SCREEN_HEIGHT, IPOD_SCREEN_WIDTH } from './constants';
import { EditorCanvas } from './components/EditorCanvas';
import { SimulationPanel } from './components/SimulationPanel';
import { SourceEditor } from './components/SourceEditor';
import { RemixModal } from './components/RemixModal';
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

// Refactored Sub-Components
import { EditorToolbar } from './components/EditorToolbar';
import { EditorHeader } from './components/EditorHeader';
import { EditorSidebar } from './components/EditorSidebar';

export default function App() {
  const { state: project, set: setProject, undo, redo, canUndo, canRedo } = useHistory<ProjectState>(DEFAULT_PROJECT);

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showCloudProjects, setShowCloudProjects] = useState(false);

  const [song, setSong] = useState<SongMetadata>(DEFAULT_SONG);
  const [sim, setSim] = useState<SimulationState>({
      ...DEFAULT_SIMULATION,
      externalPower: false,
      volumeLastChanged: 0,
      diskActivity: false,
      sublineCycle: 0
  });
  
  const [activeScreen, setActiveScreen] = useState<ScreenType>('wps');
  const [rightPanelMode, setRightPanelMode] = useState<'inspector' | 'files' | 'settings'>('inspector');
  const [showGrid, setShowGrid] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [showSource, setShowSource] = useState(false);
  const [showRemixModal, setShowRemixModal] = useState(false);
  const [showLibModal, setShowLibModal] = useState(false);
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  
  const [isLayerStackCollapsed, setIsLayerStackCollapsed] = useState(false);
  const [zoom, setZoom] = useState(1.5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptText, setPromptText] = useState('');

  // Refs for Toolbar Inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadProjectInputRef = useRef<HTMLInputElement>(null);
  const importZipInputRef = useRef<HTMLInputElement>(null);
  const globalFontInputRef = useRef<HTMLInputElement>(null);

  // -- Heartbeat for Animation & Timers --
  useEffect(() => {
      const interval = setInterval(() => {
          setSim(prev => ({
              ...prev,
              sublineCycle: prev.sublineCycle + 0.1, // Increment 0.1s every 100ms
              // Also auto-increment song progress if playing
              currentTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }));
      }, 100);
      return () => clearInterval(interval);
  }, []);

  useEffect(() => {
      const session = storageService.getSession();
      if (session) { setUser(session); } else { setShowLogin(true); }
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

  useEffect(() => {
      if (project.validationReport && project.validationReport.length > 0) {
          const msg = `Import Completed with Warnings:\n\n${project.validationReport.join('\n')}`;
          alert(msg);
      }
  }, [project]);

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

      setProject({ ...project, elements: [...project.elements, newEl], selectedElementIds: [newEl.id] });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          const result = ev.target?.result as string;
          const newEl: ImageElement = {
              id: Math.random().toString(36).substr(2, 9),
              name: file.name, type: ElementType.IMAGE, screen: activeScreen,
              x: 0, y: 0, width: 100, height: 100, visible: true, locked: false,
              src: result, filename: file.name
          };
          setProject({ ...project, assets: { ...project.assets, [file.name]: result }, elements: [...project.elements, newEl], selectedElementIds: [newEl.id] });
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
    } catch (error) { alert("Failed to load audio file."); }
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
    } else { alert("Failed to generate ZIP. Is JSZip loaded?"); }
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

  const handleNewProject = () => { 
      if (confirm("Create new project? Unsaved changes will be lost.")) {
          setProject(JSON.parse(JSON.stringify(DEFAULT_PROJECT))); 
      }
  };

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

      {/* LEFT TOOLBAR */}
      <EditorToolbar 
          onShowMainMenu={() => setShowMainMenu(true)}
          onShowLibModal={() => setShowLibModal(true)}
          onDuplicate={handleDuplicateElement}
          onToggleLock={handleToggleLock}
          onMoveLayer={handleMoveLayer}
          onShowPalette={() => setShowPalette(true)}
          undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo}
          onOpenPrompt={() => setPromptOpen(true)}
          onSave={handleSaveProject}
          onExport={handleExport}
          imageInputRef={fileInputRef} loadProjectInputRef={loadProjectInputRef} importZipInputRef={importZipInputRef} globalFontInputRef={globalFontInputRef}
          onImageUpload={handleImageUpload} onLoadProject={handleLoadProject} onImportZip={handleImportZip} onGlobalFontUpload={handleGlobalFontUpload}
      />

      {/* CENTER WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#2a2a2a]">
        <EditorHeader 
            project={project} user={user} onLogout={handleLogout}
            activeScreen={activeScreen} setActiveScreen={setActiveScreen}
            selectedElement={selectedElement} rightPanelMode={rightPanelMode}
            onAlign={alignElement} showSource={showSource} setShowSource={setShowSource}
            showGrid={showGrid} setShowGrid={setShowGrid} zoom={zoom} setZoom={setZoom}
            debugMode={debugMode} setDebugMode={setDebugMode}
        />
        <div className="flex-1 overflow-auto bg-[#2a2a2a] relative flex items-center justify-center p-20 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
            <EditorCanvas 
              project={project} 
              activeScreen={activeScreen} 
              song={song} 
              sim={sim} 
              scale={zoom} 
              showGrid={showGrid} 
              showGuides={showGuides} 
              debugMode={debugMode}
              onSelectElement={handleSelectElement} 
              onUpdateElement={handleUpdateElement} 
            />
        </div>
        <SimulationPanel sim={sim} meta={song} onUpdateSim={(updates) => setSim(prev => ({ ...prev, ...updates }))} onUpdateMeta={(updates) => setSong(prev => ({ ...prev, ...updates }))} onLoadTrack={handleTrackUpload} />
      </div>

      {/* RIGHT SIDEBAR */}
      <EditorSidebar 
          rightPanelMode={rightPanelMode as any} setRightPanelMode={setRightPanelMode}
          project={project} selectedElementIds={project.selectedElementIds}
          onUploadResources={handleResourceUpload} onUpdateElement={handleUpdateElement}
          onUpdateProject={handleUpdateProjectSettings} onDeleteElement={handleDeleteElement}
          onSelectElement={handleSelectElement} isLayerStackCollapsed={isLayerStackCollapsed}
          setIsLayerStackCollapsed={setIsLayerStackCollapsed} activeScreen={activeScreen}
      />
    </div>
  );
}
