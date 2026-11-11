import type { WSMessage } from '../types';

type MessageHandler = (message: WSMessage) => void;

function getWsBase(): string {
  const explicit = import.meta.env.VITE_WS_URL as string | undefined;
  if (explicit) return explicit;

  const backend = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (backend && /^https?:\/\//i.test(backend)) {
    const url = new URL(backend);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${url.protocol}//${url.host}/ws`;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: number | null = null;
  private roomId = '';
  private playerId = '';
  private token = '';
  private manualClose = false;

  connect(roomId: string, playerId: string, token: string) {
    this.roomId = roomId;
    this.playerId = playerId;
    this.token = token;
    this.manualClose = false;

    const url = `${getWsBase()}?roomId=${encodeURIComponent(roomId)}&playerId=${encodeURIComponent(playerId)}&token=${encodeURIComponent(token)}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        this.notifyHandlers(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code);
      this.notifyHandlers({ type: 'ws_disconnected', payload: { code: event.code } });
      // 4xxx codes are deliberate rejections (bad params, room gone, bad token) —
      // reconnecting cannot succeed, so don't even try.
      if (!this.manualClose && event.code < 4000) {
        this.attemptReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  disconnect() {
    this.manualClose = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: WSMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  on(messageType: string, handler: MessageHandler) {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, new Set());
    }
    this.handlers.get(messageType)!.add(handler);
  }

  off(messageType: string, handler: MessageHandler) {
    this.handlers.get(messageType)?.delete(handler);
  }

  private notifyHandlers(message: WSMessage) {
    this.handlers.get(message.type)?.forEach(handler => handler(message));
    this.handlers.get('*')?.forEach(handler => handler(message));
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.notifyHandlers({ type: 'ws_reconnect_failed', payload: {} });
      return;
    }

    this.reconnectAttempts++;
    const timeout = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    console.log(`Reconnecting in ${timeout}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = window.setTimeout(() => {
      if (this.roomId && this.playerId && this.token) {
        this.connect(this.roomId, this.playerId, this.token);
      }
    }, timeout);
  }
}

export const wsClient = new WebSocketClient();
