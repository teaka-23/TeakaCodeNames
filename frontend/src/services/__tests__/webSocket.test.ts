import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;
  /** When false, sockets stay CONNECTING (used to accumulate reconnect attempts). */
  static autoOpen = true;
  readyState = MockWebSocket.CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  sent: string[] = [];
  closedWith: number | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    if (MockWebSocket.autoOpen) {
      queueMicrotask(() => {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.(new Event('open'));
      });
    }
  }

  static instances: MockWebSocket[] = [];

  send(data: string) {
    this.sent.push(data);
  }

  close(code = 1000) {
    this.closedWith = code;
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code } as CloseEvent);
  }
}

describe('WebSocketClient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    MockWebSocket.autoOpen = true;
    // @ts-expect-error test mock
    global.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('notifies ws_connected on open and can send', async () => {
    const { WebSocketClient } = await import('../webSocket');
    const client = new WebSocketClient();
    const connected = vi.fn();
    client.on('ws_connected', connected);

    client.connect('ABC123', 'p1', 'tok');
    await vi.waitFor(() => expect(connected).toHaveBeenCalled());
    expect(client.connected).toBe(true);

    client.send({ type: 'chat', payload: { text: 'hi' } });
    const sock = MockWebSocket.instances[0];
    expect(sock.sent[0]).toContain('"type":"chat"');
    expect(sock.url).toContain('roomId=ABC123');
    expect(sock.url).toContain('playerId=p1');
    expect(sock.url).toContain('token=tok');

    client.disconnect();
    expect(client.connected).toBe(false);
  });

  it('emits ws_send_failed when the socket is down', async () => {
    const { WebSocketClient } = await import('../webSocket');
    const client = new WebSocketClient();
    const failed = vi.fn();
    client.on('ws_send_failed', failed);
    client.send({ type: 'guess', payload: { cardIndex: 0 } });
    expect(failed).toHaveBeenCalled();
  });

  it('dispatches parsed messages and ignores bad JSON', async () => {
    const { WebSocketClient } = await import('../webSocket');
    const client = new WebSocketClient();
    const onState = vi.fn();
    const onAny = vi.fn();
    client.on('game_state', onState);
    client.on('*', onAny);
    client.connect('R', 'p', 't');
    await vi.waitFor(() => expect(client.connected).toBe(true));

    const sock = MockWebSocket.instances[0];
    sock.onmessage?.({ data: JSON.stringify({ type: 'game_state', payload: { ok: 1 } }) } as MessageEvent);
    expect(onState).toHaveBeenCalledWith({ type: 'game_state', payload: { ok: 1 } });
    expect(onAny).toHaveBeenCalled();

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sock.onmessage?.({ data: '{not-json' } as MessageEvent);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('schedules reconnect on transient close', async () => {
    const { WebSocketClient } = await import('../webSocket');
    const client = new WebSocketClient();
    const reconnecting = vi.fn();
    client.on('ws_reconnecting', reconnecting);

    client.connect('R', 'p', 't');
    await vi.advanceTimersByTimeAsync(0);
    expect(client.connected).toBe(true);

    MockWebSocket.instances[0].close(1006);
    expect(reconnecting).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ws_reconnecting',
        payload: expect.objectContaining({ attempt: 1 }),
      })
    );

    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(0);
    expect(MockWebSocket.instances.length).toBeGreaterThan(1);
    expect(client.connected).toBe(true);
  });

  it('emits ws_reconnect_failed after max reconnect attempts', async () => {
    const { WebSocketClient } = await import('../webSocket');
    const client = new WebSocketClient();
    const failed = vi.fn();
    client.on('ws_reconnect_failed', failed);

    client.connect('R', 'p', 't');
    await vi.advanceTimersByTimeAsync(0);
    // Prevent open so reconnectAttempts is not reset to 0.
    MockWebSocket.autoOpen = false;

    for (let attempt = 0; attempt < 9; attempt++) {
      const sock = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      sock.close(1006);
      if (attempt < 8) {
        await vi.advanceTimersByTimeAsync(20_000);
      }
    }

    expect(failed).toHaveBeenCalled();
  });

  it('does not reconnect on 4xxx close and emits ws_reconnect_failed', async () => {
    const { WebSocketClient } = await import('../webSocket');
    const client = new WebSocketClient();
    const failed = vi.fn();
    const reconnecting = vi.fn();
    client.on('ws_reconnect_failed', failed);
    client.on('ws_reconnecting', reconnecting);

    client.connect('R', 'p', 't');
    await vi.waitFor(() => expect(client.connected).toBe(true));
    MockWebSocket.instances[0].close(4003);

    expect(reconnecting).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ws_reconnect_failed', payload: { code: 4003 } })
    );
  });

  it('off removes a handler', async () => {
    const { WebSocketClient } = await import('../webSocket');
    const client = new WebSocketClient();
    const handler = vi.fn();
    client.on('chat', handler);
    client.off('chat', handler);
    client.connect('R', 'p', 't');
    await vi.waitFor(() => expect(client.connected).toBe(true));
    MockWebSocket.instances[0].onmessage?.({
      data: JSON.stringify({ type: 'chat', payload: {} }),
    } as MessageEvent);
    expect(handler).not.toHaveBeenCalled();
  });

  it('logs onerror without throwing', async () => {
    const { WebSocketClient } = await import('../webSocket');
    const client = new WebSocketClient();
    client.connect('R', 'p', 't');
    await vi.waitFor(() => expect(client.connected).toBe(true));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    MockWebSocket.instances[0].onerror?.(new Event('error'));
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
