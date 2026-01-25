
import React, { useRef, useState, useEffect } from 'react';
import { ProjectState, WpsElement, ElementType, SongMetadata, ImageElement, SimulationState, ScreenType, ProgressBarElement } from '../types';
import { IPOD_SCREEN_WIDTH, IPOD_SCREEN_HEIGHT, ROCKBOX_STANDARD_FONTS, GRAPHIC_ASSETS } from '../constants';
import { parseRockboxString } from '../services/rockboxTagParser';

interface EditorCanvasProps {
  project: ProjectState;
  activeScreen: ScreenType;
  song: SongMetadata;
  sim: SimulationState;
  onSelectElement: (id: string) => void;
  onUpdateElement: (id: string, updates: Partial<WpsElement>) => void;
  scale?: number;
  showGuides: boolean;
  showGrid: boolean;
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  project,
  activeScreen,
  song,
  sim,
  onSelectElement,
  onUpdateElement,
  scale = 1,
  showGuides,
  showGrid
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [elementStart, setElementStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [isHoveringCanvas, setIsHoveringCanvas] = useState(false);
  
  const canvasRef = useRef<HTMLDivElement>(null);

  // Trigger simulated "Volume Change" state if simulation volume updates
  // In a real app we'd have a timer, here we just use the 'auto' mode check
  // For Editor visualization: If mouse is hovering canvas, we show Track Progress. 
  // If we want to preview Volume overlay, we can check sim.volumeLastChanged but for Editor ease
  // let's just show Volume Overlay if the element is selected and mode is Auto.
  
  const getFontCss = (fontId: string) => {
      const match = fontId.match(/^(\d+)-(.+?)(?:\.fnt)?$/);
      let size = 12;
      let family = 'Nimbus';
      
      if (match) {
          size = parseInt(match[1]);
          family = match[2];
      }
      let cssFamily = 'sans-serif';
      const stdFont = ROCKBOX_STANDARD_FONTS[family];
      if (stdFont) {
          if (stdFont.type === 'mono') cssFamily = '"JetBrains Mono", monospace';
          else if (stdFont.type === 'serif') cssFamily = '"Times New Roman", serif';
          else if (stdFont.type === 'pixel') cssFamily = '"Courier New", monospace';
          else cssFamily = '"Inter", sans-serif';
      }
      return {
          fontFamily: cssFamily,
          fontSize: `${size}px`,
          fontWeight: family.toLowerCase().includes('bold') ? 'bold' : 'normal'
      };
  };

  const handleMouseDown = (e: React.MouseEvent, el: WpsElement) => {
    if (el.locked) return;
    e.stopPropagation(); 
    onSelectElement(el.id);
    setDraggingId(el.id);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ x: el.x, y: el.y, w: el.width, h: el.height });
  };

  const handleClick = (e: React.MouseEvent, el: WpsElement) => {
      if (!el.locked) e.stopPropagation();
  };

  const handleResizeStart = (e: React.MouseEvent, el: WpsElement) => {
    e.stopPropagation();
    setResizingId(el.id);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ x: el.x, y: el.y, w: el.width, h: el.height });
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if ((!draggingId && !resizingId) || !canvasRef.current) return;
    const deltaX = (e.clientX - dragStart.x) / scale;
    const deltaY = (e.clientY - dragStart.y) / scale;
    const snap = (val: number) => showGrid ? Math.round(val / 10) * 10 : Math.round(val);

    if (resizingId) {
        onUpdateElement(resizingId, {
            width: Math.max(10, snap(elementStart.w + deltaX)),
            height: Math.max(10, snap(elementStart.h + deltaY))
        });
    } else if (draggingId) {
        onUpdateElement(draggingId, {
            x: snap(elementStart.x + deltaX),
            y: snap(elementStart.y + deltaY)
        });
    }
  };

  const handleMouseUp = () => {
    setDraggingId(null);
    setResizingId(null);
  };

  const activeElements = project.elements.filter(el => el.screen === activeScreen);

  const checkCondition = (condition: string | undefined): boolean => {
      if (!condition) return true;
      if (condition === '%?ps') return sim.shuffle;
      if (condition === '%?mm') return sim.repeat !== 'off';
      if (condition.includes('%bp')) return sim.isCharging;
      if (condition.includes('%?mh')) return sim.isHold;
      if (condition.startsWith('%?mp')) {
          if (sim.playStatus === 'stop' && condition.includes('Stop')) return true;
          if (sim.playStatus === 'play' && condition.includes('Play')) return true;
          if (sim.playStatus === 'pause' && condition.includes('Pause')) return true;
          return true; 
      }
      return true; 
  };

  const renderImageElement = (el: ImageElement) => {
      if (el.name === 'Album Art' || el.filename === 'cover_placeholder.bmp') {
          return <img src={song.albumArt || el.src} alt="Art" className="w-full h-full object-cover pointer-events-none select-none" draggable={false} />;
      }

      if (el.imageType === 'battery_strip' || el.filename.startsWith('batt_')) {
          // Charging Override
          if (sim.isCharging) {
             return <img src={GRAPHIC_ASSETS.CHARGING_ICON.src} className="w-full h-full object-contain" alt="Charging" />;
          }

          const frames = el.frameCount || 10;
          let frameIndex = Math.floor(sim.batteryLevel / (100 / frames));
          if (frameIndex >= frames) frameIndex = frames - 1;
          
          return (
             <div className="w-full h-full overflow-hidden relative pointer-events-none">
                 <img src={el.src} alt="Battery" className="max-w-none h-full absolute top-0" style={{ width: `${frames * 100}%`, left: `-${frameIndex * 100}%` }} draggable={false} />
             </div>
          );
      }
      return <img src={el.src} alt={el.name} className="w-full h-full object-contain pointer-events-none select-none" draggable={false} />;
  };

  const renderProgressBar = (el: ProgressBarElement) => {
      // Determine what we are showing
      const isVolume = el.pbMode === 'volume' || (el.pbMode === 'auto' && project.selectedElementIds.includes(el.id)); 
      // ^ In Editor, show Volume overlay if element is selected for preview purposes, otherwise Track.
      
      const percent = isVolume 
        ? Math.abs(sim.volume + 60) / 60 * 100 // Map -60dB...0dB to 0..100 roughly
        : (song.currentSec / song.totalSec) * 100;
        
      const clampedPercent = Math.min(100, Math.max(0, percent));

      if (el.pbStyle === 'adwaita') {
          const { BACKDROP, ICONS, SLIDER_BG, SLIDER_FG } = GRAPHIC_ASSETS.VOLUME_OVERLAY;
          // Retrieve actual assets or fallback
          const backdropSrc = project.assets[BACKDROP.filename] || BACKDROP.src;
          const sliderBgSrc = project.assets[SLIDER_BG.filename] || SLIDER_BG.src;
          const sliderFgSrc = project.assets[SLIDER_FG.filename] || SLIDER_FG.src;
          const iconsSrc = project.assets[ICONS.filename] || ICONS.src;
          
          // Adwaita style is strictly a volume overlay structure
          // It expects specific relative positioning.
          return (
              <div className="w-full h-full relative flex items-center justify-center">
                  <img src={backdropSrc} className="absolute inset-0 w-full h-full" alt="bg" />
                  
                  {/* Icon */}
                  <div className="absolute left-[12px] top-[10px] w-[24px] h-[21px] overflow-hidden">
                      <img src={iconsSrc} className="absolute top-0 left-0 w-full max-w-none" style={{ top: sim.volume > -10 ? '-63px' : sim.volume > -30 ? '-42px' : sim.volume > -60 ? '-21px' : '0' }} />
                  </div>

                  {/* Slider Track */}
                  <div className="absolute left-[46px] top-[20px] w-[117px] h-[5px]">
                      <img src={sliderBgSrc} className="absolute inset-0 w-full h-full" />
                      <div className="absolute top-0 left-0 h-full overflow-hidden" style={{ width: `${clampedPercent}%` }}>
                          <img src={sliderFgSrc} className="absolute top-0 left-0 w-[117px] h-full max-w-none" />
                      </div>
                  </div>
              </div>
          );
      }

      const radius = el.pbStyle === 'rounded' ? '99px' : '0px';

      if (el.pbStyle === 'segmented') {
           const segs = 20;
           const activeSegs = Math.floor((clampedPercent / 100) * segs);
           return (
               <div className="w-full h-full flex gap-[1px]" style={{ backgroundColor: el.backColor }}>
                   {Array.from({length: segs}).map((_, i) => (
                       <div key={i} className="flex-1 h-full" style={{ backgroundColor: i < activeSegs ? el.foreColor : 'transparent', opacity: i < activeSegs ? 1 : 0.2 }} />
                   ))}
               </div>
           );
      }

      return (
         <div className="w-full h-full relative overflow-hidden" style={{ backgroundColor: el.backColor, borderRadius: radius }}>
            <div className="h-full absolute left-0 top-0 transition-all duration-300" style={{ width: `${clampedPercent}%`, backgroundColor: el.foreColor }} />
         </div>
      );
  };

  // --- SYSTEM UI OVERLAYS ---
  const SystemOverlay = () => {
      const { settings } = project;
      const fg = settings.foregroundColor || '#ffffff';
      
      return (
          <>
              {/* Native Status Bar */}
              {settings.statusBarTop && (
                  <div 
                      className="absolute top-0 left-0 flex items-center justify-between px-1 z-30 font-mono text-[9px] pointer-events-none border-b border-black/10"
                      style={{ 
                        width: IPOD_SCREEN_WIDTH, 
                        height: '14px', 
                        color: fg, 
                        backgroundColor: 'rgba(0,0,0,0.2)' 
                      }}
                  >
                      {/* Left: Play State (Simulated) */}
                      <span className="font-bold">▶</span>
                      
                      {/* Center: Title/Time (Simulated) */}
                      <span className="opacity-80">12:30</span>

                      {/* Right: Vol / Batt */}
                      <div className="flex gap-2 items-center">
                          {/* Volume */}
                          {settings.volumeDisplay === 'numeric' ? (
                              <span>-20dB</span>
                          ) : (
                              <span className="text-[10px]">🔊</span>
                          )}
                          
                          {/* Battery */}
                          {settings.batteryDisplay === 'numeric' ? (
                              <span>85%</span>
                          ) : (
                              <div className="w-4 h-2 border border-current relative flex p-[1px]">
                                  <div className="h-full bg-current w-3/4"></div>
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {/* Native Scrollbar (Only on menus usually, but visualized here for feedback) */}
              {settings.scrollbar !== 'off' && activeScreen !== 'wps' && (
                  <div style={{
                      position: 'absolute',
                      top: settings.statusBarTop ? '14px' : '0',
                      bottom: 0,
                      [settings.scrollbar]: 0,
                      width: `${settings.scrollbarWidth || 6}px`,
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      zIndex: 30,
                      pointerEvents: 'none',
                      borderLeft: settings.scrollbar === 'right' ? '1px solid rgba(0,0,0,0.1)' : 'none',
                      borderRight: settings.scrollbar === 'left' ? '1px solid rgba(0,0,0,0.1)' : 'none'
                  }}>
                      {/* Thumb */}
                      <div style={{ width: '100%', height: '40px', backgroundColor: fg, opacity: 0.6, marginTop: '20px' }}></div>
                  </div>
              )}
          </>
      );
  };

  return (
    <div className="relative shadow-2xl bg-black overflow-hidden select-none" style={{ width: IPOD_SCREEN_WIDTH * scale, height: IPOD_SCREEN_HEIGHT * scale }} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
        <div ref={canvasRef} className={`relative w-full h-full ${showGrid ? 'canvas-grid' : ''}`} style={{ width: IPOD_SCREEN_WIDTH, height: IPOD_SCREEN_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left', backgroundColor: project.settings.backgroundColor }} onClick={() => onSelectElement('')}>
            {project.settings.backdrop && project.assets[project.settings.backdrop] && (
                 <img src={project.assets[project.settings.backdrop]} className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none opacity-100" alt="Backdrop" />
            )}
            
            {activeScreen === 'usb' && !project.settings.backdrop && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30"><span className="text-4xl font-bold text-gray-500">USB MODE</span></div>
            )}

            {activeElements.map(el => {
                if (!el.visible) return null;
                const isConditionMet = checkCondition(el.condition);
                const isSelected = project.selectedElementIds.includes(el.id);
                
                return (
                    <div
                        key={el.id}
                        onMouseDown={(e) => handleMouseDown(e, el)}
                        onClick={(e) => handleClick(e, el)}
                        className={`absolute group hover:outline hover:outline-1 hover:outline-blue-400 ${isSelected ? 'outline outline-2 outline-blue-600 z-50' : 'z-10'}`}
                        style={{ left: el.x, top: el.y, width: el.width, height: el.height, cursor: el.locked ? 'default' : 'move', opacity: isConditionMet ? 1 : 0.2 }}
                    >
                        {el.type === ElementType.TEXT && (
                            <div className="w-full h-full overflow-hidden relative">
                                <div 
                                    className={`whitespace-nowrap ${(el as any).scroll ? 'animate-rock' : ''}`}
                                    style={{
                                        color: (el as any).color,
                                        textAlign: (el as any).align,
                                        lineHeight: '1.2',
                                        width: (el as any).scroll ? 'max-content' : '100%',
                                        ...getFontCss((el as any).fontId)
                                    }}
                                >
                                    {parseRockboxString((el as any).content, sim, song)}
                                </div>
                                <style>{`
                                    @keyframes rock { 
                                        0%, 25% { transform: translateX(0); } 
                                        75%, 100% { transform: translateX(-50%); } 
                                    }
                                    .animate-rock { 
                                        display: inline-block; 
                                        min-width: 100%;
                                        animation: rock 4s ease-in-out infinite alternate; 
                                    }
                                `}</style>
                            </div>
                        )}
                        
                        {el.type === ElementType.RECT && <div className="w-full h-full" style={{ backgroundColor: (el as any).color }} />}
                        {el.type === ElementType.PROGRESS_BAR && renderProgressBar(el as ProgressBarElement)}
                        {el.type === ElementType.IMAGE && renderImageElement(el as ImageElement)}
                        
                        {el.type === ElementType.VIEWPORT && (
                            <div className="w-full h-full overflow-hidden flex flex-col pointer-events-none border border-dashed border-gray-600/30 relative">
                                <div className="absolute top-0 right-0 bg-gray-500 text-white text-[9px] px-1 font-mono opacity-50 z-20">Menu_Area</div>
                                <div className="flex-1 flex flex-col w-full h-full overflow-hidden">
                                    {['Files', 'Database', 'Settings', 'Plugins'].map((item, i) => (
                                        <div key={i} className="px-2 flex items-center w-full relative" style={{ height: '24px', ...getFontCss(project.settings.uiFont), color: i===2 ? project.settings.selectorTextColor : project.settings.foregroundColor, background: i===2 ? project.settings.selectorColor : 'transparent' }}>
                                            {project.settings.showIcons && <span className="mr-2 text-[10px] opacity-70">📄</span>}
                                            <span className="truncate w-full">{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {isSelected && !el.locked && (
                            <>
                                <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-600 border border-white" />
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-600 border border-white" />
                                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-600 border border-white" />
                                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-600 border border-white cursor-se-resize hover:scale-150 transition-transform" onMouseDown={(e) => handleResizeStart(e, el)} />
                            </>
                        )}
                    </div>
                );
            })}
            
            <SystemOverlay />
        </div>
        {showGuides && <div className="absolute inset-0 pointer-events-none opacity-50"><div className="absolute top-0 bottom-0 left-1/2 border-l border-cyan-400 border-dashed" /><div className="absolute left-0 right-0 top-1/2 border-t border-cyan-400 border-dashed" /></div>}
    </div>
  );
};
