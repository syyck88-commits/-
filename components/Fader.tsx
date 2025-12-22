
import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { MAX_DMX_VALUE } from '../constants';
import { AudioReactiveConfig } from '../types';

interface FaderProps {
  label: string;
  channel: number;
  value: number;
  color?: string;
  isMuted: boolean;
  audioConfig: AudioReactiveConfig;
  onChange: (value: number) => void;
  onMuteToggle: () => void;
  onAudioConfigChange: (config: AudioReactiveConfig) => void;
  onCopy: (config: AudioReactiveConfig) => void;
  onPaste: () => AudioReactiveConfig | null;
}

const Fader: React.FC<FaderProps> = ({ 
  label, 
  channel,
  value, 
  color = 'bg-blue-500', 
  isMuted,
  audioConfig,
  onChange,
  onMuteToggle,
  onAudioConfigChange,
  onCopy,
  onPaste
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 }); 
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const syncBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const [lineCoords, setLineCoords] = useState({ startX: 0, startY: 0, endX: 0, endY: 0 });

  const percentage = (value / MAX_DMX_VALUE) * 100;

  // Re-calculate the line path relative to the scrolling container
  useEffect(() => {
    if (!showSettings) return;
    const updateLine = () => {
      if (syncBtnRef.current && menuRef.current) {
        const btnRect = syncBtnRef.current.getBoundingClientRect();
        const menuRect = menuRef.current.getBoundingClientRect();
        const main = document.querySelector('main');
        if (!main) return;
        const mainRect = main.getBoundingClientRect();

        // Calculate coordinates relative to the main container's content area
        // We add main.scrollTop because the portal is inside the scrollable container
        setLineCoords({
          startX: btnRect.left - mainRect.left + main.scrollLeft + btnRect.width / 2,
          startY: btnRect.top - mainRect.top + main.scrollTop + btnRect.height / 2,
          endX: menuRect.left - mainRect.left + main.scrollLeft + 15,
          endY: menuRect.top - mainRect.top + main.scrollTop + 35
        });
      }
    };
    updateLine();
    const interval = setInterval(updateLine, 30);
    return () => clearInterval(interval);
  }, [showSettings, position]);

  useEffect(() => {
    if (showSettings && syncBtnRef.current) {
      const main = document.querySelector('main');
      if (!main) return;
      const rect = syncBtnRef.current.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      
      setPosition({ 
        x: rect.left - mainRect.left + main.scrollLeft + 160, 
        y: rect.top - mainRect.top + main.scrollTop - 100 
      });
    }
  }, [showSettings]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const { glowColor, barColor, accentColor, bgClass } = useMemo(() => {
    const c = color.toLowerCase();
    const l = label.toLowerCase();
    if (c.includes('red') || l.includes('red') || l.includes('r-')) 
        return { glowColor: 'rgba(239, 68, 68, 0.7)', barColor: '#ef4444', accentColor: 'text-red-400', bgClass: 'bg-red-500/10 border-red-500/30' };
    if (c.includes('green') || c.includes('emerald') || l.includes('grn') || l.includes('g-')) 
        return { glowColor: 'rgba(16, 185, 129, 0.7)', barColor: '#10b981', accentColor: 'text-emerald-400', bgClass: 'bg-emerald-500/10 border-emerald-500/30' };
    if (c.includes('blue') || l.includes('blu') || l.includes('b-')) 
        return { glowColor: 'rgba(59, 130, 246, 0.7)', barColor: '#3b82f6', accentColor: 'text-blue-400', bgClass: 'bg-blue-500/10 border-blue-500/30' };
    if (c.includes('white') || l.includes('w-') || l === 'wht' || l === 'white') 
        return { glowColor: 'rgba(255, 255, 255, 0.5)', barColor: '#f4f4f5', accentColor: 'text-zinc-100', bgClass: 'bg-zinc-100/10 border-zinc-100/30' };
    return { glowColor: 'rgba(16, 185, 129, 0.5)', barColor: '#10b981', accentColor: 'text-emerald-400', bgClass: 'bg-zinc-800/40 border-zinc-700/50' };
  }, [color, label]);

  const portalRoot = document.getElementById('portal-root');

  return (
    <div className="flex flex-col items-center min-w-[75px] relative">
      {showSettings && portalRoot && ReactDOM.createPortal(
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          {/* Fader to Menu Line */}
          <svg className="absolute inset-0 w-full h-full overflow-visible">
            <defs>
              <filter id="lineGlowFader">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <path 
              d={`M ${lineCoords.startX} ${lineCoords.startY} C ${lineCoords.startX + 100} ${lineCoords.startY}, ${lineCoords.endX - 100} ${lineCoords.endY}, ${lineCoords.endX} ${lineCoords.endY}`}
              fill="none" stroke="rgba(16, 185, 129, 0.6)" strokeWidth="3" strokeDasharray="8 4"
              filter="url(#lineGlowFader)" className="animate-[dash_2s_linear_infinite]"
            />
            <circle cx={lineCoords.startX} cy={lineCoords.startY} r="6" fill="#10b981" />
            <circle cx={lineCoords.endX} cy={lineCoords.endY} r="5" fill="#10b981" />
          </svg>

          {/* DSP Engine Settings */}
          <div 
            ref={menuRef}
            className="absolute pointer-events-auto z-[9999] w-72 bg-zinc-900 border border-emerald-500/40 shadow-[0_50px_150px_rgba(0,0,0,1)] rounded-[2.5rem] p-6 backdrop-blur-3xl"
            style={{ left: position.x, top: position.y }}
          >
            <div onMouseDown={handleMouseDown} className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-3 cursor-move active:cursor-grabbing select-none">
              <div className="flex flex-col">
                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">DSP ENGINE</div>
                <div className="text-[8px] text-zinc-600 font-bold uppercase">{label} CONTROL</div>
              </div>
              <button onClick={() => setShowSettings(false)} className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">✕</button>
            </div>
            
            <div className="space-y-6">
               <div className="flex gap-2">
                 <button onClick={() => onCopy(audioConfig)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl text-[9px] font-black transition-all uppercase">Copy</button>
                 <button onClick={() => { const p = onPaste(); if(p) onAudioConfigChange({...p, enabled: audioConfig.enabled}); }} className="flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-xl text-[9px] font-black transition-all uppercase">Paste</button>
               </div>
               
               <div className="flex items-center justify-between px-1">
                 <label className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Auto Gain/Gate</label>
                 <button 
                  onClick={() => onAudioConfigChange({...audioConfig, autoMode: !audioConfig.autoMode})}
                  className={`px-4 py-1.5 rounded-full text-[9px] font-black transition-all ${audioConfig.autoMode ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}
                 >
                  {audioConfig.autoMode ? 'AUTO ON' : 'MANUAL'}
                 </button>
               </div>

               <div>
                 <label className="text-[9px] text-zinc-500 uppercase font-black mb-2 block tracking-widest">Frequency Band</label>
                 <div className="flex gap-1">
                   {(['low', 'mid', 'high'] as const).map(f => (
                     <button key={f} onClick={() => onAudioConfigChange({...audioConfig, frequency: f})} className={`flex-1 py-2.5 text-[9px] rounded-xl uppercase font-black transition-all ${audioConfig.frequency === f ? 'bg-emerald-500 text-white shadow-lg' : 'bg-zinc-800 text-zinc-500'}`}>{f}</button>
                   ))}
                 </div>
               </div>
               <div className={`space-y-4 transition-all duration-300 ${audioConfig.autoMode ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                 <div className="space-y-1">
                   <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-zinc-500"><span>Gate</span><span className="text-emerald-400">{audioConfig.threshold}</span></div>
                   <input type="range" min="0" max="255" value={audioConfig.threshold} onChange={e => onAudioConfigChange({...audioConfig, threshold: parseInt(e.target.value)})} className="w-full h-1 bg-zinc-800 rounded-full appearance-none accent-emerald-500 cursor-pointer" />
                 </div>
                 <div className="space-y-1">
                   <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-zinc-500"><span>Gain</span><span className="text-emerald-400">{audioConfig.sensitivity.toFixed(1)}x</span></div>
                   <input type="range" min="0.1" max="5" step="0.1" value={audioConfig.sensitivity} onChange={e => onAudioConfigChange({...audioConfig, sensitivity: parseFloat(e.target.value)})} className="w-full h-1 bg-zinc-800 rounded-full appearance-none accent-emerald-500 cursor-pointer" />
                 </div>
               </div>
               <div className="space-y-1">
                 <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-zinc-500"><span>Decay</span><span className="text-emerald-400">{Math.round(audioConfig.decay * 100)}%</span></div>
                 <input type="range" min="0" max="0.99" step="0.01" value={audioConfig.decay} onChange={e => onAudioConfigChange({...audioConfig, decay: parseFloat(e.target.value)})} className="w-full h-1 bg-zinc-800 rounded-full appearance-none accent-emerald-500 cursor-pointer" />
               </div>
            </div>
          </div>
        </div>
      , portalRoot)}
      
      <div className={`h-48 w-14 relative flex items-center justify-center mb-3 group`}>
        <div className={`absolute inset-0 rounded-2xl border-2 transition-all overflow-hidden ${isMuted ? 'bg-red-500/10 border-red-500/40' : audioConfig.enabled ? 'bg-emerald-500/5 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : bgClass}`}>
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundColor: barColor }} />
          <div 
            className="absolute bottom-0 left-0 right-0 transition-all duration-75 pointer-events-none"
            style={{ 
                height: `${percentage}%`,
                backgroundColor: isMuted ? '#b91c1c' : barColor,
                boxShadow: isMuted ? 'none' : `0 0 35px ${glowColor}`,
                opacity: isMuted ? 1 : 0.95
            }}
          />
          {audioConfig.enabled && <div className="absolute inset-0 bg-emerald-500/5 animate-pulse pointer-events-none" />}
        </div>
        <input
          type="range" min="0" max={MAX_DMX_VALUE} value={value} disabled={audioConfig.enabled}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="absolute appearance-none w-48 h-14 bg-transparent cursor-pointer rotate-[-90deg] z-10 focus:outline-none disabled:cursor-not-allowed"
          style={{ WebkitAppearance: 'none' }}
        />
      </div>

      <div className="flex gap-1.5 mb-2 w-full px-1 items-center">
        <button onClick={onMuteToggle} className={`flex-1 py-1.5 rounded-lg text-[8px] font-black transition-all ${isMuted ? 'bg-red-500 text-white shadow-lg' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}>MUTE</button>
        <button 
          ref={syncBtnRef}
          onClick={() => onAudioConfigChange({...audioConfig, enabled: !audioConfig.enabled})}
          onContextMenu={(e) => { e.preventDefault(); setShowSettings(!showSettings); }}
          className={`flex-1 py-1.5 rounded-lg text-[8px] font-black transition-all ${audioConfig.enabled ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}
        >
          SYNC
        </button>
      </div>

      <div className="text-center select-none">
        <div className={`text-[12px] font-mono font-bold mb-0.5 ${isMuted ? 'text-red-400' : audioConfig.enabled ? 'text-emerald-400' : accentColor}`}>
          {isMuted ? 'OFF' : value}
        </div>
        <div className={`text-[9px] uppercase font-black tracking-tighter truncate max-w-[65px] ${audioConfig.enabled ? 'text-emerald-500' : 'text-zinc-500'}`}>
          {label}
        </div>
      </div>

      <style>{`
        @keyframes dash { to { stroke-dashoffset: -20; } }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 22px; width: 40px;
          background: #fff; border-radius: 4px;
          cursor: ns-resize; box-shadow: 0 0 30px rgba(0,0,0,0.9);
          border: 1px solid rgba(255,255,255,0.8);
        }
        input[type=range]:disabled::-webkit-slider-thumb { background: #3f3f46; border-color: #27272a; box-shadow: none; }
      `}</style>
    </div>
  );
};

export default Fader;
