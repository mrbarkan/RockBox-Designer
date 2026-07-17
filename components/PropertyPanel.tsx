
import React, { useState, useEffect, useMemo } from 'react';
import { WpsElement, ElementType, ProjectState, FontDefinition, ImageElement, ProgressBarElement, TextElement } from '../types';
import { ROCKBOX_STANDARD_FONTS, GRAPHIC_ASSETS } from '../constants';

interface PropertyPanelProps {
  element: WpsElement | null;
  project: ProjectState;
  onUpdate: (id: string, updates: Partial<WpsElement>) => void;
  onUpdateProject: (updates: Partial<ProjectState['settings']>, newAsset?: { name: string, data: string }) => void;
  onDelete: (id: string) => void;
  onDeselect: () => void;
  onOpenTheme: () => void;
}

// ... (parseFontId, buildFontId, CONTENT_TYPES, TOUCH_ACTIONS helpers remain the same as previous)
const parseFontId = (fontId: string): { size: number, family: string } => {
    const match = fontId.match(/^(\d+)-(.+?)(?:\.fnt)?$/);
    if (match) {
        return { size: parseInt(match[1]), family: match[2] };
    }
    return { size: 12, family: fontId.replace('.fnt', '') };
};

const buildFontId = (size: number, family: string): string => {
    return `${size}-${family}.fnt`;
};

const CONTENT_TYPES: Record<string, { label: string, value: string }[]> = {
    'id3': [
        { label: 'Title (%s)', value: '%s' },
        { label: 'Artist (%ia)', value: '%ia' },
        { label: 'Album (%id)', value: '%id' },
        { label: 'Track Title (%it)', value: '%it' },
        { label: 'Composer (%ic)', value: '%ic' },
        { label: 'Album Artist (%iA)', value: '%iA' },
        { label: 'Grouping (%iG)', value: '%iG' },
        { label: 'Genre (%ig)', value: '%ig' },
        { label: 'Track # (%in)', value: '%in' },
        { label: 'Disc # (%ik)', value: '%ik' },
        { label: 'Year (%iy)', value: '%iy' },
        { label: 'Version (%iv)', value: '%iv' },
        { label: 'Comment (%iC)', value: '%iC' }
    ],
    'next_track': [
        { label: 'Next Title (%It)', value: '%It' },
        { label: 'Next Artist (%Ia)', value: '%Ia' },
        { label: 'Next Album (%Id)', value: '%Id' },
        { label: 'Next File (%If)', value: '%If' },
        { label: 'Next Dir (%Id)', value: '%Id' }
    ],
    'power': [
        { label: 'Battery Percent (%bl%%)', value: '%bl%%' },
        { label: 'Battery Voltage (%bv)', value: '%bv' },
        { label: 'Time Left (%bt)', value: '%bt' }
    ],
    'rtc': [
        { label: '12-Hour Clock (%cl:%cM %cP)', value: '%cl:%cM %cP' },
        { label: '24-Hour Clock (%cH:%cM)', value: '%cH:%cM' },
        { label: 'Date (%cb %cd %cY)', value: '%cb %cd %cY' },
        { label: 'Day of Week (%ca)', value: '%ca' }
    ],
    'file': [
        { label: 'Filename (%fn)', value: '%fn' },
        { label: 'Full Path (%fp)', value: '%fp' },
        { label: 'Bitrate (%fb)', value: '%fb' },
        { label: 'Codec (%fc)', value: '%fc' },
        { label: 'File Size (%fz)', value: '%fz' }
    ],
    'playlist_info': [
        { label: 'Current Time (%pc)', value: '%pc' },
        { label: 'Total Time (%pt)', value: '%pt' },
        { label: 'Remaining (%pr)', value: '%pr' },
        { label: 'Position/Total (%pp/%pe)', value: '%pp/%pe' }
    ],
    'database': [
        { label: 'Play Count (%rp)', value: '%rp' },
        { label: 'Rating (%rr)', value: '%rr' },
        { label: 'Track Gain (%Rg)', value: '%Rg' },
        { label: 'Album Gain (%Rg)', value: '%Rg' }
    ],
    'fm': [
        { label: 'Frequency (%tf)', value: '%tf' },
        { label: 'Station Name (%ti)', value: '%ti' },
        { label: 'Signal Strength (%ts)', value: '%ts' },
        { label: 'Stereo/Mono (%tS)', value: '%?tS<Mono|Stereo>' }
    ],
    'playback': [
        { label: 'Status Text (Play/Stop...)', value: '%?mp<Stop|Play|Pause>' },
        { label: 'Status Icon (Char)', value: '%?mp<⏹|▶|⏸>' }
    ],
    'crossfade': [
        { label: 'Crossfade Status', value: '%?cf<Off|On>' }
    ],
    'default': [
        { label: 'Custom Text', value: 'Text' },
        { label: 'Title', value: '%s' }
    ]
};

