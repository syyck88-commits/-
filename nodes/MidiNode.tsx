
import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { MidiLearnEvent } from '../types';

// Extend window to access global midi manager from App.tsx
declare global {
  interface Window {
    luminaMidi?: {
      setLearnMode: (cb: ((e: MidiLearnEvent) => void) | null) => void;
      isReady: boolean;
      init: () => Promise<boolean>;
      getDevices: () => { id: string, name: string }[];
    };
  }
}

export const MidiNode = ({ data, id }: any) => {
  const [isLearning, setIsLearning] = useState(false);
  const [lastVal, setLastVal] = useState(0);
  const [devices, setDevices] = useState<{ id: string, name: string }[]>([]);

  // Default params if new
  const params = {
    channel: 1,
    type: 'cc',
    index: 1,
    mode: 'momentary',
    deviceId: 'ALL',
    deviceName: 'All Devices (Omni)', // Track name for better restoration
    ...data.params
  };

  useEffect(() => {
    // Poll for visualization only (App.tsx handles logic)
    const interval = setInterval(() => {
      if (data.values && data.values[0] !== undefined) {
        setLastVal(data.values[0]);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [data.values]);

  useEffect(() => {
    const fetchDevices = () => {
        if (window.luminaMidi?.isReady) {
            const currentDevices = window.luminaMidi.getDevices();
            setDevices(currentDevices);

            // AUTO-RECOVERY LOGIC
            // If the saved deviceId is not in the current list, but we find a name match, update the ID.
            if (params.deviceId !== 'ALL' && params.deviceName) {
               const idExists = currentDevices.some(d => d.id === params.deviceId);
               if (!idExists) {
                  const match = currentDevices.find(d => d.name === params.deviceName);
                  if (match) {
                     console.log(`MIDI: Auto-recovered device ${match.name} (Old ID: ${params.deviceId} -> New ID: ${match.id})`);
                     data.onParamChange(id, 'deviceId', match.id);
                  }
               }
            }
        }
    };
    
    // Initial fetch
    fetchDevices();
    
    // Retry shortly after in case init happened late (common during load)
    const t = setTimeout(fetchDevices, 1000);
    return () => clearTimeout(t);
  }, []); // Run on mount to recover settings

  useEffect(() => {
    if (isLearning && window.luminaMidi) {
      window.luminaMidi.setLearnMode((e) => {
        // Auto-update params
        data.onParamChange(id, 'channel', e.channel);
        data.onParamChange(id, 'type', e.type);
        data.onParamChange(id, 'index', e.index);
        
        // Find name for the new device ID
        const devs = window.luminaMidi?.getDevices() || [];
        const devName = devs.find(d => d.id === e.deviceId)?.name || 'Unknown Device';
        
        // Update both ID and Name
        data.onParamChange(id, 'deviceId', e.deviceId);
        data.onParamChange(id, 'deviceName', devName);
        
        setIsLearning(false);
      });
    } else if (window.luminaMidi) {
      window.luminaMidi.setLearnMode(null);
    }
    
    return () => {
      if (window.luminaMidi) window.luminaMidi.setLearnMode(null);
    };
  }, [isLearning, id, data]);

  const toggleLearn = async () => {
    if (!window.luminaMidi?.isReady) {
       const success = await window.luminaMidi?.init();
       if (!success) return;
    }
    setDevices(window.luminaMidi!.getDevices()); // Refresh devices on interaction
    setIsLearning(!isLearning);
  };

  const handleDeviceChange = (newId: string) => {
     const name = devices.find(d => d.id === newId)?.name || (newId === 'ALL' ? 'All Devices (Omni)' : 'Unknown');
     data.onParamChange(id, 'deviceId', newId);
     data.onParamChange(id, 'deviceName', name);
  };

  // Check if current device is missing
  const isDeviceMissing = params.deviceId !== 'ALL' && !devices.some(d => d.id === params.deviceId);

  return (
    <div className={`bg-zinc-900 border-2 rounded-2xl p-4 w-56 shadow-2xl transition-colors ${isLearning ? 'border-amber-500 animate-pulse' : 'border-zinc-800'}`}>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${window.luminaMidi?.isReady ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-zinc-700'}`} />
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">MIDI INPUT</span>
        </div>
        <button 
          onClick={toggleLearn}
          className={`px-3 py-1 rounded text-[8px] font-black uppercase transition-all ${isLearning ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}
        >
          {isLearning ? 'LEARNING...' : 'LEARN'}
        </button>
      </div>

      <div className="space-y-3 mb-4">
        {/* Device Selector */}
        <div className="space-y-1">
            <div className="flex justify-between">
                <label className="text-[7px] font-bold text-zinc-600 uppercase">Input Device</label>
                {isDeviceMissing && <span className="text-[7px] font-bold text-red-500 uppercase animate-pulse">DISCONNECTED</span>}
            </div>
            <select
                value={params.deviceId}
                onChange={e => handleDeviceChange(e.target.value)}
                className={`w-full bg-zinc-800 text-[9px] font-bold p-1.5 rounded border outline-none truncate ${isDeviceMissing ? 'border-red-500 text-red-400' : 'border-zinc-700 text-emerald-400 focus:border-emerald-500'}`}
            >
                <option value="ALL">All Devices (Omni)</option>
                {devices.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                ))}
                {isDeviceMissing && (
                    <option value={params.deviceId} disabled>{params.deviceName} (Missing)</option>
                )}
            </select>
        </div>

        <div className="flex gap-2">
            <div className="flex-1 space-y-1">
                <label className="text-[7px] font-bold text-zinc-600 uppercase">CH (0=Omni)</label>
                <input 
                    type="number" min="0" max="16"
                    value={params.channel}
                    onChange={e => data.onParamChange(id, 'channel', parseInt(e.target.value))}
                    className="w-full bg-zinc-800 text-emerald-400 text-[10px] font-bold p-1 rounded border border-zinc-700 focus:border-emerald-500 outline-none"
                />
            </div>
            <div className="flex-1 space-y-1">
                <label className="text-[7px] font-bold text-zinc-600 uppercase">Type</label>
                <select
                    value={params.type}
                    onChange={e => data.onParamChange(id, 'type', e.target.value)}
                    className="w-full bg-zinc-800 text-emerald-400 text-[10px] font-bold p-1 rounded border border-zinc-700 focus:border-emerald-500 outline-none"
                >
                    <option value="cc">CC</option>
                    <option value="note">NOTE</option>
                </select>
            </div>
            <div className="flex-1 space-y-1">
                <label className="text-[7px] font-bold text-zinc-600 uppercase"># ID</label>
                <input 
                    type="number" min="0" max="127"
                    value={params.index}
                    onChange={e => data.onParamChange(id, 'index', parseInt(e.target.value))}
                    className="w-full bg-zinc-800 text-emerald-400 text-[10px] font-bold p-1 rounded border border-zinc-700 focus:border-emerald-500 outline-none"
                />
            </div>
        </div>

        <div className="flex items-center justify-between bg-zinc-800/50 p-1.5 rounded-lg border border-zinc-800">
            <span className="text-[8px] font-bold text-zinc-500 uppercase">Toggle Mode</span>
            <div 
                onClick={() => data.onParamChange(id, 'mode', params.mode === 'toggle' ? 'momentary' : 'toggle')}
                className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors ${params.mode === 'toggle' ? 'bg-emerald-500' : 'bg-zinc-700'}`}
            >
                <div className={`w-3 h-3 rounded-full bg-white transition-transform ${params.mode === 'toggle' ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
        </div>
      </div>

      <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden mb-1">
          <div 
            className="h-full bg-emerald-500 transition-all duration-75"
            style={{ width: `${(lastVal / 255) * 100}%` }}
          />
      </div>
      <div className="flex justify-between items-center">
         <span className="text-[7px] text-zinc-600 font-mono truncate max-w-[120px]">
            {params.type.toUpperCase()} {params.index} @ CH {params.channel}
         </span>
         <span className="text-[9px] font-mono text-emerald-500">{lastVal}</span>
      </div>

      <Handle type="source" position={Position.Right} id="out-0" className="!bg-emerald-500 !-right-4 !w-3 !h-3" />
    </div>
  );
};
