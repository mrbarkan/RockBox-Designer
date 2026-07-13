import React, { memo } from 'react';
import type { BranchOverrides, SemanticLayer, SemanticResult } from '../rockbox/semantics';

type Props = {
  result: SemanticResult;
  selectedNodeId?: string;
  branchOverrides: BranchOverrides;
  onSelectNode: (nodeId: string) => void;
  onSetBranchOverride: (nodeId: string, branch: number | null) => void;
  onUpdateArguments: (nodeId: string, updates: Record<string, string>) => void;
  onUpdateText: (nodeId: string, value: string) => void;
};

const badgeStyle: Record<SemanticLayer['kind'], string> = {
  global: 'bg-sky-100 text-sky-800 border-sky-300',
  viewport: 'bg-amber-100 text-amber-800 border-amber-300',
  element: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  conditional: 'bg-violet-100 text-violet-800 border-violet-300',
  branch: 'bg-violet-50 text-violet-600 border-violet-200',
  'source-only': 'bg-gray-100 text-gray-600 border-gray-300',
  unsupported: 'bg-red-100 text-red-700 border-red-300'
};

const safeInputType = (input: 'number' | 'text' | 'color' | 'readonly', value: string) => {
  if (input === 'color' && /^#?[0-9a-f]{6}$/i.test(value)) return 'color';
  if (input === 'number' && /^-?\d+$/.test(value)) return 'number';
  return 'text';
};

const LayerRow = memo(({ layer, selected, onSelect }: {
  layer: SemanticLayer;
  selected: boolean;
  onSelect: () => void;
}) => (
  <button
    onClick={onSelect}
    className={`w-full min-h-9 border text-left font-mono text-[10px] flex items-center gap-2 pr-2 transition-colors ${
      selected ? 'bg-orange-600 text-white border-black shadow-[2px_2px_0_black]' :
      layer.active ? 'bg-white/80 text-gray-700 border-gray-300 hover:border-orange-500' : 'bg-gray-200/60 text-gray-400 border-gray-300'
    }`}
    style={{ paddingLeft: 8 + layer.depth * 12, contentVisibility: 'auto' }}
  >
    <span className={`shrink-0 border px-1 py-0.5 uppercase ${selected ? 'border-white/50' : badgeStyle[layer.kind]}`}>
      {layer.kind === 'conditional' ? 'IF' : layer.kind === 'branch' ? 'BR' : layer.kind.slice(0, 3)}
    </span>
    <span className="truncate uppercase">{layer.label}</span>
    {layer.kind === 'unsupported' ? <span className="ml-auto text-red-500">!</span> : null}
  </button>
));
LayerRow.displayName = 'LayerRow';

export const SemanticWorkspacePanel: React.FC<Props> = ({
  result,
  selectedNodeId,
  branchOverrides,
  onSelectNode,
  onSetBranchOverride,
  onUpdateArguments,
  onUpdateText
}) => {
  const selected = result.layers.find(layer => layer.sourceNodeId === selectedNodeId);
  const errors = result.diagnostics.filter(diagnostic => diagnostic.severity === 'error');
  const unsupported = result.layers.filter(layer => layer.kind === 'unsupported').length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-black bg-[#ececec] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Source-linked {result.screen.toUpperCase()}</div>
            <div className="mt-1 text-xs font-bold uppercase text-gray-800">
              {result.stale ? 'Stale preview' : 'Preview synchronized'}
            </div>
          </div>
          <div className={`border border-black px-2 py-1 font-mono text-[10px] font-bold ${result.stale ? 'bg-amber-400 text-black' : 'bg-emerald-500 text-black'}`}>
            {errors.length} ERR · {unsupported} RAW
          </div>
        </div>
        {errors.slice(0, 3).map(diagnostic => (
          <div key={`${diagnostic.code}:${diagnostic.span.start}`} className="mt-2 border-l-2 border-red-600 pl-2 font-mono text-[10px] text-red-700">
            L{diagnostic.span.startLine}:{diagnostic.span.startColumn} {diagnostic.message}
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-1.5">
        {result.layers.map(layer => (
          <LayerRow
            key={layer.id}
            layer={layer}
            selected={layer.sourceNodeId === selectedNodeId}
            onSelect={() => onSelectNode(layer.sourceNodeId)}
          />
        ))}
      </div>

      <div className="max-h-[44%] overflow-y-auto border-t border-black bg-[#dedede] p-4">
        {!selected ? (
          <div className="font-mono text-[10px] uppercase text-gray-500">Select a source-linked layer to inspect it.</div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-gray-400 pb-3">
              <div>
                <div className="font-mono text-[10px] uppercase text-gray-500">{selected.kind}</div>
                <div className="text-xs font-bold uppercase text-gray-900">{selected.label}</div>
              </div>
              <span className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase ${badgeStyle[selected.kind]}`}>
                {selected.supported ? 'editable subset' : 'preserved raw'}
              </span>
            </div>

            {selected.kind === 'conditional' && selected.branchCount ? (
              <div className="mt-3">
                <label className="font-mono text-[9px] font-bold uppercase text-gray-600">Preview branch</label>
                <div className="mt-1 flex flex-wrap gap-1">
                  <button
                    onClick={() => onSetBranchOverride(selected.sourceNodeId, null)}
                    className={`border border-black px-2 py-1 font-mono text-[9px] ${branchOverrides[selected.sourceNodeId] === undefined ? 'bg-black text-white' : 'bg-white text-black'}`}
                  >AUTO</button>
                  {Array.from({ length: selected.branchCount }, (_, index) => (
                    <button
                      key={index}
                      onClick={() => onSetBranchOverride(selected.sourceNodeId, index)}
                      className={`border border-black px-2 py-1 font-mono text-[9px] ${selected.selectedBranch === index ? 'bg-orange-600 text-white' : 'bg-white text-black'}`}
                    >{index + 1}</button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-3 grid grid-cols-2 gap-2">
              {selected.properties.map(property => (
                <label key={property.key} className={property.input === 'text' ? 'col-span-2' : ''}>
                  <span className="block font-mono text-[9px] font-bold uppercase text-gray-600">{property.label}</span>
                  {property.key === 'value' ? (
                    <textarea
                      key={`${selected.sourceNodeId}:${property.key}:${property.value}`}
                      defaultValue={property.value}
                      onBlur={event => {
                        if (event.currentTarget.value !== property.value) onUpdateText(selected.sourceNodeId, event.currentTarget.value);
                      }}
                      className="mt-1 h-16 w-full resize-none border border-gray-500 bg-white p-2 font-mono text-[10px] text-black outline-none focus:border-orange-600"
                    />
                  ) : (
                    <input
                      key={`${selected.sourceNodeId}:${property.key}:${property.value}`}
                      type={safeInputType(property.input, property.value)}
                      defaultValue={safeInputType(property.input, property.value) === 'color' ? `#${property.value.replace(/^#/, '')}` : property.value}
                      readOnly={property.input === 'readonly'}
                      onBlur={event => {
                        const value = event.currentTarget.type === 'color' ? event.currentTarget.value.replace('#', '') : event.currentTarget.value;
                        if (value !== property.value) onUpdateArguments(selected.sourceNodeId, { [property.key]: value });
                      }}
                      className="mt-1 h-8 w-full border border-gray-500 bg-white px-2 font-mono text-[10px] text-black outline-none focus:border-orange-600"
                    />
                  )}
                </label>
              ))}
            </div>
            {selected.properties.length === 0 && selected.kind !== 'conditional' ? (
              <div className="mt-3 font-mono text-[10px] text-gray-500">
                This node stays in source but has no safe property control yet.
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};