const TOUCH_ACTIONS = [
    { label: 'None', value: '' },
    { label: 'Play/Pause', value: 'wps_play' },
    { label: 'Previous', value: 'wps_prev' },
    { label: 'Next', value: 'wps_next' },
    { label: 'Volume Up', value: 'volume_up' },
    { label: 'Volume Down', value: 'volume_down' },
    { label: 'Menu', value: 'menu' },
    { label: 'Browse', value: 'browse' },
    { label: 'Context Menu', value: 'context' },
    { label: 'Playlist', value: 'playlist' },
    { label: 'ID3 Screen', value: 'id3_screen' },
    { label: 'Quick Screen', value: 'quick_screen' },
];

export const PropertyPanel: React.FC<PropertyPanelProps> = ({ element, project, onUpdate, onUpdateProject, onDelete, onDeselect, onOpenTheme }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const availableFonts = useMemo(() => {
      const fonts: Record<string, FontDefinition> = { ...ROCKBOX_STANDARD_FONTS };
      Object.keys(project.assets).forEach(filename => {
          if (filename.toLowerCase().endsWith('.fnt')) {
              const { size, family } = parseFontId(filename);
              if (!fonts[family]) fonts[family] = { family, sizes: [], type: 'sans' };
              if (!fonts[family].sizes.includes(size)) {
                  fonts[family].sizes.push(size);
                  fonts[family].sizes.sort((a, b) => a - b);
              }
          }
      });
      return fonts;
  }, [project.assets]);

  const fontFamilies = Object.keys(availableFonts).sort();

  useEffect(() => setShowDeleteConfirm(false), [element?.id]);

  // Helper to inject Adwaita assets if they don't exist
  const ensureAdwaitaAssets = () => {
      const { BACKDROP, ICONS, SLIDER_BG, SLIDER_FG } = GRAPHIC_ASSETS.VOLUME_OVERLAY;
      [BACKDROP, ICONS, SLIDER_BG, SLIDER_FG].forEach(asset => {
          if (!project.assets[asset.filename]) {
              onUpdateProject({}, { name: asset.filename, data: asset.src });
          }
      });
  };

  const handlePbStyleChange = (style: string) => {
      if (!element) return;
      onUpdate(element.id, { pbStyle: style as any });
      if (style === 'adwaita') {
          ensureAdwaitaAssets();
          // Resize to fit the overlay
          onUpdate(element.id, { width: 180, height: 45 });
      }
  };

  const FontSelector = ({ currentFontId, onChange }: { currentFontId: string, onChange: (newId: string) => void }) => {
      const { size, family } = parseFontId(currentFontId);
      const validFamily = availableFonts[family] ? family : 'Nimbus';
      const sizes = availableFonts[validFamily]?.sizes || [14];
      return (
          <div className="space-y-3">
              <div className="flex gap-3">
                  <div className="flex-1">
                      <label className="block mb-2 text-[10px] text-gray-500 font-bold uppercase">FAMILY</label>
                      <select value={validFamily} onChange={(e) => { const newFamily = e.target.value; const newSize = availableFonts[newFamily].sizes[0] || 12; onChange(buildFontId(newSize, newFamily)); }} className="w-full bg-gray-100 border border-gray-300 p-2 text-xs">{fontFamilies.map(f => <option key={f} value={f}>{f}</option>)}</select>
                  </div>
                  <div className="w-20">
                      <label className="block mb-2 text-[10px] text-gray-500 font-bold uppercase">SIZE</label>
                      <select value={size} onChange={(e) => onChange(buildFontId(parseInt(e.target.value), validFamily))} className="w-full bg-gray-100 border border-gray-300 p-2 text-xs">{sizes.map(s => <option key={s} value={s}>{s}</option>)}</select>
                  </div>
              </div>
          </div>
      );
  };

  const TeButton = ({ active, children, onClick }: any) => (
      <button 
        onClick={onClick}
        className={`flex-1 py-3 text-xs font-bold uppercase transition-all border border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none
        ${active ? 'bg-orange-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
      >
        {children}
      </button>
  );

  const renderGraphicVariants = (label: string, variants: typeof GRAPHIC_ASSETS.BATTERY) => {
      if (!element || element.type !== ElementType.IMAGE) return null;
      const imgEl = element as ImageElement;
      return (
          <div className="border border-gray-300 p-4 bg-white mt-6 relative">
              <span className="absolute -top-2 left-3 bg-white px-2 text-[10px] text-gray-400 font-bold uppercase">{label}</span>
              <div className="grid grid-cols-2 gap-3 mt-2">
                  {variants.map((v, i) => (
                      <button 
                        key={i}
                        onClick={() => {
                            onUpdate(element.id, { src: v.src, filename: v.filename, width: v.width, height: v.height });
                            onUpdateProject({}, { name: v.filename, data: v.src });
                        }}
                        className={`p-3 border flex flex-col items-center gap-2 hover:bg-gray-50 transition-colors ${imgEl.filename === v.filename ? 'border-orange-500 bg-orange-50' : 'border-gray-200'}`}
                      >
                          <img src={v.src} alt={v.name} className="h-5 object-contain" />
                          <span className="text-[10px] text-gray-500 font-bold">{v.name}</span>
                      </button>
                  ))}
              </div>
          </div>
      );
  };

  if (!element) {
    return (
      <div className="p-6 font-mono text-xs text-black">
        <div className="border-2 border-black bg-[#f8f8f3] p-5 shadow-[5px_5px_0_#111]">
          <div className="text-[9px] font-black uppercase tracking-[0.22em] text-orange-700">One canonical project editor</div>
          <h3 className="mt-2 text-base font-black uppercase">Theme settings moved</h3>
          <p className="mt-3 leading-relaxed text-[#555]">Target, metadata, global colors, UI behavior, fonts, package paths, and raw CFG now commit together in Theme. This panel no longer writes a second settings path.</p>
          <button type="button" onClick={onOpenTheme} className="mt-5 w-full border-2 border-black bg-[#ff6b35] px-4 py-3 text-[10px] font-black uppercase shadow-[3px_3px_0_#111]">Open Theme workspace</button>
        </div>
      </div>
    );
  }

  // --- ELEMENT PROPERTIES ---
  const contentOptions = element.category && CONTENT_TYPES[element.category] ? CONTENT_TYPES[element.category] : CONTENT_TYPES['default'];

  return (
    <div className="p-6 text-xs font-mono text-black relative">
      <div className="flex justify-between items-center mb-6 border-b border-black pb-3 bg-yellow-50 -mx-6 px-6 pt-3 border-t">
        <h3 className="font-bold text-black uppercase tracking-wider">{element.category ? element.category.toUpperCase() : element.type} NODE</h3>
        <button onClick={onDeselect} className="text-gray-400 hover:text-black w-6 h-6 flex items-center justify-center border border-transparent hover:border-black transition-all text-lg">✕</button>
      </div>

      <div className="space-y-6">
        {/* Dimensions */}
        <div className="grid grid-cols-2 gap-4">
            <div><label className="block mb-2 text-gray-500 font-bold uppercase text-[10px]">POS_X</label><input type="number" value={element.x} onChange={(e) => onUpdate(element.id, { x: parseInt(e.target.value) })} className="w-full bg-gray-100 border-b border-black p-2 text-right" /></div>
            <div><label className="block mb-2 text-gray-500 font-bold uppercase text-[10px]">POS_Y</label><input type="number" value={element.y} onChange={(e) => onUpdate(element.id, { y: parseInt(e.target.value) })} className="w-full bg-gray-100 border-b border-black p-2 text-right" /></div>
            <div><label className="block mb-2 text-gray-500 font-bold uppercase text-[10px]">WIDTH</label><input type="number" value={element.width} onChange={(e) => onUpdate(element.id, { width: parseInt(e.target.value) })} className="w-full bg-gray-100 border-b border-black p-2 text-right" /></div>
            <div><label className="block mb-2 text-gray-500 font-bold uppercase text-[10px]">HEIGHT</label><input type="number" value={element.height} onChange={(e) => onUpdate(element.id, { height: parseInt(e.target.value) })} className="w-full bg-gray-100 border-b border-black p-2 text-right" /></div>
        </div>

        {/* Text Props */}
        {element.type === ElementType.TEXT && (
            <div className="border border-gray-300 p-4 bg-white mt-6 relative">
                <span className="absolute -top-2 left-3 bg-white px-2 text-[10px] text-gray-400 font-bold uppercase">CONTENT_SOURCE</span>
                
                {element.category === 'volume_text' ? (
                     <div className="mb-4 mt-2">
                        <label className="block mb-2 text-gray-500 font-bold uppercase text-[10px]">VOLUME FORMAT</label>
                        <select 
                            value={(element as TextElement).volumeFormat || 'numeric'} 
                            onChange={(e) => onUpdate(element.id, { volumeFormat: e.target.value as any })} 
                            className="w-full bg-gray-100 border border-gray-300 p-2 text-xs mb-3"
                        >
                            <option value="numeric">Numeric (0-100)</option>
                            <option value="db">Decibels (dB)</option>
                            <option value="percent">Percentage (%)</option>
                        </select>
                     </div>
                ) : (
                    <div className="mb-4 mt-2">
                        <label className="block mb-2 text-gray-500 font-bold uppercase text-[10px]">CONTENT TYPE</label>
                        <select value={(element as any).content} onChange={(e) => onUpdate(element.id, { content: e.target.value })} className="w-full bg-gray-100 border border-gray-300 p-2 text-xs mb-3">
                            {contentOptions.map((opt, i) => <option key={i} value={opt.value}>{opt.label}</option>)}
                        </select>
                        <label className="block mb-2 text-gray-500 font-bold uppercase text-[10px]">CUSTOM_STRING</label>
                        <input type="text" value={(element as any).content} onChange={(e) => onUpdate(element.id, { content: e.target.value })} className="w-full bg-black text-orange-500 border border-gray-500 p-2 font-mono"/>
                    </div>
                )}
                
                <div className="mb-4">
                     <label className="block mb-2 text-gray-500 font-bold uppercase text-[10px]">TYPEFACE</label>
                     <FontSelector currentFontId={(element as any).fontId} onChange={(newId) => onUpdate(element.id, { fontId: newId })} />
                </div>
                
                <div className="mb-4">
                    <label className="block mb-2 text-gray-500 font-bold uppercase text-[10px]">ALIGNMENT</label>
                    <div className="flex gap-3">
                        <TeButton active={(element as any).align === 'left'} onClick={() => onUpdate(element.id, { align: 'left' })}>Left</TeButton>
                        <TeButton active={(element as any).align === 'center'} onClick={() => onUpdate(element.id, { align: 'center' })}>Center</TeButton>
                        <TeButton active={(element as any).align === 'right'} onClick={() => onUpdate(element.id, { align: 'right' })}>Right</TeButton>
                    </div>
                </div>

                <div className="mb-4 flex items-center gap-3">
                     <label className="flex items-center gap-2 cursor-pointer select-none">
                         <input type="checkbox" checked={(element as any).scroll || false} onChange={e => onUpdate(element.id, { scroll: e.target.checked })} className="w-4 h-4" />
                         <span className="font-bold text-gray-600">Enable Scrolling</span>
                     </label>
                </div>

                <div className="mb-2">
                    <label className="block mb-2 text-gray-500 font-bold uppercase text-[10px]">INK_COLOR</label>
                    <div className="flex gap-3 items-center">
                        <input type="color" value={(element as any).color} onChange={(e) => onUpdate(element.id, { color: e.target.value })} className="h-8 w-8 border border-black cursor-pointer p-0" />
                        <span className="font-mono text-sm">{ (element as any).color }</span>
                    </div>
                </div>
            </div>
        )}

        {/* Progress Bar Props */}
        {element.type === ElementType.PROGRESS_BAR && (
            <div className="border border-gray-300 p-4 bg-white mt-6 relative">
                 <span className="absolute -top-2 left-3 bg-white px-2 text-[10px] text-gray-400 font-bold uppercase">BAR CONFIG</span>
                 
                 <div className="mb-4 mt-2">
                     <label className="block mb-2 text-gray-500 font-bold uppercase text-[10px]">FUNCTION MODE</label>
                     <select 
                        value={(element as ProgressBarElement).pbMode || 'track'} 
                        onChange={(e) => onUpdate(element.id, { pbMode: e.target.value as any })}
                        className="w-full bg-gray-100 border border-gray-300 p-2 text-xs mb-3"
                     >
                         <option value="track">Track Progress</option>
                         <option value="volume">Volume Level</option>
                         <option value="auto">Auto (Volume Overlay)</option>
                     </select>
                 </div>

                 <div className="mb-4">
                     <label className="block mb-2 text-gray-500 font-bold uppercase text-[10px]">GRAPHIC STYLE</label>
                     <select 
                        value={(element as ProgressBarElement).pbStyle || 'flat'} 
                        onChange={(e) => handlePbStyleChange(e.target.value)}
                        className="w-full bg-gray-100 border border-gray-300 p-2 text-xs mb-3"
                     >
                         <option value="flat">Standard (Flat)</option>
                         <option value="rounded">Rounded</option>
                         <option value="segmented">Segmented (LCD)</option>
                         <option value="adwaita">Adwaitapod Overlay</option>
                     </select>
                 </div>

                 <div className="grid grid-cols-2 gap-4 mb-2">
                     <div>
                        <label className="block mb-2 text-gray-500 font-bold uppercase text-[10px]">FOREGROUND</label>
                        <div className="flex gap-2"><input type="color" value={(element as ProgressBarElement).foreColor} onChange={(e) => onUpdate(element.id, { foreColor: e.target.value })} className="w-6 h-6 border border-black p-0"/><input type="text" value={(element as ProgressBarElement).foreColor} onChange={e=>onUpdate(element.id, {foreColor:e.target.value})} className="w-full border p-1"/></div>
                     </div>
                     <div>
                        <label className="block mb-2 text-gray-500 font-bold uppercase text-[10px]">BACKGROUND</label>
                        <div className="flex gap-2"><input type="color" value={(element as ProgressBarElement).backColor} onChange={(e) => onUpdate(element.id, { backColor: e.target.value })} className="w-6 h-6 border border-black p-0"/><input type="text" value={(element as ProgressBarElement).backColor} onChange={e=>onUpdate(element.id, {backColor:e.target.value})} className="w-full border p-1"/></div>
                     </div>
                 </div>
            </div>
        )}

        {renderGraphicVariants("BATTERY_STYLE", GRAPHIC_ASSETS.BATTERY)}

        <div className="pt-8 mt-6 border-t border-gray-300">
            <button onClick={() => setShowDeleteConfirm(true)} className="w-full py-3 bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white font-bold uppercase text-xs">Delete Element</button>
        </div>

        {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-[#e0e0e0] border-2 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] w-full max-w-xs p-6 text-center">
                    <h4 className="font-bold text-sm uppercase mb-4">Confirm Deletion</h4>
                    <div className="flex gap-4">
                        <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 bg-white border border-black font-bold uppercase text-xs">Cancel</button>
                        <button onClick={() => { onDelete(element.id); setShowDeleteConfirm(false); }} className="flex-1 py-3 bg-red-600 text-white font-bold border border-black uppercase text-xs">Delete</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
