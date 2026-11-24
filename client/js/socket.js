import { api } from './api.js';

export class MultiplayerSocket {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    const token = api.getToken();
    if (!token) return null;
    if (this.socket && this.socket.connected) return this.socket;
    if (this.socket) this.socket.disconnect();

    this.socket = window.io({
      auth: { token },
      transports: ['websocket', 'polling']
    });

    for (const [ev, handlers] of this.listeners.entries()) {
      for (const fn of handlers) this.socket.on(ev, fn);
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    if (this.socket) this.socket.on(event, handler);
  }

  emit(event, payload) {
    if (!this.socket || !this.socket.connected) this.connect();
    this.socket?.emit(event, payload);
  }
}

export const mpSocket = new MultiplayerSocket();
