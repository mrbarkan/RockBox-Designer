import React, { useMemo } from 'react';
import { ProjectState } from '../types';
import { compileAstScreen, compileWps, compileCfg } from '../services/rockboxCompiler';

interface CodePreviewProps {
  project: ProjectState;
  onClose: () => void;
}

export const CodePreview: React.FC<CodePreviewProps> = ({ project, onClose }) => {
  const wpsCode = useMemo(() => compileAstScreen(project, 'wps') ?? compileWps(project), [project]);
  const cfgCode = useMemo(() => compileCfg(project), [project]);

  return (
    <div className="absolute top-12 right-0 bottom-0 w-96 bg-[#1a1a1a] border-l border-[#333] z-40 shadow-xl flex flex-col font-mono text-sm">
        <div className="h-10 flex items-center justify-between px-4 border-b border-[#333] bg-[#222]">
            <span className="font-bold text-gray-400">Source Code</span>
            <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>
        
        <div className="flex-1 overflow-auto p-4 space-y-6">
            <div>
                <div className="text-xs font-bold text-orange-500 mb-2 uppercase tracking-wide">.WPS (Layout)</div>
                <pre className="text-xs text-gray-300 bg-[#111] p-3 rounded border border-[#333] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {wpsCode}
                </pre>
            </div>

            <div>
                <div className="text-xs font-bold text-blue-500 mb-2 uppercase tracking-wide">.CFG (Config)</div>
                <pre className="text-xs text-gray-300 bg-[#111] p-3 rounded border border-[#333] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {cfgCode}
                </pre>
            </div>
        </div>
        
        <div className="p-4 border-t border-[#333] bg-[#222] text-xs text-gray-500">
            This code is automatically generated and included in the Export ZIP.
        </div>
    </div>
  );
};
