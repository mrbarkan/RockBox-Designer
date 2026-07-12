
import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { ProjectState, WpsElement, SongMetadata, SimulationState, ScreenType } from '../types';
import { IPOD_SCREEN_WIDTH, IPOD_SCREEN_HEIGHT, GRAPHIC_ASSETS } from '../constants';
import { evaluateTheme, renderToCanvas } from '../services/graphicsPipeline';
import { evaluateAstTheme } from '../services/rockboxAstEvaluator';
import {
  listSyntaxImageNodes,
  listSyntaxTextNodes,
  listSyntaxViewports,
  SyntaxImageEditable,
  SyntaxTextEditable,
  SyntaxViewportEditable
} from '../rockbox/editing';
import { getProjectSyntaxDocument } from '../services/rockboxSyntaxAdapter';

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
  debugMode?: boolean;
  useAstPreview?: boolean;
  onUpdateAstViewport?: (
    nodeId: string,
    updates: { x: number; y: number; width: number; height: number }
  ) => void;
  onUpdateAstText?: (nodeId: string, value: string) => void;
  onUpdateAstImage?: (nodeId: string, filename: string) => void;
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
  showGrid,
  debugMode = false,
  useAstPreview = false,
  onUpdateAstViewport,
  onUpdateAstText,
  onUpdateAstImage
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Interaction State
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [astDragging, setAstDragging] = useState<SyntaxViewportEditable | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [elementStart, setElementStart] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // Asset Cache
  const [imageCache, setImageCache] = useState<Record<string, HTMLImageElement>>({});
  const albumArtRef = useRef<string | null>(null);

  // 1. Asset Loading Effect
  useEffect(() => {
      const loadAssets = async () => {
          const newCache: Record<string, HTMLImageElement> = { ...imageCache };
          let changed = false;

          // Project Assets
          for (const [name, base64] of Object.entries(project.assets)) {
              if (!newCache[name]) {
                  const img = new Image();
                  img.src = base64 as string;
                  await new Promise(r => img.onload = r);
                  newCache[name] = img;
                  changed = true;
              }
          }

          // Special Assets (Album Art)
          if (song.albumArt && song.albumArt !== albumArtRef.current) {
               const img = new Image();
               img.src = song.albumArt;
               await new Promise(r => img.onload = r);
               newCache['ALBUM_ART'] = img; // We map 'ALBUM_ART' key to this
               albumArtRef.current = song.albumArt;
               changed = true;
          } else if (!song.albumArt && albumArtRef.current) {
               delete newCache['ALBUM_ART'];
               albumArtRef.current = null;
               changed = true;
          }

          if (changed) setImageCache(newCache);
      };
      loadAssets();
  }, [project.assets, song.albumArt]);

  // 2. Render Loop
  useLayoutEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Ensure dimensions match (HiDPI support can be added here if needed)
      canvas.width = IPOD_SCREEN_WIDTH;
      canvas.height = IPOD_SCREEN_HEIGHT;

      // 1. Evaluate
      const renderList = useAstPreview
          ? evaluateAstTheme(project, activeScreen, sim, song)
          : evaluateTheme(project, activeScreen, sim, song);

      // 2. Render
      renderToCanvas(ctx, renderList, imageCache);

  }, [project, activeScreen, sim, song, imageCache]);

  // 3. Interaction Handlers (DOM Layer)
  const handleMouseDown = (e: React.MouseEvent, el: WpsElement) => {
    if (el.locked) return;
    e.stopPropagation(); 
    onSelectElement(el.id);
    setDraggingId(el.id);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ x: el.x, y: el.y, w: el.width, h: el.height });
  };

  const handleResizeStart = (e: React.MouseEvent, el: WpsElement) => {
    e.stopPropagation();
    setResizingId(el.id);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ x: el.x, y: el.y, w: el.width, h: el.height });
  }

  const handleAstMouseDown = (e: React.MouseEvent, viewport: SyntaxViewportEditable) => {
    e.stopPropagation();
    setAstDragging(viewport);
    setResizingId(null);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ x: viewport.x, y: viewport.y, w: viewport.width, h: viewport.height });
  };

  const handleAstResizeStart = (e: React.MouseEvent, viewport: SyntaxViewportEditable) => {
    e.stopPropagation();
    setAstDragging(viewport);
    setResizingId(viewport.id);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ x: viewport.x, y: viewport.y, w: viewport.width, h: viewport.height });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if ((!draggingId && !resizingId && !astDragging) || !containerRef.current) return;
    const deltaX = (e.clientX - dragStart.x) / scale;
    const deltaY = (e.clientY - dragStart.y) / scale;
    const snap = (val: number) => showGrid ? Math.round(val / 10) * 10 : Math.round(val);

    if (astDragging && onUpdateAstViewport) {
        const next = {
            x: snap(elementStart.x + (resizingId ? 0 : deltaX)),
            y: snap(elementStart.y + (resizingId ? 0 : deltaY)),
            width: Math.max(10, snap(elementStart.w + (resizingId ? deltaX : 0))),
            height: Math.max(10, snap(elementStart.h + (resizingId ? deltaY : 0)))
        };
        onUpdateAstViewport(astDragging.id, next);
        return;
    }

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
    setAstDragging(null);
  };

  // Only render interaction boxes for visible elements on current screen
  const interactionElements = project.elements.filter(el => el.screen === activeScreen);
  const syntaxDocument = getProjectSyntaxDocument(project, activeScreen);
  const astViewports = useAstPreview
      ? listSyntaxViewports(syntaxDocument)
      : [];
  const astTextNodes = useAstPreview
      ? listSyntaxTextNodes(syntaxDocument, project.settings.uiFont)
      : [];
  const astImageNodes = useAstPreview
      ? listSyntaxImageNodes(syntaxDocument, project.settings.uiFont)
      : [];

  const handleAstTextEdit = (node: SyntaxTextEditable) => {
    if (!onUpdateAstText) return;
    const next = window.prompt('Edit text', node.value);
    if (next !== null) {
      onUpdateAstText(node.id, next);
    }
  };

  const handleAstImageEdit = (node: SyntaxImageEditable) => {
    if (!onUpdateAstImage) return;
    const next = window.prompt('Image filename', node.filename);
    if (next !== null) {
      onUpdateAstImage(node.id, next);
    }
  };

  return (
    <div 
        className="relative shadow-2xl bg-black overflow-hidden select-none" 
        style={{ width: IPOD_SCREEN_WIDTH * scale, height: IPOD_SCREEN_HEIGHT * scale }} 
        onMouseMove={handleMouseMove} 
        onMouseUp={handleMouseUp} 
        onMouseLeave={handleMouseUp}
    >
        <div 
            ref={containerRef}
            className={`relative w-full h-full ${showGrid ? 'canvas-grid' : ''}`} 
            style={{ 
                width: IPOD_SCREEN_WIDTH, 
                height: IPOD_SCREEN_HEIGHT, 
                transform: `scale(${scale})`, 
                transformOrigin: 'top left', 
                backgroundColor: project.settings.backgroundColor 
            }} 
            onClick={() => onSelectElement('')}
        >
            {/* LAYER 1: VISUALS (CANVAS) */}
            <canvas 
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
            />

            {/* LAYER 2: INTERACTION (DOM) */}
            {!useAstPreview && interactionElements.map(el => {
                const isSelected = project.selectedElementIds.includes(el.id);
                // For Interaction, we might show hidden elements as semi-transparent boxes if selected?
                // Or just follow visibility.
                if (!el.visible) return null;

                return (
                    <div
                        key={el.id}
                        onMouseDown={(e) => handleMouseDown(e, el)}
                        onClick={(e) => { if(!el.locked) e.stopPropagation(); }}
                        className={`absolute group hover:outline hover:outline-1 hover:outline-blue-400 ${isSelected ? 'outline outline-2 outline-blue-600 z-50' : 'z-10'}`}
                        style={{ 
                            left: el.x, top: el.y, width: el.width, height: el.height, 
                            cursor: el.locked ? 'default' : 'move', 
                            // Interaction layer is transparent but catches events
                            backgroundColor: isSelected ? 'rgba(0,0,255,0.05)' : 'transparent'
                        }}
                    >
                        {isSelected && !el.locked && (
                            <>
                                <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-600 border border-white" />
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-600 border border-white" />
                                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-600 border border-white" />
                                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-600 border border-white cursor-se-resize hover:scale-150 transition-transform" onMouseDown={(e) => handleResizeStart(e, el)} />
                            </>
                        )}
                        
                        {/* Debug Info in Debug Mode */}
                        {debugMode && (
                            <div className="absolute top-0 right-0 bg-black/50 text-white text-[8px] px-1 pointer-events-none">
                                {el.id.substr(0,4)}
                            </div>
                        )}
                    </div>
                );
            })}

            {useAstPreview && astViewports.map(vp => (
                <div
                    key={vp.id}
                    onMouseDown={(e) => handleAstMouseDown(e, vp)}
                    className="absolute group hover:outline hover:outline-1 hover:outline-amber-400 outline outline-1 outline-amber-600/60 z-20"
                    style={{
                        left: vp.x,
                        top: vp.y,
                        width: vp.width,
                        height: vp.height,
                        cursor: 'move',
                        backgroundColor: 'rgba(251, 191, 36, 0.08)'
                    }}
                >
                    <div
                        className="absolute -bottom-1 -right-1 w-3 h-3 bg-amber-600 border border-white cursor-se-resize"
                        onMouseDown={(e) => handleAstResizeStart(e, vp)}
                    />
                </div>
            ))}

            {useAstPreview && astTextNodes.map(node => (
                <div
                    key={node.id}
                    onDoubleClick={() => handleAstTextEdit(node)}
                    className="absolute z-30 border border-dashed border-emerald-400/70 text-[9px] text-emerald-100/80 font-mono pointer-events-auto"
                    style={{
                        left: node.x,
                        top: node.y,
                        width: node.width,
                        height: node.height,
                        backgroundColor: 'rgba(16, 185, 129, 0.08)'
                    }}
                >
                    <span className="px-1">TXT</span>
                </div>
            ))}

            {useAstPreview && astImageNodes.map(node => (
                <div
                    key={node.id}
                    onDoubleClick={() => handleAstImageEdit(node)}
                    className="absolute z-30 border border-dashed border-sky-400/70 text-[9px] text-sky-100/80 font-mono pointer-events-auto"
                    style={{
                        left: node.x,
                        top: node.y,
                        width: node.width,
                        height: node.height,
                        backgroundColor: 'rgba(56, 189, 248, 0.08)'
                    }}
                >
                    <span className="px-1">IMG</span>
                </div>
            ))}
            
            {showGuides && <div className="absolute inset-0 pointer-events-none opacity-50"><div className="absolute top-0 bottom-0 left-1/2 border-l border-cyan-400 border-dashed" /><div className="absolute left-0 right-0 top-1/2 border-t border-cyan-400 border-dashed" /></div>}
        </div>
    </div>
  );
};
