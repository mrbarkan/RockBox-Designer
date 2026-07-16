import React from 'react';
import type { SimulatorSurface } from '../rockbox/simulator';

type DeviceShellProps = {
  model: string;
  screenWidth: number;
  screenHeight: number;
  surface: SimulatorSurface;
  touchEnabled: boolean;
  onTouch: (x: number, y: number) => void;
  onControl: (control: 'menu' | 'select' | 'previous' | 'next' | 'play-pause') => void;
  children: React.ReactNode;
};

const ShellButton = ({
  label,
  control,
  className = '',
  onControl
}: {
  label: string;
  control: 'menu' | 'select' | 'previous' | 'next' | 'play-pause';
  className?: string;
  onControl: DeviceShellProps['onControl'];
}) => (
  <button
    type="button"
    aria-label={label}
    onClick={() => onControl(control)}
    className={`absolute z-10 font-mono font-black text-[#444] hover:text-black focus:outline-none focus:ring-2 focus:ring-orange-500 ${className}`}
  >
    {label}
  </button>
);

export const DeviceShell: React.FC<DeviceShellProps> = ({
  model,
  screenWidth,
  screenHeight,
  surface,
  touchEnabled,
  onTouch,
  onControl,
  children
}) => {
  const handlePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!touchEnabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onTouch(
      ((event.clientX - rect.left) / rect.width) * screenWidth,
      ((event.clientY - rect.top) / rect.height) * screenHeight
    );
  };

  if (surface === 'remote') {
    return (
      <section aria-label={`${model} remote display shell`} className="border-2 border-black bg-[#d7d7d7] p-5 shadow-[6px_6px_0_#111]">
        <div className="mb-3 flex items-center justify-between font-mono text-[10px] font-black uppercase tracking-widest text-[#444]">
          <span>Remote LCD</span>
          <span>{model}</span>
        </div>
        <div className="border-[8px] border-[#222] bg-black" onPointerDown={handlePointer}>{children}</div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button type="button" onClick={() => onControl('previous')} className="border-2 border-black bg-white p-2 font-bold">PREV</button>
          <button type="button" onClick={() => onControl('play-pause')} className="border-2 border-black bg-white p-2 font-bold">PLAY</button>
          <button type="button" onClick={() => onControl('next')} className="border-2 border-black bg-white p-2 font-bold">NEXT</button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label={`${model} device shell`}
      className="border-2 border-black bg-gradient-to-b from-[#f6f6f6] to-[#cfcfcf] p-5 pb-7 shadow-[8px_8px_0_#111]"
      style={{ width: screenWidth + 44 }}
    >
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] font-black uppercase tracking-widest text-[#555]">
        <span>{model}</span>
        <span>{touchEnabled ? 'TOUCH' : 'BUTTONS'}</span>
      </div>
      <div
        className={`border-[8px] border-[#202020] bg-black ${touchEnabled ? 'cursor-crosshair' : ''}`}
        style={{ width: screenWidth + 16, height: screenHeight + 16 }}
        onPointerDown={handlePointer}
      >
        {children}
      </div>
      <div className="relative mx-auto mt-5 h-44 w-44 rounded-full border-2 border-[#bbb] bg-[#fafafa] shadow-[inset_0_2px_8px_rgba(0,0,0,0.15)]">
        <ShellButton label="MENU" control="menu" onControl={onControl} className="left-1/2 top-3 -translate-x-1/2 text-[11px]" />
        <ShellButton label="|◀◀" control="previous" onControl={onControl} className="left-3 top-1/2 -translate-y-1/2 text-sm" />
        <ShellButton label="▶▶|" control="next" onControl={onControl} className="right-3 top-1/2 -translate-y-1/2 text-sm" />
        <ShellButton label="▶Ⅱ" control="play-pause" onControl={onControl} className="bottom-3 left-1/2 -translate-x-1/2 text-sm" />
        <button
          type="button"
          aria-label="Select"
          onClick={() => onControl('select')}
          className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#ddd] bg-[#e8e8e8] shadow-inner focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>
    </section>
  );
};
