import React from 'react';
import {
  getSimulatorScenario,
  type ActiveSimulatorScenario,
  type SimulatorScenarioId
} from '../rockbox/simulator';

type ScenarioStripProps = {
  activeScenario: ActiveSimulatorScenario;
  onApplyScenario: (scenario: SimulatorScenarioId) => void;
  onOpenPlay: () => void;
  onOpenComponents: () => void;
};

const quickScenarios: SimulatorScenarioId[] = [
  'normal-playback',
  'paused-low-battery',
  'charging-over-usb',
  'hold-active'
];

export const ScenarioStrip: React.FC<ScenarioStripProps> = ({
  activeScenario,
  onApplyScenario,
  onOpenPlay,
  onOpenComponents
}) => (
  <div className="flex h-16 shrink-0 items-center gap-3 border-t-2 border-black bg-[#ececec] px-4 font-mono">
    <div className="min-w-40 border-r border-[#aaa] pr-4">
      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#666]">Preview state</div>
      <div className="truncate text-xs font-black uppercase">
        {activeScenario === 'custom' ? 'Custom state' : getSimulatorScenario(activeScenario).name}
      </div>
    </div>
    <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
      {quickScenarios.map(id => (
        <button
          key={id}
          type="button"
          onClick={() => onApplyScenario(id)}
          className={`whitespace-nowrap border-2 border-black px-3 py-2 text-[10px] font-black uppercase ${
            activeScenario === id ? 'bg-orange-600 text-white' : 'bg-white hover:bg-[#fff4e8]'
          }`}
        >
          {getSimulatorScenario(id).name}
        </button>
      ))}
    </div>
    <button
      type="button"
      onClick={onOpenComponents}
      className="border-2 border-black bg-white px-4 py-2 text-xs font-black uppercase shadow-[3px_3px_0_#111] hover:bg-[#fff4e8] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
    >
      ⊕ Components
    </button>
    <button
      type="button"
      onClick={onOpenPlay}
      className="border-2 border-black bg-[#20bd8b] px-5 py-2 text-xs font-black uppercase text-black shadow-[3px_3px_0_#111] hover:bg-[#35d8a5] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
    >
      ▶ Open Play
    </button>
  </div>
);
