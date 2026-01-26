
import React from 'react';
import { ToolButton, ToolIconBtn, TeActionButton } from './common/ToolButtons';

interface EditorToolbarProps {
    onShowMainMenu: () => void;
    onShowLibModal: () => void;
    onDuplicate: () => void;
    onToggleLock: () => void;
    onMoveLayer: (dir: 'up' | 'down') => void;
    onShowPalette: () => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onOpenPrompt: () => void;
    onSave: () => void;
    onExport: () => void;
    
    // File Handler Refs
    imageInputRef: React.RefObject<HTMLInputElement | null>;
    loadProjectInputRef: React.RefObject<HTMLInputElement | null>;
    importZipInputRef: React.RefObject<HTMLInputElement | null>;
    globalFontInputRef: React.RefObject<HTMLInputElement | null>;
    
    // Handlers for inputs
    onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onLoadProject: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onImportZip: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onGlobalFontUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
    onShowMainMenu, onShowLibModal, onDuplicate, onToggleLock, onMoveLayer, onShowPalette,
    undo, redo, canUndo, canRedo, onOpenPrompt, onSave, onExport,
    imageInputRef, loadProjectInputRef, importZipInputRef, globalFontInputRef,
    onImageUpload, onLoadProject, onImportZip, onGlobalFontUpload
}) => {
    return (
        <div className="w-24 pinstripe border-r border-black flex flex-col items-center py-6 gap-5 z-20">
            <button onClick={onShowMainMenu} className="w-14 h-14 bg-orange-600 flex items-center justify-center font-bold text-white text-2xl border border-black shadow-[3px_3px_0px_black] hover:bg-orange-500 active:translate-y-[1px] active:shadow-none transition-all">R</button>
            <div className="flex flex-col gap-4 w-full px-3">
                <button onClick={onShowLibModal} className="w-full h-14 rounded-sm bg-[#4caf50] hover:bg-[#43a047] active:translate-y-[1px] border border-black shadow-[3px_3px_0px_black] active:shadow-none text-white flex items-center justify-center transition-all" title="Add New Element"><span className="text-3xl font-bold leading-none">+</span></button>
                <div className="h-[2px] bg-black/10 my-1" />
                <div className="flex flex-col gap-3">
                    <div className="text-[10px] font-bold text-center uppercase opacity-50 tracking-wider">Modify</div>
                    <div className="grid grid-cols-2 gap-2">
                        <ToolIconBtn onClick={onDuplicate} title="Duplicate">📄</ToolIconBtn>
                        <ToolIconBtn onClick={onToggleLock} title="Lock">🔒</ToolIconBtn>
                        <ToolIconBtn onClick={() => onMoveLayer('up')} title="Up">▲</ToolIconBtn>
                        <ToolIconBtn onClick={() => onMoveLayer('down')} title="Down">▼</ToolIconBtn>
                    </div>
                    <button onClick={onShowPalette} className="w-full h-10 bg-white border border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 text-xs font-bold uppercase hover:bg-gray-50 active:translate-y-[1px] active:shadow-none transition-all">
                        <span className="w-4 h-4 rounded-full border border-black" style={{ background: 'linear-gradient(135deg, red, blue)' }}></span> Colors
                    </button>
                    <div className="flex gap-2 mt-2">
                        <ToolButton icon="↩" onClick={undo} disabled={!canUndo} className={!canUndo ? 'opacity-30' : ''} />
                        <ToolButton icon="↪" onClick={redo} disabled={!canRedo} className={!canRedo ? 'opacity-30' : ''} />
                    </div>
                </div>
            </div>
            <div className="flex-1" />
            <button onClick={onOpenPrompt} className="w-12 h-12 rounded-full border-2 border-black flex items-center justify-center hover:bg-yellow-400 transition-colors bg-white group shadow-[3px_3px_0px_rgba(0,0,0,0.2)]" title="AI Designer"><span className="text-xl font-bold group-hover:scale-110 transition-transform">✨</span></button>
            <div className="flex flex-col gap-3 w-full px-3 pb-3">
                <TeActionButton onClick={onSave} color="blue" label="SAVE" icon="☁" />
                <TeActionButton onClick={onExport} color="green" label="ZIP" icon="⬇" />
            </div>
            
            {/* Hidden Inputs */}
            <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={onImageUpload} />
            <input type="file" ref={loadProjectInputRef} className="hidden" accept=".json" onChange={onLoadProject} />
            <input type="file" ref={importZipInputRef} className="hidden" accept=".zip" onChange={onImportZip} />
            <input type="file" ref={globalFontInputRef} className="hidden" accept=".fnt" onChange={onGlobalFontUpload} />
        </div>
    );
};
