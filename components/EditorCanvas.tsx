import React, { useRef, useState } from 'react';
import { ProjectState, WpsElement, ElementType, SongMetadata, ImageElement, SimulationState, ROCKBOX_FONTS } from '../types';
import { IPOD_SCREEN_WIDTH, IPOD_SCREEN_HEIGHT } from '../constants';
import { parseRockboxString } from '../services/rockboxTagParser';

interface EditorCanvasProps {
  project: ProjectState;
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
  song,
  sim,
  onSelectElement,
  onUpdateElement,
  scale = 1,
  showGuides,
  showGrid
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const getFontCss = (fontId: string) => {
      const f = ROCKBOX_FONTS.find(font => font.id === fontId);
      return {
          fontFamily: f ? f.css : 'sans-serif',
          fontSize: f ? `${f.size}px` : '12px'
      };
  };

  const handleMouseDown = (e: React.MouseEvent, el: WpsElement) => {
    if (el.locked) return;
    e.stopPropagation();
    onSelectElement(el.id);
    setDraggingId(el.id);
    
    // Calculate offset within the element
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingId || !canvasRef.current) return;
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    
    // Calculate new position relative to canvas, accounting for scale
    let newX = (e.clientX - canvasRect.left - dragOffset.x) / scale;
    let newY = (e.clientY - canvasRect.top - dragOffset.y) / scale;

    // Snap to grid (10px)
    if (showGrid) {
        newX = Math.round(newX / 10) * 10;
        newY = Math.round(newY / 10) * 10;
    }

    onUpdateElement(draggingId, {
        x: Math.round(newX),
        y: Math.round(newY)
    });
  };

  const handleMouseUp = () => {
    setDraggingId(null);
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
            onClick={() => onSelectElement('')} // Deselect
        >
            {project.elements.map(el => {
                if (!el.visible) return null;
                const isSelected = project.selectedElementIds.includes(el.id);
                
                return (
                    <div
                        key={el.id}
                        onMouseDown={(e) => handleMouseDown(e, el)}
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

                        {/* Handles (Visual only for now) */}
                        {isSelected && !el.locked && (
                            <>
                                <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-600 border border-white" />
                                <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-600 border border-white" />
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
