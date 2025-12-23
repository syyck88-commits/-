
// Types definition for the worker scope
type MidiMsgType = 'cc' | 'note';
type MidiState = Record<string, number>;

interface WorkerMessage {
  type: 'MIDI_MSG' | 'RESET';
  deviceId?: string;
  data?: number[];
}

const ctx: Worker = self as any;

// Internal state storage
let midiState: MidiState = {};
let isDirty = false;

// Internal logic state for Toggle mode
// Key: "deviceId__channel-type-index" -> { toggleVal: number, prevRaw: number }
const toggleState: Record<string, { current: number; prevRaw: number }> = {};

ctx.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, deviceId, data } = e.data;

  if (type === 'MIDI_MSG' && deviceId && data) {
    processMidiMessage(deviceId, data);
  } else if (type === 'RESET') {
    midiState = {};
    isDirty = true;
  }
};

// Processing logic moved from main thread
function processMidiMessage(deviceId: string, data: number[]) {
  if (data.length < 2) return;

  const status = data[0];
  const data1 = data[1];
  const data2 = data[2] || 0;

  const typeCode = status & 0xf0;
  const channel = (status & 0x0f) + 1;

  let type: MidiMsgType | null = null;
  let value = 0; // Normalized 0-127 internally

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
    const baseKey = `${channel}-${type}-${data1}`;
    
    // Check for Learn Event need (we send a special flag in the state update)
    // For now, we update the state map, and the main thread detects changes for 'Learning'
    
    // We update 3 permutations for flexible binding:
    // 1. Specific Device
    updateStateKeys(deviceId, baseKey, dmxValue);
    
    // 2. All Devices (Omni-device)
    updateStateKeys('ALL', baseKey, dmxValue);

    // 3. Omni-channel (Channel 0)
    const omniChKey = `0-${type}-${data1}`;
    updateStateKeys(deviceId, omniChKey, dmxValue);
    updateStateKeys('ALL', omniChKey, dmxValue);
    
    // Pass raw event info for Learn Mode in the next batch
    midiState['__LAST_EVENT__'] = JSON.stringify({
        channel, type, index: data1, value: dmxValue, deviceId
    }) as any;

    isDirty = true;
  }
}

function updateStateKeys(devId: string, suffix: string, val: number) {
    const key = `${devId}__${suffix}`;
    midiState[key] = val;
}

// Throttle updates to main thread (approx 60fps)
// This prevents flooding the main thread's message queue
setInterval(() => {
  if (isDirty) {
    ctx.postMessage({ type: 'STATE_UPDATE', state: midiState });
    // Clean up temporary event data to avoid re-triggering logic
    if (midiState['__LAST_EVENT__']) {
        delete midiState['__LAST_EVENT__'];
    }
    isDirty = false;
  }
}, 16);
