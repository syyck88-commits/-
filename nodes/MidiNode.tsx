
import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { MidiLearnEvent } from '../types';

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

// Helper for loose name matching (handles spaces, casing, and substrings)
const isSameDeviceName = (savedName: string, currentName: string) => {
    if (!savedName || !currentName) return false;
    const s = savedName.trim().toLowerCase();
    const c = currentName.trim().toLowerCase();
    return s === c || c.includes(s) || s.includes(c);
};

export const MidiNode = ({ data, id }: any) => {
  const [isLearning, setIsLearning] = useState(false);
  const [lastVal, setLastVal] = useState(0);
  const [devices, setDevices] = useState<{ id: string, name: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isMidiReady, setIsMidiReady] = useState(false);

  // Default params 
  const params = {
    channel: 1,
    type: 'cc',
    index: 1,
    mode: 'momentary',
    deviceId: 'ALL',
    deviceName: 'All Devices (Omni)',
    ...data.params
  };

  // Visualization Update
  useEffect(() => {
    const interval = setInterval(() => {
      if (data.values && data.values[0] !== undefined) {
        setLastVal(data.values[0]);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [data.values]);

  // Robust Device Recovery Logic
  useEffect(() => {
    const checkDevices = () => {
        const ready = !!window.luminaMidi?.isReady;
        setIsMidiReady(ready);

        if (!ready) return;

        const currentDevices = window.luminaMidi!.getDevices();
        setDevices(currentDevices);

        // RECOVERY LOGIC
        // Only run if we are looking for a specific device that appears to be missing
        if (params.deviceId !== 'ALL' && params.deviceName) {
           const currentIdExists = currentDevices.some(d => d.id === params.deviceId);
           
           if (!currentIdExists) {
              // Device ID not found (changed USB port, browser restart, etc.)
              setIsSearching(true);
              
              // Try to find by name using fuzzy match
              const match = currentDevices.find(d => isSameDeviceName(params.deviceName, d.name));
              
              if (match) {
                 console.log(`MIDI: Auto-recovered device "${match.name}" (Old ID: ${params.deviceId} -> New ID: ${match.id})`);
                 // Auto-update the ID to match the Found device
                 data.onParamChange(id, 'deviceId', match.id);
                 // Update name too to ensure it's exact for next time
                 data.onParamChange(id, 'deviceName', match.name);
                 setIsSearching(false);
              }
           } else {
              // Device ID exists, we are good
              setIsSearching(false);
           }
        } else {
           setIsSearching(false);
        }
    };
    
    // Check immediately
    checkDevices();
    
    // Poll frequently - devices might initialize a few seconds after page load or permission grant
    const interval = setInterval(checkDevices, 1000); 
    return () => clearInterval(interval);
  }, [params.deviceId, params.deviceName, id, data]);

  // Learn Mode Handler
  useEffect(() => {
    if (isLearning && window.luminaMidi) {
      window.luminaMidi.setLearnMode((e) => {
        data.onParamChange(id, 'channel', e.channel);
        data.onParamChange(id, 'type', e.type);
        data.onParamChange(id, 'index', e.index);
        
        const devs = window.luminaMidi?.getDevices() || [];
        // If device ID is available, find its name. 
        // Note: e.deviceId comes from the worker/message
        const devMatch = devs.find(d => d.id === e.deviceId);
        const devName = devMatch?.name || 'Unknown Device';
        
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
    setDevices(window.luminaMidi!.getDevices());
    setIsLearning(!isLearning);
  };

  const handleDeviceChange = (newId: string) => {
     const device = devices.find(d => d.id === newId);
     const name = device?.name || (newId === 'ALL' ? 'All Devices (Omni)' : 'Unknown');
     
     data.onParamChange(id, 'deviceId', newId);
     data.onParamChange(id, 'deviceName', name);
  };

  // Determine if we should show the "Disconnected" red state
  const isDeviceMissing = isMidiReady && params.deviceId !== 'ALL' && !devices.some(d => d.id === params.deviceId);

  return (
    <div className={`bg-zinc-900 border-2 rounded-2xl p-4 w-56 shadow-2xl transition-all duration-300 ${isLearning ? 'border-amber-500 animate-pulse' : isDeviceMissing ? 'border-red-500/50 shadow-red-500/10' : 'border-zinc-800'}`}>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isMidiReady ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-zinc-700'}`} />
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">MIDI INPUT</span>
        </div>
        <button 
          onClick={toggleLearn}
          className={`px-3 py-1 rounded text-[8px] font-black uppercase transition-all ${isLearning ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}
        >
          {isLearning ? 'LEARNING...' : 'LEARN'}
        </button>
      </div>

      <div className="space-y-3 mb-4">
        <div className="space-y-1">
            <div className="flex justify-between items-center">
                <label className="text-[7px] font-bold text-zinc-600 uppercase">Input Device</label>
                {!isMidiReady ? (
                   <span className="text-[7px] font-bold text-zinc-500 uppercase animate-pulse">Waiting for MIDI...</span>
                ) : isSearching ? (
                   <span className="text-[7px] font-bold text-amber-500 uppercase animate-pulse">Auto-Connecting...</span>
                ) : isDeviceMissing ? (
                   <span className="text-[7px] font-bold text-red-500 uppercase">Disconnected</span>
                ) : null}
            </div>
            <select
                value={params.deviceId}
                onChange={e => handleDeviceChange(e.target.value)}
                disabled={!isMidiReady}
                className={`w-full bg-zinc-800 text-[9px] font-bold p-1.5 rounded border outline-none truncate transition-colors ${!isMidiReady ? 'border-zinc-800 text-zinc-600 cursor-not-allowed' : isDeviceMissing ? 'border-red-500/50 text-red-400' : 'border-zinc-700 text-emerald-400 focus:border-emerald-500'}`}
            >
                <option value="ALL">All Devices (Omni)</option>
                {devices.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                ))}
                {isDeviceMissing && params.deviceName && (
                    <option value={params.deviceId} disabled>{params.deviceName} (Offline)</option>
                )}
            </select>
        </div>

        <div className="flex gap-2">
            <div className="flex-1 space-y-1">
                <label className="text-[7px] font-bold text-zinc-600 uppercase">CH</label>
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
                <label className="text-[7px] font-bold text-zinc-600 uppercase">ID</label>
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
            className="h-full bg-emerald-500 transition-all duration-75 shadow-[0_0_8px_#10b981]"
            style={{ width: `${(lastVal / 255) * 100}%` }}
          />
      </div>
      <div className="flex justify-between items-center">
         <span className="text-[7px] text-zinc-600 font-mono truncate max-w-[120px]">
            {params.type.toUpperCase()} {params.index} @ CH {params.channel}
         </span>
         <span className={`text-[9px] font-mono font-black ${lastVal > 0 ? 'text-emerald-500' : 'text-zinc-600'}`}>{lastVal}</span>
      </div>

      <Handle type="source" position={Position.Right} id="out-0" className="!bg-emerald-500 !-right-4 !w-3 !h-3 !border-zinc-900" />
    </div>
  );
};
