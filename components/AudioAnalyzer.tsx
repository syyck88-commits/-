
import React, { useRef, useEffect, useState } from 'react';

interface AudioAnalyzerProps {
  onLevelsUpdate: (levels: { low: number; mid: number; high: number }) => void;
}

const AudioAnalyzer: React.FC<AudioAnalyzerProps> = ({ onLevelsUpdate }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isLooping, setIsLooping] = useState(false);
  const [currentBuffer, setCurrentBuffer] = useState<AudioBuffer | null>(null);
  
  const audioCtx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const sourceNode = useRef<AudioBufferSourceNode | null>(null);
  const animationFrame = useRef<number>(0);

  const fetchDevices = async () => {
    try {
      // Permission request to see labels
      await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {});
      const dev = await navigator.mediaDevices.enumerateDevices();
      setDevices(dev.filter(d => d.kind === 'audiooutput'));
    } catch (err) {
      console.error("Failed to list audio devices", err);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const initAudio = async () => {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser.current = audioCtx.current.createAnalyser();
      analyser.current.fftSize = 256; // Smaller FFT for snappier response
      analyser.current.connect(audioCtx.current.destination);
    }
    
    if (audioCtx.current.state === 'suspended') {
      await audioCtx.current.resume();
    }

    // Experimental setSinkId support
    if (selectedDeviceId && (audioCtx.current as any).setSinkId) {
      (audioCtx.current as any).setSinkId(selectedDeviceId).catch(console.error);
    }
  };

  const playBuffer = async (buffer: AudioBuffer) => {
    await initAudio();
    
    if (sourceNode.current) {
      try { sourceNode.current.stop(); sourceNode.current.disconnect(); } catch(e) {}
    }

    sourceNode.current = audioCtx.current!.createBufferSource();
    sourceNode.current.buffer = buffer;
    sourceNode.current.loop = isLooping;
    
    // SIGNAL CHAIN: Source -> Analyser -> Output (Destination)
    sourceNode.current.connect(analyser.current!);
    
    sourceNode.current.onended = () => {
        if (!sourceNode.current?.loop) setIsPlaying(false);
    };

    sourceNode.current.start(0);
    setIsPlaying(true);
    
    if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    tick();
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    try {
      await initAudio();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioCtx.current!.decodeAudioData(arrayBuffer);
      setCurrentBuffer(audioBuffer);
      playBuffer(audioBuffer);
    } catch (err) {
      console.error("Error loading audio file:", err);
      setFileName(null);
    }
  };

  const togglePlayback = () => {
    if (!currentBuffer) return;
    if (isPlaying) {
      sourceNode.current?.stop();
      setIsPlaying(false);
    } else {
      playBuffer(currentBuffer);
    }
  };

  const tick = () => {
    if (!analyser.current) return;
    
    const data = new Uint8Array(analyser.current.frequencyBinCount);
    analyser.current.getByteFrequencyData(data);
    
    // Average bins for clearer response
    let low = 0, mid = 0, high = 0;
    const binCount = data.length;
    
    const lowRange = Math.floor(binCount * 0.1);
    const midRange = Math.floor(binCount * 0.5);
    
    for (let i = 0; i < lowRange; i++) low += data[i];
    for (let i = lowRange; i < midRange; i++) mid += data[i];
    for (let i = midRange; i < binCount; i++) high += data[i];

    onLevelsUpdate({
      low: low / Math.max(1, lowRange),
      mid: mid / Math.max(1, midRange - lowRange),
      high: high / Math.max(1, binCount - midRange)
    });

    animationFrame.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    return () => cancelAnimationFrame(animationFrame.current);
  }, []);

  return (
    <div className="flex flex-col gap-2 flex-1">
      <div 
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file && file.type.startsWith('audio/')) handleFile(file);
        }}
        className={`relative group h-14 bg-zinc-900 border-2 border-dashed rounded-2xl flex items-center justify-between px-6 transition-all ${fileName ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-800 hover:border-zinc-700'}`}
      >
        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-3 select-none">
          {fileName ? (
            <>
              <div className="flex gap-1 items-end h-4">
                {[1,2,3,4,5].map(i => <div key={i} className={`w-1 bg-emerald-500 ${isPlaying ? 'animate-pulse' : ''}`} style={{height: isPlaying ? `${20 + Math.random()*80}%` : '20%', animationDelay: `${i*0.1}s`}} />)}
              </div>
              <span className="text-emerald-400 max-w-[150px] truncate font-mono italic">{fileName}</span>
            </>
          ) : (
            "DRAG MP3 TO SYNC LIGHTS"
          )}
        </div>
        
        {fileName && (
          <div className="flex items-center gap-4 z-20">
             <button 
                onClick={e => { e.stopPropagation(); setIsLooping(!isLooping); if(sourceNode.current) sourceNode.current.loop = !isLooping; }}
                className={`text-[9px] font-black tracking-widest transition-colors ${isLooping ? 'text-emerald-500' : 'text-zinc-600'}`}
             >
                LOOP {isLooping ? 'ON' : 'OFF'}
             </button>
             <button 
                onClick={e => { e.stopPropagation(); togglePlayback(); }}
                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
             >
                {isPlaying ? 'PAUSE' : 'PLAY'}
             </button>
             <button 
                onClick={e => { e.stopPropagation(); if(sourceNode.current) sourceNode.current.stop(); setFileName(null); setIsPlaying(false); setCurrentBuffer(null); }} 
                className="text-[10px] font-black text-zinc-600 hover:text-red-500"
             >
                ✕
             </button>
          </div>
        )}

        {!fileName && (
            <input 
            type="file" accept="audio/*" 
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="absolute inset-0 opacity-0 cursor-pointer"
            />
        )}
      </div>

      <div className="flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">AUDIO OUTPUT:</span>
            <select 
                value={selectedDeviceId}
                onChange={(e) => {
                    const id = e.target.value;
                    setSelectedDeviceId(id);
                    if (audioCtx.current && (audioCtx.current as any).setSinkId) {
                        (audioCtx.current as any).setSinkId(id).catch(console.error);
                    }
                }}
                className="bg-transparent text-[9px] font-bold text-zinc-500 focus:text-emerald-400 outline-none cursor-pointer max-w-[220px] truncate"
            >
                <option value="" className="bg-zinc-900">System Default</option>
                {devices.map(d => (
                <option key={d.deviceId} value={d.deviceId} className="bg-zinc-900">{d.label || `Speaker ${d.deviceId.slice(0,5)}`}</option>
                ))}
            </select>
        </div>
        <button onClick={fetchDevices} className="text-[8px] font-black text-zinc-600 hover:text-zinc-400 uppercase">Rescan Devices</button>
      </div>
    </div>
  );
};

export default AudioAnalyzer;
