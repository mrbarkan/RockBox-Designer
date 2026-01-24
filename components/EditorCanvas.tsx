import React, { useRef, useState, useEffect } from 'react';
import { ProjectState, WpsElement, ElementType, SongMetadata, ImageElement, SimulationState, ROCKBOX_FONTS, ScreenType } from '../types';
import { IPOD_SCREEN_WIDTH, IPOD_SCREEN_HEIGHT } from '../constants';
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
      // 1. Try to find exact match in known fonts
      const f = ROCKBOX_FONTS.find(font => font.id === fontId);
      if (f) {
          return {
              fontFamily: f.css,
              fontSize: `${f.size}px`
          };
      }
      
      // 2. Fallback: Parse size from filename (e.g., "16-Terminus.fnt" -> 16px)
      const sizeMatch = fontId.match(/^(\d+)-/);
      const parsedSize = sizeMatch ? parseInt(sizeMatch[1]) : 12;
      
      return {
          fontFamily: 'sans-serif',
          fontSize: `${parsedSize}px`,
          fontWeight: fontId.toLowerCase().includes('bold') ? 'bold' : 'normal'
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
