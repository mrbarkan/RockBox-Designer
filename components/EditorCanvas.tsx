
import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { ProjectState, WpsElement, SongMetadata, SimulationState, ScreenType } from '../types';
import { GRAPHIC_ASSETS } from '../constants';
import { getDeviceProfile } from '../rockbox/devices';
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
import type { SemanticResult } from '../rockbox/semantics';
import { renderSemanticToCanvas } from '../rockbox/rendering';
import { themeScreenForPreview } from '../rockbox/screens';
import { collectProjectAssetReferences, listProjectAssets } from '../rockbox/assets';

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
  semanticResult?: SemanticResult | null;
  readOnly?: boolean;
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
  onUpdateAstImage,
  semanticResult,
  readOnly = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const deviceProfile = getDeviceProfile(project.settings.target);
  const screenWidth = deviceProfile.mainScreen.width;
  const screenHeight = deviceProfile.mainScreen.height;
  const syntaxDocument = getProjectSyntaxDocument(project, activeScreen);
  const sourcePreviewActive = useAstPreview && Boolean(semanticResult || syntaxDocument);
  
  // Interaction State
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [astDragging, setAstDragging] = useState<SyntaxViewportEditable | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [elementStart, setElementStart] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // Asset Cache
  const [imageCache, setImageCache] = useState<Record<string, HTMLImageElement>>({});
  const albumArtRef = useRef<string | null>(null);

  // Canonical package bytes own imported/project/component assets. Object URLs
  // and decoded HTML images are disposable render state.
  useEffect(() => {
      let cancelled = false;
      const objectUrls: string[] = [];
      const loadImage = (src: string) => new Promise<HTMLImageElement | null>(resolve => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => resolve(null);
          image.src = src;
      });
      const loadAssets = async () => {
          const newCache: Record<string, HTMLImageElement> = {};
          const records = listProjectAssets(project);
          const basenameCounts = new Map<string, number>();
          records.forEach(({ asset }) => basenameCounts.set(asset.basename, (basenameCounts.get(asset.basename) ?? 0) + 1));
          const imagesByPath = new Map<string, HTMLImageElement>();

          const loadedImages = await Promise.all(records.map(async ({ asset }) => {
              if (asset.kind !== 'bitmap') return null;
              const url = URL.createObjectURL(new Blob([asset.bytes as BlobPart], { type: asset.mimeType ?? 'image/bmp' }));
              objectUrls.push(url);
              const image = await loadImage(url);
              return image ? { asset, image } : null;
          }));
          for (const loaded of loadedImages) {
              if (!loaded) continue;
              const { asset, image } = loaded;
              imagesByPath.set(asset.archivePath, image);
              newCache[asset.archivePath] = image;
              newCache[`/${asset.archivePath}`] = image;
              if (basenameCounts.get(asset.basename) === 1) newCache[asset.basename] = image;
          }

          const sourceScreen = themeScreenForPreview(activeScreen);
          for (const reference of collectProjectAssetReferences(project)) {
              if (reference.scope !== sourceScreen || !reference.resolvedPath) continue;
              const image = imagesByPath.get(reference.resolvedPath);
              if (image) newCache[reference.raw] = image;
          }

          // Legacy synthetic projects still use the compatibility data-URL map.
          for (const [name, dataUrl] of Object.entries(project.assets) as [string, string][]) {
              if (newCache[name] || !dataUrl.startsWith('data:image/')) continue;
              const image = await loadImage(dataUrl);
              if (image) newCache[name] = image;
          }

          if (song.albumArt) {
               const image = await loadImage(song.albumArt);
               if (image) newCache.ALBUM_ART = image;
               albumArtRef.current = song.albumArt;
          } else {
               albumArtRef.current = null;
          }
          if (!cancelled) setImageCache(newCache);
      };
      loadAssets();
      return () => {
          cancelled = true;
          objectUrls.forEach(url => URL.revokeObjectURL(url));
      };
  }, [
    project.assets,
    project.themePackage?.assets,
    project.themePackage?.screenPaths,
    project.projectAssets,
    project.componentAssets,
    project.wpsDocument,
    project.sbsDocument,
    project.fmsDocument,
    activeScreen,
    song.albumArt
  ]);

  // 2. Render Loop
  useLayoutEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Ensure dimensions match (HiDPI support can be added here if needed)
      canvas.width = screenWidth;
      canvas.height = screenHeight;

      // 1. Evaluate
      if (sourcePreviewActive && semanticResult) {
          renderSemanticToCanvas(ctx, semanticResult.operations, imageCache, project.settings.backgroundColor);
      } else {
          const renderList = sourcePreviewActive
              ? evaluateAstTheme(project, activeScreen, sim, song)
              : evaluateTheme(project, activeScreen, sim, song);
          renderToCanvas(ctx, renderList, imageCache, sim.textDirection);
      }

  }, [
    project.elements,
    project.assets,
    project.selectedElementIds,
    project.wpsAst,
    project.sbsAst,
    project.fmsAst,
    project.wpsDocument,
    project.sbsDocument,
    project.fmsDocument,
    project.settings.target,
    project.settings.backdrop,
    project.settings.uiFont,
    project.settings.foregroundColor,
    project.settings.backgroundColor,
    project.settings.statusBarTop,
    project.settings.statusBarPosition,
    activeScreen,
    sim,
    song,
    imageCache,
    screenWidth,
    screenHeight,
    sourcePreviewActive,
    semanticResult
  ]);

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
    if (readOnly) return;
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
  const interactionElements = readOnly || activeScreen === 'usb'
    ? []
    : project.elements.filter(el => el.screen === themeScreenForPreview(activeScreen));
  const astViewports = !readOnly && sourcePreviewActive
      ? semanticResult
          ? semanticResult.operations.filter(operation => operation.type === 'setViewport').map((operation, index) => ({
              renderId: `${operation.source.nodeId}:viewport:${index}`,
              id: operation.source.nodeId,
              x: operation.rect.x,
              y: operation.rect.y,
              width: operation.rect.width,
              height: operation.rect.height
          }))
          : listSyntaxViewports(syntaxDocument).map(node => ({ ...node, renderId: node.id }))
      : [];
  const astTextNodes = !readOnly && sourcePreviewActive
      ? semanticResult
          ? semanticResult.operations.filter(operation => operation.type === 'drawText').map((operation, index) => ({
              renderId: `${operation.source.nodeId}:text:${index}`,
              id: operation.source.nodeId,
              value: operation.text,
              x: operation.rect.x,
              y: operation.rect.y,
              width: operation.rect.width,
              height: operation.rect.height
          }))
          : listSyntaxTextNodes(syntaxDocument, project.settings.uiFont).map(node => ({ ...node, renderId: node.id }))
      : [];
  const astImageNodes = !readOnly && sourcePreviewActive
      ? semanticResult
          ? semanticResult.operations.filter(operation => operation.type === 'drawBitmap').map((operation, index) => ({
              renderId: `${operation.source.nodeId}:image:${index}`,
              id: operation.source.nodeId,
              filename: operation.assetPath,
              x: operation.rect.x,
              y: operation.rect.y,
              width: Math.min(operation.rect.width, 24),
              height: Math.min(operation.rect.height, 24)
          }))
          : listSyntaxImageNodes(syntaxDocument, project.settings.uiFont).map(node => ({ ...node, renderId: node.id }))
      : [];
  const semanticElements = !readOnly && sourcePreviewActive && semanticResult
      ? semanticResult.operations.filter(operation =>
          ['drawProgress', 'drawAlbumArt', 'drawRect', 'debugOverlay'].includes(operation.type)
        )
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
        style={{ width: screenWidth * scale, height: screenHeight * scale }}
        onMouseMove={handleMouseMove} 
        onMouseUp={handleMouseUp} 
        onMouseLeave={handleMouseUp}
    >
        <div 
            ref={containerRef}
            className={`relative w-full h-full ${showGrid ? 'canvas-grid' : ''}`} 
            style={{ 
                width: screenWidth,
                height: screenHeight,
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
                style={{ imageRendering: 'pixelated' }}
            />

            {sourcePreviewActive && semanticResult?.stale && (
                <div className="absolute left-2 top-2 z-50 bg-amber-500 text-black border border-black px-2 py-1 text-[9px] font-mono font-bold uppercase shadow-[2px_2px_0_black]">
                    Preview stale · fix source diagnostics
                </div>
            )}

            {/* LAYER 2: INTERACTION (DOM) */}
            {!sourcePreviewActive && interactionElements.map(el => {
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

            {sourcePreviewActive && astViewports.map(vp => (
                <div
                    key={vp.renderId}
                    onMouseDown={(e) => handleAstMouseDown(e, vp)}
                    onClick={(e) => { e.stopPropagation(); onSelectElement(vp.id); }}
                    className={`absolute group z-20 hover:outline hover:outline-1 hover:outline-amber-400 ${project.selectedElementIds.includes(vp.id) ? 'outline outline-2 outline-orange-500' : debugMode ? 'outline outline-1 outline-amber-600/60' : ''}`}
                    style={{
                        left: vp.x,
                        top: vp.y,
                        width: vp.width,
                        height: vp.height,
                        cursor: 'move',
                        backgroundColor: project.selectedElementIds.includes(vp.id) || debugMode ? 'rgba(251, 191, 36, 0.08)' : 'transparent'
                    }}
                >
                    <div
                        className={`absolute -bottom-1 -right-1 w-3 h-3 bg-amber-600 border border-white cursor-se-resize group-hover:opacity-100 ${project.selectedElementIds.includes(vp.id) || debugMode ? 'opacity-100' : 'opacity-0'}`}
                        onMouseDown={(e) => handleAstResizeStart(e, vp)}
                    />
                </div>
            ))}

            {sourcePreviewActive && astTextNodes.map(node => (
                <div
                    key={node.renderId}
                    onDoubleClick={() => handleAstTextEdit(node)}
                    onClick={(e) => { e.stopPropagation(); onSelectElement(node.id); }}
                    className={`absolute z-30 text-[9px] text-emerald-100/80 font-mono pointer-events-auto hover:border hover:border-dashed hover:border-emerald-400/70 ${project.selectedElementIds.includes(node.id) ? 'border border-dashed border-orange-500 bg-orange-500/10' : debugMode ? 'border border-dashed border-emerald-400/70' : ''}`}
                    style={{
                        left: node.x,
                        top: node.y,
                        width: node.width,
                        height: node.height,
                        backgroundColor: project.selectedElementIds.includes(node.id) || debugMode ? 'rgba(16, 185, 129, 0.08)' : 'transparent'
                    }}
                >
                    {(project.selectedElementIds.includes(node.id) || debugMode) && <span className="px-1">TXT</span>}
                </div>
            ))}

            {sourcePreviewActive && astImageNodes.map(node => (
                <div
                    key={node.renderId}
                    onDoubleClick={() => handleAstImageEdit(node)}
                    onClick={(e) => { e.stopPropagation(); onSelectElement(node.id); }}
                    className={`absolute z-30 text-[9px] text-sky-100/80 font-mono pointer-events-auto hover:border hover:border-dashed hover:border-sky-400/70 ${project.selectedElementIds.includes(node.id) ? 'border border-dashed border-orange-500 bg-orange-500/10' : debugMode ? 'border border-dashed border-sky-400/70' : ''}`}
                    style={{
                        left: node.x,
                        top: node.y,
                        width: node.width,
                        height: node.height,
                        backgroundColor: project.selectedElementIds.includes(node.id) || debugMode ? 'rgba(56, 189, 248, 0.08)' : 'transparent'
                    }}
                >
                    {(project.selectedElementIds.includes(node.id) || debugMode) && <span className="px-1">IMG</span>}
                </div>
            ))}

            {semanticElements.map((operation, index) => (
                <div
                    key={`${operation.type}:${operation.source.nodeId}:${index}`}
                    onClick={(e) => { e.stopPropagation(); onSelectElement(operation.source.nodeId); }}
                    className={`absolute z-[25] pointer-events-auto hover:border hover:border-dotted hover:border-cyan-300/50 ${project.selectedElementIds.includes(operation.source.nodeId) ? 'border border-dotted border-orange-500 bg-orange-500/10' : debugMode ? 'border border-dotted border-cyan-300/50' : ''}`}
                    style={{
                        left: operation.rect.x,
                        top: operation.rect.y,
                        width: operation.rect.width,
                        height: operation.rect.height
                    }}
                    title={operation.type}
                />
            ))}
            
            {showGuides && <div className="absolute inset-0 pointer-events-none opacity-50"><div className="absolute top-0 bottom-0 left-1/2 border-l border-cyan-400 border-dashed" /><div className="absolute left-0 right-0 top-1/2 border-t border-cyan-400 border-dashed" /></div>}
        </div>
    </div>
  );
};
