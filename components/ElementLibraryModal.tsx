import React, { useEffect, useMemo, useState } from 'react';
import type { ProjectState, ScreenType } from '../types';
import type { DeviceProfile } from '../rockbox/devices';
import { previewSourceLabel } from '../rockbox/screens';
import {
  getComponentAvailability,
  getRockboxComponent,
  ROCKBOX_COMPONENT_CATALOG,
  type ComponentInsertResult,
  type ComponentRemoveResult,
  type RockboxComponentDefinition
} from '../rockbox/components';

interface ElementLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectState;
  activeScreen: ScreenType;
  deviceProfile: DeviceProfile;
  onInsert: (
    definitionId: string,
    properties: Record<string, string | number>
  ) => Promise<ComponentInsertResult>;
  onRemove: (instanceId: string) => Promise<ComponentRemoveResult>;
}

const categoryLabel = (category: RockboxComponentDefinition['category']) =>
  category.replace('-', ' ');

const validationLabel = (component: RockboxComponentDefinition) =>
  component.validationRules.some(rule => rule.level === 'official') ? 'Official + browser' : 'Browser';

const defaultProperties = (component: RockboxComponentDefinition) =>
  Object.fromEntries(component.editableProperties.map(property => [property.key, property.defaultValue]));

export const ElementLibraryModal: React.FC<ElementLibraryModalProps> = ({
  isOpen,
  onClose,
  project,
  activeScreen,
  deviceProfile,
  onInsert,
  onRemove
}) => {
  const [category, setCategory] = useState<'all' | RockboxComponentDefinition['category']>('all');
  const [selectedId, setSelectedId] = useState(ROCKBOX_COMPONENT_CATALOG[0].id);
  const [propertyValues, setPropertyValues] = useState<Record<string, string | number>>(
    defaultProperties(ROCKBOX_COMPONENT_CATALOG[0])
  );
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const selected = getRockboxComponent(selectedId) ?? ROCKBOX_COMPONENT_CATALOG[0];
  const availability = getComponentAvailability(selected, activeScreen, deviceProfile);
  const categories = useMemo(
    () => Array.from(new Set(ROCKBOX_COMPONENT_CATALOG.map(component => component.category))),
    []
  );
  const visibleComponents = category === 'all'
    ? ROCKBOX_COMPONENT_CATALOG
    : ROCKBOX_COMPONENT_CATALOG.filter(component => component.category === category);

  useEffect(() => {
    setPropertyValues(defaultProperties(selected));
    setMessage('');
  }, [selected.id]);

  if (!isOpen) return null;

  const insert = async () => {
    setBusy(true);
    const result = await onInsert(selected.id, propertyValues);
    setBusy(false);
    setMessage(result.ok
      ? `${selected.name} inserted into ${previewSourceLabel(activeScreen)}. Undo is available.`
      : result.conflicts.join(' '));
  };

  const remove = async (instanceId: string) => {
    setBusy(true);
    const result = await onRemove(instanceId);
    setBusy(false);
    setMessage(result.ok ? 'Component removed. Shared assets were retained where still needed.' : result.conflicts.join(' '));
  };

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-[#e9e7e1] font-mono text-[#161616]">
      <header className="flex h-20 shrink-0 items-center justify-between border-b-2 border-black bg-[#242424] px-7 text-white">
        <div className="flex items-center gap-5">
          <div className="flex h-12 w-12 items-center justify-center border-2 border-white bg-orange-600 text-2xl font-black">⊕</div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#b9bec8]">Rockbox-aware library</div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Components</h2>
          </div>
          <div className="ml-4 border-l border-[#666] pl-5 text-[10px] uppercase text-[#d3d5da]">
            <div>{deviceProfile.model}</div>
            <div className="font-black text-white">{previewSourceLabel(activeScreen)}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="border-2 border-white px-5 py-3 text-xs font-black uppercase hover:bg-white hover:text-black"
        >
          Back to Screens ×
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[210px_minmax(0,1fr)_340px]">
        <aside className="overflow-y-auto border-r-2 border-black bg-[#d7d5cf] p-4">
          <div className="mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-[#5f6670]">Categories</div>
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={`mb-2 w-full border-2 border-black px-3 py-2 text-left text-xs font-black uppercase ${category === 'all' ? 'bg-[#20bd8b]' : 'bg-white hover:bg-[#f7f4ec]'}`}
          >
            All components
          </button>
          {categories.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`mb-2 w-full border border-black px-3 py-2 text-left text-[11px] font-black uppercase ${category === item ? 'bg-orange-600 text-white' : 'bg-[#efede8] hover:bg-white'}`}
            >
              {categoryLabel(item)}
            </button>
          ))}

          <div className="mt-7 border-t-2 border-black pt-4">
            <div className="mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-[#5f6670]">In this project</div>
            {(project.componentInstances ?? []).length === 0 ? (
              <div className="border border-dashed border-[#777] bg-[#efede8] p-3 text-[10px] leading-relaxed text-[#5d6065]">
                Inserted components appear here as exact, reversible instances.
              </div>
            ) : (
              <div className="space-y-2">
                {(project.componentInstances ?? []).map(instance => (
                  <div key={instance.id} className="border border-black bg-white p-2">
                    <div className="truncate text-[10px] font-black uppercase">
                      {getRockboxComponent(instance.definitionId)?.name ?? instance.definitionId}
                    </div>
                    <div className="mb-2 text-[9px] text-[#666]">{instance.screen.toUpperCase()} · {instance.id}</div>
                    <button
                      type="button"
                      onClick={() => remove(instance.id)}
                      className="w-full border border-black bg-[#efede8] px-2 py-1 text-[9px] font-black uppercase hover:bg-red-100"
                    >
                      Remove safely
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 overflow-y-auto p-6">
          <div className="mb-5 flex items-end justify-between border-b-2 border-black pb-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#666]">Source, assets, rules, target support</div>
              <h3 className="text-xl font-black uppercase">{category === 'all' ? 'Complete library' : categoryLabel(category)}</h3>
            </div>
            <div className="border-2 border-black bg-white px-3 py-2 text-[10px] font-black uppercase">
              {visibleComponents.length} definitions
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            {visibleComponents.map(component => {
              const support = getComponentAvailability(component, activeScreen, deviceProfile);
              const active = component.id === selected.id;
              return (
                <button
                  key={component.id}
                  type="button"
                  onClick={() => setSelectedId(component.id)}
                  className={`min-h-64 border-2 p-0 text-left shadow-[4px_4px_0_#161616] transition-transform hover:-translate-y-0.5 ${
                    active ? 'border-orange-600 bg-[#fff8ef]' : 'border-black bg-white'
                  } ${support.available ? '' : 'opacity-60'}`}
                >
                  <div className="flex h-24 items-center justify-center border-b-2 border-black bg-[#292929] px-4 text-center text-lg font-black whitespace-pre-line text-white">
                    {component.preview}
                  </div>
                  <div className="p-4">
                    <div className="mb-1 text-[9px] font-black uppercase tracking-[0.16em] text-orange-700">
                      {categoryLabel(component.category)}
                    </div>
                    <div className="mb-2 text-sm font-black uppercase leading-tight">{component.name}</div>
                    <div className="min-h-10 text-[10px] leading-relaxed text-[#555]">{component.description}</div>
                    <div className="mt-3 flex flex-wrap gap-1 text-[8px] font-black uppercase">
                      <span className="border border-black bg-[#efede8] px-1.5 py-1">{component.sourceComplexity}</span>
                      <span className="border border-black bg-[#efede8] px-1.5 py-1">{component.assets.length} assets</span>
                      <span className={`border border-black px-1.5 py-1 ${support.available ? 'bg-[#20bd8b]' : 'bg-[#ffd0cb]'}`}>
                        {support.available ? 'Available' : 'Restricted'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </main>

        <aside className="overflow-y-auto border-l-2 border-black bg-white p-5">
          <div className="mb-4 border-b-2 border-black pb-4">
            <div className="mb-1 text-[9px] font-black uppercase tracking-[0.2em] text-orange-700">Component details</div>
            <h3 className="text-xl font-black uppercase leading-tight">{selected.name}</h3>
            <p className="mt-2 text-[11px] leading-relaxed text-[#555]">{selected.description}</p>
          </div>

          <div className="space-y-3 text-[10px]">
            <div className="grid grid-cols-[110px_1fr] border-b border-[#bbb] pb-2">
              <span className="font-black uppercase text-[#666]">Screens</span>
              <span className="font-black uppercase">{selected.supportedScreens.join(', ')}</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] border-b border-[#bbb] pb-2">
              <span className="font-black uppercase text-[#666]">Capabilities</span>
              <span>{selected.requiredCapabilities.join(', ') || 'None'}</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] border-b border-[#bbb] pb-2">
              <span className="font-black uppercase text-[#666]">Rockbox tags</span>
              <span>{selected.requiredTags.map(tag => `%${tag}`).join(' ')}</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] border-b border-[#bbb] pb-2">
              <span className="font-black uppercase text-[#666]">Assets</span>
              <span>{selected.assets.map(asset => asset.filename).join(', ') || 'None'}</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] border-b border-[#bbb] pb-2">
              <span className="font-black uppercase text-[#666]">Validation</span>
              <span>{validationLabel(selected)}</span>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-[#666]">Editable properties</div>
            <div className="grid grid-cols-2 gap-2">
              {selected.editableProperties.map(property => (
                <label key={property.key} className="text-[9px] font-black uppercase">
                  <span className="mb-1 block text-[#666]">{property.label}</span>
                  <input
                    type={property.type === 'number' ? 'number' : 'text'}
                    value={propertyValues[property.key] ?? property.defaultValue}
                    onChange={event => setPropertyValues(current => ({
                      ...current,
                      [property.key]: property.type === 'number' ? Number(event.target.value) : event.target.value
                    }))}
                    className="w-full border-2 border-black bg-[#f5f3ee] px-2 py-2 text-xs outline-none focus:border-orange-600"
                  />
                </label>
              ))}
            </div>
          </div>

          {!availability.available ? (
            <div className="mt-5 border-2 border-black bg-[#ffd0cb] p-3 text-[10px] font-bold leading-relaxed">
              {availability.conflicts.join(' ')}
            </div>
          ) : null}
          {message ? (
            <div className="mt-5 border-2 border-black bg-[#d7f6eb] p-3 text-[10px] font-bold leading-relaxed">
              {message}
            </div>
          ) : null}

          <button
            type="button"
            disabled={!availability.available || busy}
            onClick={insert}
            className="mt-5 w-full border-2 border-black bg-orange-600 px-4 py-4 text-sm font-black uppercase text-white shadow-[4px_4px_0_#161616] hover:bg-orange-500 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:bg-[#aaa] disabled:text-[#555]"
          >
            {busy ? 'Preparing source…' : `Insert into ${activeScreen.toUpperCase()}`}
          </button>
          <p className="mt-3 text-[9px] leading-relaxed text-[#666]">
            Insertion is one history step. Existing source remains byte-for-byte intact around the new component.
          </p>
        </aside>
      </div>
    </div>
  );
};
