import React, { useMemo, useState } from 'react';
import { ProjectState } from '../types';

interface FileBrowserProps {
    project: ProjectState;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({ project }) => {
    const [selectedPath, setSelectedPath] = useState<string | null>(null);

    // Build directory tree from assets
    const tree = useMemo(() => {
        const root: any = { name: 'root', type: 'folder', children: {} };
        
        Object.keys(project.assets).forEach(path => {
            // Only use paths with '/' to avoid duplicates from the "filename only" keys we added in parser
            if (path.includes('/')) {
                const parts = path.split('/');
                let current = root;
                
                parts.forEach((part, index) => {
                    if (index === parts.length - 1) {
                        // File
                        current.children[part] = { name: part, type: 'file', path: path };
                    } else {
                        // Folder
                        if (!current.children[part]) {
                            current.children[part] = { name: part, type: 'folder', children: {} };
                        }
                        current = current.children[part];
                    }
                });
            }
        });
        return root;
    }, [project.assets]);

    const renderTree = (node: any, depth = 0) => {
        const children = Object.values(node.children || {}).sort((a: any, b: any) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });

        return (
            <div className="pl-2">
                {children.map((child: any) => (
                    <div key={child.name}>
                        {child.type === 'folder' ? (
                            <details open className="group">
                                <summary className="cursor-pointer text-gray-700 hover:bg-gray-200 px-1 rounded flex items-center gap-1">
                                    <span className="text-[10px] opacity-50">📁</span>
                                    <span className="font-bold">{child.name}</span>
                                </summary>
                                <div className="border-l border-gray-300 ml-1">
                                    {renderTree(child, depth + 1)}
                                </div>
                            </details>
                        ) : (
                            <div 
                                onClick={() => setSelectedPath(child.path)}
                                className={`cursor-pointer px-1 rounded flex items-center gap-1 text-[10px] font-mono truncate
                                    ${selectedPath === child.path ? 'bg-orange-600 text-white' : 'text-gray-600 hover:bg-white'}
                                `}
                            >
                                <span className="opacity-70">{child.name.endsWith('.bmp') ? '🖼️' : child.name.endsWith('.fnt') ? 'Aa' : '📄'}</span>
                                {child.name}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const selectedAsset = selectedPath ? project.assets[selectedPath] : null;

    return (
        <div className="flex flex-col h-full bg-[#e0e0e0]">
            {/* File Tree */}
            <div className="flex-1 overflow-auto p-2">
                {renderTree(tree)}
            </div>
            
            {/* Preview Pane */}
            <div className="h-1/3 border-t border-black bg-[#d4d4d4] flex flex-col">
                <div className="h-6 bg-gray-300 border-b border-gray-400 px-2 flex items-center text-[9px] font-bold uppercase text-gray-600">
                    Preview
                </div>
                <div className="flex-1 flex items-center justify-center p-2 overflow-hidden bg-gray-100 pattern-checkered">
                    {selectedAsset ? (
                        selectedPath?.toLowerCase().endsWith('.bmp') || selectedPath?.toLowerCase().endsWith('.png') ? (
                             <img src={selectedAsset} alt="Preview" className="max-w-full max-h-full object-contain border border-gray-300 shadow-sm" />
                        ) : selectedPath?.toLowerCase().endsWith('.fnt') ? (
                             <div className="text-center">
                                <div className="text-2xl font-bold mb-2">Aa</div>
                                <div className="text-[10px] font-mono text-gray-500">{selectedPath}</div>
                             </div>
                        ) : (
                            <div className="text-[9px] font-mono text-gray-500 p-2 break-all">
                                {selectedAsset.substring(0, 100)}...
                            </div>
                        )
                    ) : (
                        <div className="text-gray-400 text-[10px]">No Selection</div>
                    )}
                </div>
            </div>
        </div>
    );
};
