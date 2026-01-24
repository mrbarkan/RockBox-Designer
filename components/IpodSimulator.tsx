import React from 'react';
import { ThemeConfig, SongMetadata, LayoutStyle, ThemeFont } from '../types';
import { IPOD_SCREEN_HEIGHT, IPOD_SCREEN_WIDTH } from '../constants';

interface IpodSimulatorProps {
  theme: ThemeConfig;
  song: SongMetadata;
  scale?: number;
}

export const IpodSimulator: React.FC<IpodSimulatorProps> = ({ theme, song, scale = 1 }) => {
  const { colors, layout, showAlbumArt, showNextSong, statusBar, font } = theme;

  const width = IPOD_SCREEN_WIDTH;
  const height = IPOD_SCREEN_HEIGHT;

  // CSS Font Mapping
  const getFontFamily = (f: ThemeFont) => {
      switch (f) {
          case ThemeFont.NIMBUS_14: return '"Inter", sans-serif';
          case ThemeFont.TERMINUS_16: return '"JetBrains Mono", monospace';
          case ThemeFont.UNIFONT_16: return '"Inter", sans-serif';
          default: return '"Inter", sans-serif';
      }
  };

  const fontFamily = getFontFamily(font);

  // -- Layout Logic --
  
  const renderArt = () => {
    if (!showAlbumArt) return null;
    
    let style: React.CSSProperties = {};
    if (layout === LayoutStyle.MINIMAL) {
      style = { top: 30, left: 10, width: 100, height: 100 };
    } else if (layout === LayoutStyle.SPLIT) {
      style = { top: 20, left: 0, width: 320, height: 120, objectFit: 'contain' };
    } else {
      style = { top: 0, left: 0, width: 320, height: 240, opacity: 0.2 };
    }

    return (
      <div className="absolute flex items-center justify-center border-0" style={{
          ...style,
          backgroundColor: '#e5e5e5'
      }}>
        {/* Abstract geometric art placeholder if no image, Rams style */}
        <div className="w-1/2 h-1/2 rounded-full border-4 opacity-20" style={{ borderColor: colors.foreground }}></div>
        <div className="absolute text-[8px] font-mono opacity-40 bottom-2 right-2 tracking-widest">ART</div>
      </div>
    );
  };

  const renderMetadata = () => {
    let style: React.CSSProperties = {
      color: colors.foreground,
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: '2px',
      fontFamily
    };

    if (layout === LayoutStyle.MINIMAL && showAlbumArt) {
      style = { ...style, top: 30, left: 120, width: 190, height: 100, textAlign: 'left', alignItems: 'flex-start' };
    } else if (layout === LayoutStyle.SPLIT) {
      style = { ...style, top: 150, left: 10, width: 300, height: 60 };
    } else {
      style = { ...style, top: 30, left: 10, width: 300, height: 100 };
    }

    return (
      <div className="absolute font-medium" style={style}>
        <div className="text-base leading-tight">{song.title}</div>
        <div className="text-sm opacity-80">{song.artist}</div>
        <div className="text-xs opacity-60 mt-1">{song.album}</div>
      </div>
    );
  };

  const renderProgressBar = () => {
    const pct = (song.currentSec / song.totalSec) * 100;
    
    const fmt = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    return (
      <div className="absolute flex flex-col items-center" style={{ bottom: 20, left: 10, width: 300, fontFamily }}>
         <div className="flex justify-between w-full text-[10px] mb-1 opacity-80" style={{ color: colors.foreground }}>
            <span>{fmt(song.currentSec)}</span>
            <span>{fmt(song.totalSec)}</span>
         </div>
         <div className="w-full h-1 relative" style={{ backgroundColor: colors.barBackground }}>
            <div 
              className="h-full absolute top-0 left-0" 
              style={{ width: `${pct}%`, backgroundColor: colors.foreground }} 
            />
         </div>
      </div>
    );
  };

  const renderStatusBar = () => {
    if (!statusBar) return null;
    return (
      <div 
        className="absolute top-0 left-0 w-full h-5 flex items-center justify-between px-2 text-[10px] uppercase tracking-wide"
        style={{ 
            color: colors.foreground,
            fontFamily,
            borderBottom: `1px solid ${colors.barBackground}`
        }}
      >
         <div className="flex gap-2">
            <span className="font-bold">▶</span>
            <span>{song.trackNum}/{song.totalTracks}</span>
         </div>
         <div className="flex gap-2 items-center">
            <span>12:45</span>
            <div className="w-4 h-2 border border-current relative">
                <div className="h-full bg-current w-2/3"></div>
            </div>
         </div>
      </div>
    );
  };

  return (
    <div className="relative inline-block">
      {/* iPod Chassis */}
      <div 
        className="relative rounded-[16px] shadow-2xl p-6 transition-colors duration-500"
        style={{ 
            transform: `scale(${scale})`, 
            transformOrigin: 'top center',
            backgroundColor: '#f3f4f6', // Neutral chassis
            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)'
        }}
      >
        {/* Screen Bezel */}
        <div className="p-1.5 bg-gray-100 border border-gray-200 rounded-sm mx-auto mb-8 shadow-inner" style={{ width: width + 14, height: height + 14 }}>
             {/* LCD Screen */}
             <div 
                className="relative overflow-hidden"
                style={{ 
                    width: width, 
                    height: height, 
                    backgroundColor: colors.background,
                }}
             >
                {renderStatusBar()}
                {renderArt()}
                {renderMetadata()}
                {renderProgressBar()}
                
                {showNextSong && (
                  <div 
                    className="absolute text-[9px] uppercase tracking-wider"
                    style={{ bottom: 45, left: 10, width: 300, color: colors.accent, fontFamily }}
                  >
                    Next: Trans-Europe Express
                  </div>
                )}
             </div>
        </div>

        {/* Click Wheel */}
        <div className="mx-auto w-48 h-48 bg-white rounded-full relative flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-gray-100">
           <div className="absolute top-4 text-[10px] font-bold text-gray-400 tracking-widest">MENU</div>
           <div className="absolute bottom-4 text-[14px] text-gray-400">▶||</div>
           <div className="absolute left-4 text-[14px] text-gray-400">|◀◀</div>
           <div className="absolute right-4 text-[14px] text-gray-400">▶▶|</div>
           
           <div className="w-16 h-16 bg-gray-50 rounded-full shadow-inner border border-gray-100" />
        </div>
      </div>
    </div>
  );
};