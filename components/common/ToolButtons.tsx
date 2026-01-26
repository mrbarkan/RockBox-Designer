
import React from 'react';

export const ToolButton = ({ icon, onClick, active, disabled, className }: any) => (
    <button onClick={onClick} disabled={disabled} className={`flex-1 h-10 rounded-sm flex items-center justify-center gap-2 transition-all te-button ${active ? 'bg-orange-600 text-white border border-black shadow-none translate-y-[1px]' : 'bg-white text-black border border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:bg-gray-50'} ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-200 border-gray-300 shadow-none' : ''} ${className}`}><span className="text-sm font-bold font-mono">{icon}</span></button>
);

export const ToolIconBtn = ({ children, onClick, title }: any) => (
    <button onClick={onClick} className="w-full h-10 rounded-sm text-black text-base flex items-center justify-center leading-none active:translate-y-[1px] hover:bg-orange-50 active:shadow-none transition-all bg-white border border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] font-bold" title={title}>{children}</button>
);

export const TeActionButton = ({ onClick, color, label, icon }: any) => (
    <button onClick={onClick} className={`w-full h-10 rounded-sm flex items-center justify-center gap-2 transition-all bg-${color}-600 text-white border border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:bg-${color}-500 active:translate-y-[1px] active:shadow-none`}><span className="text-sm font-bold font-mono">{icon} {label}</span></button>
);
