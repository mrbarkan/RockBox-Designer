
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ProjectState } from '../types';
import { compileAstScreen, compileWps, compileCfg, compileSbs, compileFms } from '../services/rockboxCompiler';
import { parseRockbox } from '../rockbox/syntax';

interface SourceEditorProps {
  project: ProjectState;
  onClose: () => void;
  onApplyChanges: (screen: 'wps' | 'sbs' | 'fms' | 'cfg', content: string) => void;
  initialFocus?: { tab: 'wps' | 'sbs' | 'fms' | 'cfg'; start: number; end: number };
}

export const SourceEditor: React.FC<SourceEditorProps> = ({ project, onClose, onApplyChanges, initialFocus }) => {
  const [activeTab, setActiveTab] = useState<'wps' | 'sbs' | 'fms' | 'cfg'>(initialFocus?.tab ?? 'wps');
  const [content, setContent] = useState('');
  const [applied, setApplied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const focusApplied = useRef(false);

  const sourceForTab = (tab: typeof activeTab) => {
    if (tab === 'cfg') return compileCfg(project);
    const authoritative = compileAstScreen(project, tab);
    if (authoritative !== null) return authoritative;
    if (tab === 'wps') return compileWps(project);
    if (tab === 'sbs') return compileSbs(project);
    return compileFms(project);
  };

  // Load initial content on open or tab change
  useEffect(() => {
    setContent(sourceForTab(activeTab));
    setApplied(false);
  }, [activeTab, project]);

  useEffect(() => {
    if (focusApplied.current || !initialFocus || initialFocus.tab !== activeTab || content.length === 0) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = Math.max(0, Math.min(content.length, initialFocus.start));
    const end = Math.max(start, Math.min(content.length, initialFocus.end));
    textarea.focus();
    textarea.setSelectionRange(start, end);
    focusApplied.current = true;
  }, [activeTab, content, initialFocus]);

  const diagnostics = useMemo(
    () => activeTab === 'cfg' ? [] : parseRockbox(content).diagnostics,
    [activeTab, content]
  );
  const errors = diagnostics.filter(diagnostic => diagnostic.severity === 'error');

  const handleApply = () => {
      onApplyChanges(activeTab, content);
      setApplied(true);
  };

  return (
    <div className="absolute top-14 right-0 bottom-0 w-[600px] bg-[#1a1a1a] border-l border-black z-40 shadow-xl flex flex-col font-mono text-sm animate-slide-in-right">
        {/* Tabs */}
        <div className="flex bg-[#222] border-b border-black">
            {['wps', 'sbs', 'fms', 'cfg'].map(tab => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`flex-1 py-3 text-xs font-bold uppercase border-r border-black hover:bg-[#333] transition-colors ${activeTab === tab ? 'bg-[#333] text-orange-500 border-b-2 border-b-orange-500' : 'text-gray-500'}`}
                >
                    .{tab}
                </button>
            ))}
            <button onClick={onClose} className="px-5 text-gray-500 hover:text-white bg-red-900/20 border-l border-black text-lg">×</button>
        </div>

        {/* Toolbar */}
        <div className="bg-[#111] p-3 flex justify-between items-center border-b border-black">
             <div>
                <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Two-way source</span>
                <span className={`ml-3 border px-2 py-1 text-[9px] font-bold ${activeTab === 'cfg' ? 'border-gray-600 text-gray-500' : errors.length ? 'border-amber-500 text-amber-400' : 'border-emerald-700 text-emerald-400'}`}>
                    {activeTab === 'cfg' ? 'READ ONLY' : errors.length ? `${errors.length} ERROR${errors.length === 1 ? '' : 'S'} · PREVIEW WILL STALE` : 'PREVIEW READY'}
                </span>
             </div>
             <div className="flex gap-3">
                 <button className="px-3 py-1.5 bg-[#333] text-gray-300 text-xs border border-black hover:bg-[#444]" onClick={() => setContent(sourceForTab(activeTab))}>Reset</button>
                 <button onClick={handleApply} disabled={activeTab === 'cfg'} className="px-4 py-1.5 bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-bold uppercase border border-black shadow-[2px_2px_0px_black] active:translate-y-[1px] active:shadow-none transition-all">
                     Apply Changes
                 </button>
             </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 relative">
            <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => { setContent(e.target.value); setApplied(false); }}
                className="w-full h-full bg-[#0a0a0a] text-[#d4d4d4] p-6 outline-none resize-none font-mono text-sm leading-relaxed"
                spellCheck={false}
            />
            {diagnostics.length > 0 && (
                <div className="absolute bottom-4 left-4 right-4 max-h-36 overflow-y-auto bg-[#1c0808]/95 text-white p-3 border border-red-600 text-xs shadow-lg">
                    {diagnostics.slice(0, 8).map(diagnostic => (
                      <div key={`${diagnostic.code}:${diagnostic.span.start}`} className="mb-1 font-mono text-[10px]">
                        <span className="text-red-400">L{diagnostic.span.startLine}:{diagnostic.span.startColumn}</span> {diagnostic.message}
                      </div>
                    ))}
                </div>
            )}
        </div>
        
        {/* Status */}
        <div className="h-8 bg-[#222] border-t border-black flex items-center px-4 text-xs text-gray-500 justify-between">
             <span>Ln {content.split('\n').length}, Col 1 · {diagnostics.length} diagnostic{diagnostics.length === 1 ? '' : 's'}</span>
             <span>{applied ? 'APPLIED · ' : ''}UTF-8 · LOSSLESS</span>
        </div>
    </div>
  );
};
