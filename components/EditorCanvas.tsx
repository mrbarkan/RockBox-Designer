import React, { useRef, useState, useEffect } from 'react';
import { ProjectState, WpsElement, ElementType, SongMetadata, ImageElement, SimulationState, ScreenType } from '../types';
import { IPOD_SCREEN_WIDTH, IPOD_SCREEN_HEIGHT, ROCKBOX_STANDARD_FONTS } from '../constants';
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
  
  const canvasRef = useRef<HTMLDivElement>(null);

  const getFontCss = (fontId: string) => {
      const match = fontId.match(/^(\d+)-(.+?)(?:\.fnt)?$/);
      let size = 12;
      let family = 'Nimbus';
      
      if (match) {
          size = parseInt(match[1]);
          family = match[2];
      }

      // Map Rockbox families to CSS generic families for preview
      let cssFamily = 'sans-serif';
      
      const stdFont = ROCKBOX_STANDARD_FONTS[family];
      if (stdFont) {
          if (stdFont.type === 'mono') cssFamily = '"JetBrains Mono", monospace';
          else if (stdFont.type === 'serif') cssFamily = '"Times New Roman", serif';
          else if (stdFont.type === 'pixel') cssFamily = '"Courier New", monospace';
          else cssFamily = '"Inter", sans-serif';
      } else {
          // Fallback for custom fonts - try to guess based on name
          if (family.toLowerCase().includes('fixed') || family.toLowerCase().includes('term')) {
              cssFamily = '"JetBrains Mono", monospace';
          }
      }
      
      return {
          fontFamily: cssFamily,
          fontSize: `${size}px`,
          fontWeight: family.toLowerCase().includes('bold') ? 'bold' : 'normal'
      };
  };

  const handleMouseDown = (e: React.MouseEvent, el: WpsElement) => {
    if (el.locked) return;
    e.stopPropagation(); // Stop clicking canvas (mousedown)
    onSelectElement(el.id);
    setDraggingId(el.id);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ x: el.x, y: el.y, w: el.width, h: el.height });
  };

  const handleClick = (e: React.MouseEvent, el: WpsElement) => {
      // Critical: Prevent click from bubbling to the background which would deselect the element
      if (!el.locked) {
          e.stopPropagation();
      }
  };

  const handleResizeStart = (e: React.MouseEvent, el: WpsElement) => {
    e.stopPropagation();
    setResizingId(el.id);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ x: el.x, y: el.y, w: el.width, h: el.height });
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if ((!draggingId && !resizingId) || !canvasRef.current) return;
    
    // Calculate delta relative to zoom scale
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

  // Filter elements for current view
  const activeElements = project.elements.filter(el => el.screen === activeScreen);

  // Helper to get selector bar style
  const getSelectorStyle = (isSelected: boolean) => {
      if (!isSelected) return { backgroundColor: 'transparent', color: project.settings.foregroundColor };
      
      const type = project.settings.lineSelectorType || 'bar_color';
      
      if (type === 'pointer') {
          return { backgroundColor: 'transparent', color: project.settings.foregroundColor };
      }
      
      if (type === 'bar_inverse') {
          return { backgroundColor: project.settings.foregroundColor, color: project.settings.backgroundColor };
      }
      
      if (type === 'bar_gradient') {
          return { 
              background: `linear-gradient(to bottom, ${project.settings.selectorColor}, ${project.settings.lineSelectorEndColor || project.settings.selectorColor})`,
              color: project.settings.selectorTextColor
          };
      }
      
      // Default: bar_color
      return { backgroundColor: project.settings.selectorColor, color: project.settings.selectorTextColor };
  };

  return (
    <div 
        className="relative shadow-2xl bg-black overflow-hidden select-none"
        style={{
            width: IPOD_SCREEN_WIDTH * scale,
            height: IPOD_SCREEN_HEIGHT * scale,
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
    >
        {/* Render Layer */}
        <div 
            ref={canvasRef}
            className={`relative w-full h-full ${showGrid ? 'canvas-grid' : ''}`}
            style={{
                width: IPOD_SCREEN_WIDTH,
                height: IPOD_SCREEN_HEIGHT,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                backgroundColor: project.settings.backgroundColor
            }}
            onClick={() => onSelectElement('')} // Deselect when clicking background
        >
            {/* Backdrop Layer */}
            {project.settings.backdrop && project.assets[project.settings.backdrop] && (
                 <img 
                    src={project.assets[project.settings.backdrop]} 
                    className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none opacity-100"
                    alt="Backdrop"
                 />
            )}

            {activeElements.map(el => {
                if (!el.visible) return null;
                const isSelected = project.selectedElementIds.includes(el.id);
                
                return (
                    <div
                        key={el.id}
                        onMouseDown={(e) => handleMouseDown(e, el)}
                        onClick={(e) => handleClick(e, el)}
                        className={`absolute group hover:outline hover:outline-1 hover:outline-blue-400 ${isSelected ? 'outline outline-2 outline-blue-600 z-50' : 'z-10'}`}
                        style={{
                            left: el.x,
                            top: el.y,
                            width: el.width,
                            height: el.height,
                            cursor: el.locked ? 'default' : 'move'
                        }}
                    >
                        {/* Render Content */}
                        {el.type === ElementType.TEXT && (
                            <div 
                                className="w-full h-full whitespace-nowrap overflow-hidden"
                                style={{
                                    color: (el as any).color,
                                    textAlign: (el as any).align,
                                    lineHeight: '1.2',
                                    ...getFontCss((el as any).fontId)
                                }}
                            >
                                {parseRockboxString((el as any).content, sim, song)}
                            </div>
                        )}
                        
                        {el.type === ElementType.RECT && (
                             <div className="w-full h-full" style={{ backgroundColor: (el as any).color }} />
                        )}

                        {el.type === ElementType.PROGRESS_BAR && (
                             <div className="w-full h-full relative" style={{ backgroundColor: (el as any).backColor }}>
                                <div 
                                    className="h-full absolute left-0 top-0 transition-all duration-300" 
                                    style={{ 
                                        width: `${(song.currentSec / song.totalSec) * 100}%`, 
                                        backgroundColor: (el as any).foreColor 
                                    }} 
                                />
                             </div>
                        )}

                        {el.type === ElementType.IMAGE && (
                             <img 
                                src={(el as ImageElement).src} 
                                alt={el.name}
                                className="w-full h-full object-contain pointer-events-none select-none"
                                draggable={false}
                             />
                        )}

                        {/* Viewport / Menu Simulator */}
                        {el.type === ElementType.VIEWPORT && (
                            <div className="w-full h-full overflow-hidden flex flex-col pointer-events-none border border-dashed border-gray-600/30 relative">
                                <div className="absolute top-0 right-0 bg-gray-500 text-white text-[9px] px-1 font-mono opacity-50 z-20">Menu_Area</div>
                                
                                <div className="flex-1 flex flex-col w-full h-full overflow-hidden">
                                    {['Files', 'Database', 'Resume Playback', 'Settings', 'Recording', 'Plugins'].map((item, i) => {
                                         // Simulate selection on "Settings"
                                         const isSelectedRow = i === 3; 
                                         const style = getSelectorStyle(isSelectedRow);
                                         
                                         return (
                                            <div 
                                                key={i} 
                                                className="px-2 flex items-center w-full relative"
                                                style={{ 
                                                    height: '24px', 
                                                    ...style,
                                                    ...getFontCss(project.settings.uiFont)
                                                }}
                                            >
                                                {/* Pointer Style */}
                                                {project.settings.lineSelectorType === 'pointer' && isSelectedRow && (
                                                    <span className="mr-1">►</span>
                                                )}
                                                
                                                {/* Icons if enabled */}
                                                {project.settings.showIcons && (
                                                    <span className="mr-2 text-[10px] opacity-70">
                                                        {i === 0 ? '📁' : i === 1 ? '💿' : i === 3 ? '⚙️' : '📄'}
                                                    </span>
                                                )}

                                                <span className="truncate w-full">{item}</span>
                                                {item === 'Database' || item === 'Settings' ? <span>▶</span> : null}
                                            </div>
                                         );
                                    })}
                                </div>

                                {/* Scrollbar Simulation */}
                                {project.settings.scrollbar !== 'off' && (
                                    <div 
                                        className={`absolute top-0 bottom-0 ${project.settings.scrollbar === 'right' ? 'right-0' : 'left-0'} bg-gray-600/30`}
                                        style={{ width: project.settings.scrollbarWidth || 6 }}
                                    >
                                        <div className="w-full h-1/2 bg-gray-400 mt-8 opacity-80" />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Resize Handles (Only when selected and unlocked) */}
                        {isSelected && !el.locked && (
                            <>
                                <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-600 border border-white" />
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-600 border border-white" />
                                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-600 border border-white" />
                                <div 
                                    className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-600 border border-white cursor-se-resize hover:scale-150 transition-transform" 
                                    onMouseDown={(e) => handleResizeStart(e, el)}
                                />
                            </>
                        )}
                    </div>
                );
            })}
        </div>

        {/* HUD Overlay (Rulers, Guides) */}
        {showGuides && (
            <div className="absolute inset-0 pointer-events-none opacity-50">
                 {/* Center Lines */}
                 <div className="absolute top-0 bottom-0 left-1/2 border-l border-cyan-400 border-dashed" />
                 <div className="absolute left-0 right-0 top-1/2 border-t border-cyan-400 border-dashed" />
            </div>
        )}
    </div>
  );
};
