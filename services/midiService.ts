
import { MidiState, MidiLearnEvent } from '../types';

// Inlined worker script to avoid URL resolution issues in various environments
const WORKER_SCRIPT = `
let midiState = {};
let isDirty = false;

self.onmessage = (e) => {
  const { type, deviceId, data } = e.data;

  if (type === 'MIDI_MSG' && deviceId && data) {
    processMidiMessage(deviceId, data);
  } else if (type === 'RESET') {
    midiState = {};
    isDirty = true;
  }
};

function processMidiMessage(deviceId, data) {
  if (data.length < 2) return;

  const status = data[0];
  const data1 = data[1];
  const data2 = data[2] || 0;

  const typeCode = status & 0xf0;
  const channel = (status & 0x0f) + 1;

  let type = null;
  let value = 0;

  if (typeCode === 0xB0) {
    type = 'cc';
    value = data2;
  } else if (typeCode === 0x90) {
    type = 'note';
    value = data2 > 0 ? 127 : 0; 
  } else if (typeCode === 0x80) {
    type = 'note';
    value = 0;
  }

  if (type) {
    const dmxValue = Math.floor((value / 127) * 255);
    const baseKey = \`\${channel}-\${type}-\${data1}\`;
    
    // Update specific device
    updateStateKeys(deviceId, baseKey, dmxValue);
    
    // Update Omni-device
    updateStateKeys('ALL', baseKey, dmxValue);

    // Update Omni-channel (Channel 0)
    const omniChKey = \`0-\${type}-\${data1}\`;
    updateStateKeys(deviceId, omniChKey, dmxValue);
    updateStateKeys('ALL', omniChKey, dmxValue);
    
    midiState['__LAST_EVENT__'] = JSON.stringify({
        channel, type, index: data1, value: dmxValue, deviceId
    });

    isDirty = true;
  }
}

function updateStateKeys(devId, suffix, val) {
    const key = \`\${devId}__\${suffix}\`;
    midiState[key] = val;
}

// Throttle updates to main thread (approx 60fps)
setInterval(() => {
  if (isDirty) {
    self.postMessage({ type: 'STATE_UPDATE', state: midiState });
    if (midiState['__LAST_EVENT__']) {
        delete midiState['__LAST_EVENT__'];
    }
    isDirty = false;
  }
}, 16);
`;

export class MidiManager {
  private access: MIDIAccess | null = null;
  private state: MidiState = {};
  private learnCallback: ((e: MidiLearnEvent) => void) | null = null;
  public isReady: boolean = false;
  private worker: Worker | null = null;

  constructor() {
    this.handleMidiMessage = this.handleMidiMessage.bind(this);
    
    try {
        // Create Blob from inlined string to avoid external file loading issues
        const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        this.worker = new Worker(url);
        
        this.worker.onmessage = (e) => {
            if (e.data.type === 'STATE_UPDATE') {
                this.state = { ...this.state, ...e.data.state };
                
                // Handle Learn Mode Callback via special key
                if (this.learnCallback && this.state['__LAST_EVENT__']) {
                    try {
                        const eventData = JSON.parse(this.state['__LAST_EVENT__'] as unknown as string);
                        this.learnCallback(eventData);
                    } catch(err) { /* ignore parse error */ }
                }
            }
        };
    } catch (e) {
        console.error("Failed to initialize MIDI Worker", e);
    }
  }

  public async init(): Promise<boolean> {
    if (!navigator.requestMIDIAccess) {
      console.error('Web MIDI API not supported');
      return false;
    }

    try {
      this.access = await navigator.requestMIDIAccess();
      
      // Attach to all current inputs
      this.access.inputs.forEach((input) => {
        input.onmidimessage = this.handleMidiMessage;
      });

      // Handle hot-plugging
      this.access.onstatechange = (e: Event) => {
        const port = (e as MIDIConnectionEvent).port;
        if (port.type === 'input' && port.state === 'connected') {
          (port as MIDIInput).onmidimessage = this.handleMidiMessage;
        }
      };

      this.isReady = true;
      return true;
    } catch (err) {
      console.error('MIDI Access Failed', err);
      return false;
    }
  }

  private handleMidiMessage(event: MIDIMessageEvent) {
    const data = event.data;
    if (!data || !this.worker) return;

    const inputPort = event.target as MIDIInput;
    
    // Offload processing immediately to worker
    this.worker.postMessage({
        type: 'MIDI_MSG',
        deviceId: inputPort.id,
        data: Array.from(data) // Convert Uint8Array to plain array for cloning
    });
  }

  public getState(): MidiState {
    return this.state;
  }

  public setLearnMode(callback: ((e: MidiLearnEvent) => void) | null) {
    this.learnCallback = callback;
  }

  public getDevices(): { id: string; name: string }[] {
    if (!this.access) return [];
    const devices: { id: string; name: string }[] = [];
    this.access.inputs.forEach((input) => {
      devices.push({
        id: input.id,
        name: input.name || `MIDI Input ${input.id}`
      });
    });
    return devices;
  }

  public terminate() {
    if (this.worker) {
        this.worker.terminate();
        this.worker = null;
    }
    // Remove listeners from MIDI access if possible, though 'close' is not standard on MIDIAccess
    if (this.access) {
        this.access.onstatechange = null;
        this.access.inputs.forEach(input => input.onmidimessage = null);
    }
  }
}
