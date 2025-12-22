
import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';

export const InputNode = ({ data, id }: any) => {
  const [mode, setMode] = useState<'media' | 'device'>('media');
  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  
  const audioCtx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const sourceNode = useRef<AudioBufferSourceNode | MediaStreamAudioSourceNode | null>(null);
  const audioBuffer = useRef<AudioBuffer | null>(null);
  const startTime = useRef(0);
  const offsetTime = useRef(0);
  const animationFrame = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const initAudio = async () => {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser.current = audioCtx.current.createAnalyser();
      analyser.current.fftSize = 256;
    }
    if (audioCtx.current.state === 'suspended') await audioCtx.current.resume();
  };

  const getDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devs = await navigator.mediaDevices.enumerateDevices();
      setDevices(devs.filter(d => d.kind === 'audioinput'));
    } catch (e) { console.error(e); }
  };

  const playBuffer = (buffer: AudioBuffer, fromTime: number) => {
    if (sourceNode.current) {
      try { 
        if ('stop' in sourceNode.current) {
          (sourceNode.current as AudioBufferSourceNode).stop();
        }
        sourceNode.current.disconnect(); 
      } catch(e) {}
    }
    sourceNode.current = audioCtx.current!.createBufferSource();
    (sourceNode.current as AudioBufferSourceNode).buffer = buffer;
    sourceNode.current.connect(analyser.current!);
    sourceNode.current.connect(audioCtx.current!.destination);
    
    sourceNode.current.onended = () => {
      if (isPlaying) setIsPlaying(false);
    };

    const start = Math.max(0, fromTime);
    sourceNode.current.start(0, start);
    startTime.current = audioCtx.current!.currentTime - start;
    setIsPlaying(true);
  };

  const handleFile = async (file: File) => {
    await initAudio();
    setFileName(file.name);
    const arrayBuffer = await file.arrayBuffer();
    audioBuffer.current = await audioCtx.current!.decodeAudioData(arrayBuffer);
    offsetTime.current = 0;
    playBuffer(audioBuffer.current, 0);
  };

  const togglePlayback = () => {
    if (!audioBuffer.current) return;
    if (isPlaying) {
      offsetTime.current = audioCtx.current!.currentTime - startTime.current;
      if (sourceNode.current && 'stop' in sourceNode.current) {
        (sourceNode.current as AudioBufferSourceNode).stop();
      }
      setIsPlaying(false);
    } else {
      playBuffer(audioBuffer.current, offsetTime.current);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioBuffer.current) return;
    const seekTime = parseFloat(e.target.value);
    offsetTime.current = seekTime;
    if (isPlaying) playBuffer(audioBuffer.current, seekTime);
    else setProgress((seekTime / audioBuffer.current.duration) * 100);
  };

  const startStream = async (deviceId: string) => {
    await initAudio();
    if (sourceNode.current) { sourceNode.current.disconnect(); }
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: { deviceId: deviceId ? { exact: deviceId } : undefined } 
    });
    sourceNode.current = audioCtx.current!.createMediaStreamSource(stream);
    sourceNode.current.connect(analyser.current!);
    setIsPlaying(true);
  };

  useEffect(() => {
    const tick = () => {
      if (!analyser.current) {
        animationFrame.current = requestAnimationFrame(tick);
        return;
      }

      const dataArray = new Uint8Array(analyser.current.frequencyBinCount);
      analyser.current.getByteFrequencyData(dataArray);

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const barWidth = canvas.width / dataArray.length;
          dataArray.forEach((val, i) => {
            const h = (val / 255) * canvas.height;
            ctx.fillStyle = `rgba(16, 185, 129, ${0.3 + (val/255)*0.7})`;
            ctx.fillRect(i * barWidth, canvas.height - h, barWidth - 1, h);
          });
        }
      }

      if (mode === 'media' && isPlaying && audioBuffer.current) {
        const current = audioCtx.current!.currentTime - startTime.current;
        setProgress((current / audioBuffer.current.duration) * 100);
      }

      let low = 0, mid = 0, high = 0;
      const binCount = dataArray.length;
      const lowRange = Math.floor(binCount * 0.1);
      const midRange = Math.floor(binCount * 0.5);
      for (let i = 0; i < lowRange; i++) low += dataArray[i];
      for (let i = lowRange; i < midRange; i++) mid += dataArray[i];
      for (let i = midRange; i < binCount; i++) high += dataArray[i];

      if (data.onAudioLevelsUpdate) {
        data.onAudioLevelsUpdate(id, {
          low: low / Math.max(1, lowRange),
          mid: mid / Math.max(1, midRange - lowRange),
          high: high / Math.max(1, binCount - midRange)
        });
      }

      animationFrame.current = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(animationFrame.current);
  }, [id, data, mode, isPlaying]);

  return (
    <div className="bg-[#121216] border border-zinc-800 rounded-2xl p-4 w-72 relative h-full">
      <div className="flex gap-2 mb-4 bg-zinc-900/50 p-1 rounded-xl">
        <button 
          onClick={() => setMode('media')} 
          className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${mode === 'media' ? 'bg-emerald-500 text-white' : 'text-zinc-600 hover:text-white'}`}
        >Media</button>
        <button 
          onClick={() => { setMode('device'); getDevices(); }} 
          className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${mode === 'device' ? 'bg-emerald-500 text-white' : 'text-zinc-600 hover:text-white'}`}
        >Device</button>
      </div>

      <div className="relative mb-4 h-24 bg-black rounded-xl overflow-hidden border border-zinc-900">
        <canvas ref={canvasRef} width={280} height={96} className="w-full h-full opacity-60" />
        {mode === 'media' && !fileName && (
          <div className="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-zinc-900/50 rounded-xl m-1.5">
            <span className="text-[7px] font-black text-zinc-700 uppercase">Drop Audio File</span>
            <input 
              type="file" accept="audio/*,video/*" 
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
        )}
      </div>

      {mode === 'media' && fileName && (
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-[9px] font-mono italic text-emerald-400 truncate max-w-[150px]">{fileName}</span>
            <button onClick={togglePlayback} className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 hover:bg-emerald-500 transition-all hover:text-white">
              <span className="translate-x-[1px]">{isPlaying ? 'Ⅱ' : '▶'}</span>
            </button>
          </div>
          <div className="px-1">
            <input 
              type="range" min="0" max={audioBuffer.current?.duration || 0} step="0.1" 
              value={audioCtx.current && isPlaying ? (audioCtx.current.currentTime - startTime.current) : offsetTime.current}
              onChange={handleSeek}
              className="w-full h-1 bg-zinc-800 rounded-full appearance-none accent-emerald-500 cursor-pointer" 
            />
          </div>
        </div>
      )}

      {mode === 'device' && (
        <div className="space-y-3">
          <div className="flex flex-col gap-1 px-1">
            <span className="text-[7px] font-black text-zinc-600 uppercase">Input Device</span>
            <select 
              value={selectedDevice}
              onChange={e => { setSelectedDevice(e.target.value); startStream(e.target.value); }}
              className="bg-zinc-900 text-[9px] font-bold text-emerald-400 p-2 rounded-lg outline-none border border-zinc-800"
            >
              <option value="">Select Device...</option>
              {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Input Device'}</option>)}
            </select>
          </div>
          <button onClick={getDevices} className="text-[7px] font-black text-zinc-700 hover:text-zinc-400 uppercase tracking-widest px-1">Rescan Hardware</button>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-zinc-800/50 flex justify-between items-center">
        <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Signal Output</span>
        <Handle type="source" position={Position.Right} id="signal-out" className="!bg-emerald-500 !w-3 !h-3 !border-[#121216] !-right-[18px]" />
      </div>
    </div>
  );
};
