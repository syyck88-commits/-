
import { ConnectionStatus, DmxValue } from '../types';

export class DmxClient {
  private ws: WebSocket | null = null;
  private url: string;
  private onStatusChange: (status: ConnectionStatus) => void;
  private lastSendTime: number = 0;
  private throttleMs: number = 25;

  constructor(url: string, onStatusChange: (status: ConnectionStatus) => void) {
    this.url = url;
    this.onStatusChange = onStatusChange;
    this.connect();
  }

  private connect() {
    this.onStatusChange(ConnectionStatus.CONNECTING);
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.onStatusChange(ConnectionStatus.CONNECTED);
    };

    this.ws.onclose = () => {
      this.onStatusChange(ConnectionStatus.DISCONNECTED);
      setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  public send(updates: DmxValue[], force = false) {
    if (!this.ws || this.ws.readyState !== 1) return;
    
    const now = Date.now();
    if (!force && now - this.lastSendTime < this.throttleMs) return;

    if (updates.length > 0) {
      this.ws.send(JSON.stringify(updates));
      this.lastSendTime = now;
      return true; // Activity detected
    }
    return false;
  }

  public close() {
    this.ws?.close();
  }
}
