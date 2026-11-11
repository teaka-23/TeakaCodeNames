import http from 'http';
import { AddressInfo } from 'net';
import WebSocket from 'ws';
import type { GameState, Player, Card, WsMessage } from '../src/types';

/**
 * Integration tests for the WebSocket layer.
 * A real http.Server + WebSocketServer is spun up on an ephemeral port and
 * driven with `ws` clients, so transport concerns (auth, broadcast, handlers)
 * are exercised end to end rather than mocked.
 */

// The handler keeps a module-level singleton, so each suite gets a fresh registry.
jest.mock('../src/utils/roomManager', () => {
  const actual = jest.requireActual('../src/utils/roomManager');
  return { ...actual, roomManager: new actual.RoomManager() };
});

const { roomManager } = require('../src/utils/roomManager') as typeof import('../src/utils/roomManager');
const { setupWebSocket } = require('../src/utils/webSocketHandler') as typeof import('../src/utils/webSocketHandler');

let server: http.Server;
let port: number;
let room: ReturnType<typeof roomManager.create>;
const sockets: Socket[] = [];

/**
 * Thin wrapper that buffers every inbound message from the moment the socket is
 * created, so assertions never race against the server's initial burst.
 */
class Socket {
  readonly ws: WebSocket;
  private buffer: WsMessage[] = [];
  private waiters: Array<{ type: string; resolve: (m: WsMessage) => void; timer: NodeJS.Timeout }> = [];

  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as WsMessage;
      const waiterIndex = this.waiters.findIndex((w) => w.type === msg.type);
      if (waiterIndex >= 0) {
        const [waiter] = this.waiters.splice(waiterIndex, 1);
        clearTimeout(waiter.timer);
        waiter.resolve(msg);
      } else {
        this.buffer.push(msg);
      }
    });
  }

  static open(roomId: string, playerId: string, token: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(
        `ws://127.0.0.1:${port}/ws?roomId=${roomId}&playerId=${playerId}&token=${token}`
      );
      const socket = new Socket(ws);
      sockets.push(socket);

      ws.once('open', () => {
        ws.off('error', onError);
        resolve(socket);
      });
      const onError = (err: Error) => reject(err);
      ws.once('error', onError);
    });
  }

  next(type: string, timeoutMs = 3000): Promise<WsMessage> {
    const bufferedIndex = this.buffer.findIndex((m) => m.type === type);
    if (bufferedIndex >= 0) {
      const [msg] = this.buffer.splice(bufferedIndex, 1);
      return Promise.resolve(msg);
    }

    return new Promise((resolve, reject) => {
      const waiter = {
        type,
        resolve,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((w) => w !== waiter);
          reject(new Error(`Timed out waiting for message: ${type}`));
        }, timeoutMs),
      };
      this.waiters.push(waiter);
    });
  }

  send(type: string, payload: unknown = {}): void {
    this.ws.send(JSON.stringify({ type, payload }));
  }

  sendRaw(data: string): void {
    this.ws.send(data);
  }

  /** Messages received during the next `ms` milliseconds (from buffer + live). */
  async drain(ms = 120): Promise<WsMessage[]> {
    const collected = this.buffer.splice(0);
    const live: WsMessage[] = [];
    const onMessage = (raw: WebSocket.RawData) => {
      live.push(JSON.parse(raw.toString()) as WsMessage);
    };
    this.ws.on('message', onMessage);
    await sleep(ms);
    this.ws.off('message', onMessage);
    return collected.concat(live);
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ws.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }
      this.ws.once('close', () => resolve());
      this.ws.close();
    });
  }

  terminate(): void {
    this.ws.terminate();
  }
}

function openRaw(query: string): Promise<{ code: number }> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?${query}`);
    ws.on('close', (code: number) => resolve({ code }));
    ws.on('error', () => {});
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function buildStartedRoom() {
  const r = roomManager.create('Алиса', 'p1');
  roomManager.join(r.id, 'Боб', 'p2');
  roomManager.join(r.id, 'Виктор', 'p3');
  roomManager.start(r.id);
  return r;
}

/** Open a socket and consume the initial player_list + game_update burst. */
async function openSynced(roomId: string, playerId: string, token: string): Promise<Socket> {
  const socket = await Socket.open(roomId, playerId, token);
  await socket.next('player_list');
  await socket.next('game_update');
  return socket;
}

beforeAll((done) => {
  server = http.createServer();
  setupWebSocket(server);
  server.listen(0, '127.0.0.1', () => {
    port = (server.address() as AddressInfo).port;
    done();
  });
});

afterEach(async () => {
  for (const socket of sockets.splice(0)) {
    socket.terminate();
  }
  await sleep(30);
  for (const info of roomManager.listAll()) {
    roomManager.delete(info.id);
  }
});

afterAll(async () => {
  for (const socket of sockets.splice(0)) {
    socket.terminate();
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('WebSocket authentication', () => {
  it('closes with 4000 when roomId is missing', async () => {
    const { code } = await openRaw('playerId=p1&token=whatever');
    expect(code).toBe(4000);
  });

  it('closes with 4000 when playerId is missing', async () => {
    const { code } = await openRaw('roomId=ABC123&token=whatever');
    expect(code).toBe(4000);
  });

  it('closes with 4001 for an unknown room', async () => {
    const { code } = await openRaw('roomId=ZZZZZZ&playerId=p1&token=abc');
    expect(code).toBe(4001);
  });

  it('closes with 4003 when the token is missing', async () => {
    room = buildStartedRoom();
    const { code } = await openRaw(`roomId=${room.id}&playerId=p1`);
    expect(code).toBe(4003);
  });

  it('closes with 4003 when the token is invalid', async () => {
    room = buildStartedRoom();
    const { code } = await openRaw(`roomId=${room.id}&playerId=p1&token=wrong-token`);
    expect(code).toBe(4003);
  });

  it('accepts a valid token', async () => {
    room = buildStartedRoom();
    const socket = await Socket.open(room.id, 'p1', room.token);
    expect(socket.ws.readyState).toBe(WebSocket.OPEN);
  });
});

describe('WebSocket initial state', () => {
  it('sends player_list and game_update on connect', async () => {
    room = buildStartedRoom();
    const socket = await Socket.open(room.id, 'p1', room.token);

    const playerList = await socket.next('player_list');
    expect((playerList.payload as Player[]).length).toBe(3);

    const state = (await socket.next('game_update')).payload as GameState;
    expect(state.cards.length).toBe(25);
    expect(state.status).toBe('spymaster-ready');
  });

  it('registers the connection in the room', async () => {
    room = buildStartedRoom();
    await openSynced(room.id, 'p1', room.token);
    expect(room.playerConnections.has('p1')).toBe(true);
  });
});

describe('WebSocket start_round', () => {
  it('broadcasts the clue entered by the spymaster', async () => {
    room = buildStartedRoom();
    const spymaster = room.gameState.players.find(
      (p: Player) => p.role === 'spymaster' && p.team === room.gameState.currentTurn
    )!;

    const socket = await openSynced(room.id, spymaster.id, room.token);
    socket.send('start_round', { clue: { word: 'база', count: 2 } });

    const state = (await socket.next('game_update')).payload as GameState;
    expect(state.clues).toEqual({ word: 'база', count: 2 });
    expect(state.status).toBe('playing');
  });

  it('clamps the clue count into 1..8', async () => {
    room = buildStartedRoom();
    const spymaster = room.gameState.players.find((p: Player) => p.role === 'spymaster' && p.team === room.gameState.currentTurn)!;
    const socket = await openSynced(room.id, spymaster.id, room.token);

    socket.send('start_round', { clue: { word: 'сеть', count: 99 } });

    expect(((await socket.next('game_update')).payload as GameState).clues)
      .toEqual({ word: 'сеть', count: 8 });
  });

  it('generates a clue when none is provided', async () => {
    room = buildStartedRoom();
    const spymaster = room.gameState.players.find((p: Player) => p.role === 'spymaster' && p.team === room.gameState.currentTurn)!;
    const socket = await openSynced(room.id, spymaster.id, room.token);

    socket.send('start_round', {});

    const state = (await socket.next('game_update')).payload as GameState;
    expect(state.clues).not.toBeNull();
    expect(typeof state.clues!.word).toBe('string');
  });

  it('ignores start_round from a non-spymaster', async () => {
    room = buildStartedRoom();
    const guesser = room.gameState.players.find((p: Player) => p.role === 'guesser')!;
    const socket = await openSynced(room.id, guesser.id, room.token);

    socket.send('start_round', { clue: { word: 'хак', count: 1 } });
    const messages = await socket.drain();

    expect(messages.some(m => m.type === 'start_round')).toBe(false);
    expect(room.gameState.clues).toBeNull();
  });
});

describe('WebSocket guess', () => {
  it('reveals the card and broadcasts guess_result', async () => {
    room = buildStartedRoom();
    room.gameState.status = 'playing';
    const currentTeam = room.gameState.currentTurn;
    const guesser = room.gameState.players.find((p: Player) => p.team === currentTeam)!;
    const socket = await openSynced(room.id, guesser.id, room.token);

    socket.send('guess', { cardIndex: 0 });

    const payload = (await socket.next('guess_result')).payload as { card: Card; gameOver: boolean };
    expect(payload.card.word).toBe(room.gameState.cards[0].word);
    expect(room.gameState.cards[0].revealed).toBe(true);
  });

  it('broadcasts the final state when the game ends', async () => {
    room = buildStartedRoom();
    room.gameState.status = 'playing';
    const currentTeam = room.gameState.currentTurn;
    const player = room.gameState.players.find((p: Player) => p.team === currentTeam)!;
    const assassinIndex = room.gameState.cards.findIndex((c: Card) => c.color === 'assassin');
    const socket = await openSynced(room.id, player.id, room.token);

    socket.send('guess', { cardIndex: assassinIndex });

    const result = (await socket.next('guess_result')).payload as {
      gameOver: boolean;
      winner?: string;
    };
    expect(result.gameOver).toBe(true);
    expect(result.winner).not.toBe(currentTeam);

    const finalState = (await socket.next('game_update')).payload as GameState;
    expect(finalState.status).toBe('finished');
    expect(finalState.winner).not.toBe(currentTeam);
    expect(finalState.cards[assassinIndex].revealed).toBe(true);
  });

  it('ignores guesses while no clue has been given', async () => {
    room = buildStartedRoom();
    const currentTeam = room.gameState.currentTurn;
    const player = room.gameState.players.find((p: Player) => p.team === currentTeam)!;
    const socket = await openSynced(room.id, player.id, room.token);

    socket.send('guess', { cardIndex: 0 });
    await socket.drain();

    expect(room.gameState.cards[0].revealed).toBe(false);
    expect(room.gameState.status).toBe('spymaster-ready');
  });

  it('ignores guesses from the team that is not on turn', async () => {
    room = buildStartedRoom();
    room.gameState.status = 'playing';
    const otherTeam = room.gameState.currentTurn === 'red' ? 'blue' : 'red';
    const idlePlayer = room.gameState.players.find((p: Player) => p.team === otherTeam)!;
    const socket = await openSynced(room.id, idlePlayer.id, room.token);

    socket.send('guess', { cardIndex: 0 });
    await socket.drain();

    expect(room.gameState.cards[0].revealed).toBe(false);
  });

  it('ignores out-of-range indexes', async () => {
    room = buildStartedRoom();
    room.gameState.status = 'playing';
    const currentTeam = room.gameState.currentTurn;
    const player = room.gameState.players.find((p: Player) => p.team === currentTeam)!;
    const socket = await openSynced(room.id, player.id, room.token);

    socket.send('guess', { cardIndex: 999 });
    socket.send('guess', { cardIndex: -1 });
    await socket.drain();

    expect(room.gameState.cards.every((c: Card) => !c.revealed)).toBe(true);
  });

  it('does not allow revealing the same card twice', async () => {
    room = buildStartedRoom();
    room.gameState.status = 'playing';
    const currentTeam = room.gameState.currentTurn;
    const player = room.gameState.players.find((p: Player) => p.team === currentTeam)!;
    const socket = await openSynced(room.id, player.id, room.token);

    socket.send('guess', { cardIndex: 0 });
    await socket.next('guess_result');

    socket.send('guess', { cardIndex: 0 });
    const messages = await socket.drain();

    expect(messages.filter(m => m.type === 'guess_result').length).toBe(0);
  });
});

describe('WebSocket skip_turn', () => {
  it('passes the turn to the opposing team and clears the clue', async () => {
    room = buildStartedRoom();
    const currentTeam = room.gameState.currentTurn;
    const player = room.gameState.players.find((p: Player) => p.team === currentTeam)!;
    const socket = await openSynced(room.id, player.id, room.token);

    socket.send('skip_turn');

    const state = (await socket.next('game_update')).payload as GameState;
    expect(state.currentTurn).not.toBe(currentTeam);
    expect(state.clues).toBeNull();
  });

  it('ignores skip_turn from the opposing team', async () => {
    room = buildStartedRoom();
    const currentTeam = room.gameState.currentTurn;
    const otherTeam = currentTeam === 'red' ? 'blue' : 'red';
    const idlePlayer = room.gameState.players.find((p: Player) => p.team === otherTeam)!;
    const socket = await openSynced(room.id, idlePlayer.id, room.token);

    socket.send('skip_turn');
    await socket.drain();

    expect(room.gameState.currentTurn).toBe(currentTeam);
  });
});

describe('WebSocket disconnection', () => {
  it('removes the player and notifies the others', async () => {
    room = buildStartedRoom();
    const p1 = await openSynced(room.id, 'p1', room.token);
    const p2 = await Socket.open(room.id, 'p2', room.token);
    await p2.next('game_update');
    await p1.drain(80);

    const listPromise = p1.next('player_list');
    await p2.close();
    await listPromise;

    expect(room.playerConnections.has('p2')).toBe(false);
  });

  it('deletes the room when the last player disconnects', async () => {
    room = buildStartedRoom();
    const roomId = room.id;
    const socket = await openSynced(roomId, 'p1', room.token);

    await socket.close();
    await sleep(80);

    expect(roomManager.get(roomId)).toBeUndefined();
  });
});

describe('WebSocket protocol robustness', () => {
  it('survives malformed JSON and unknown message types', async () => {
    room = buildStartedRoom();
    const socket = await openSynced(room.id, 'p1', room.token);

    socket.sendRaw('this is not json');
    await sleep(80);
    expect(socket.ws.readyState).toBe(WebSocket.OPEN);

    socket.send('unknown_type', {});
    await sleep(80);
    expect(socket.ws.readyState).toBe(WebSocket.OPEN);
  });
});

describe('Spectator mode', () => {
  it('adds a spectator without occupying a team slot', () => {
    room = buildStartedRoom();
    const before = room.gameState.players.filter((p: Player) => p.role !== 'spectator').length;

    roomManager.join(room.id, 'Зритель', 'spec1', true);
    const spectator = room.gameState.players.find((p: Player) => p.id === 'spec1')!;

    expect(spectator.role).toBe('spectator');
    expect(room.gameState.players.filter((p: Player) => p.role !== 'spectator').length).toBe(before);
  });

  it('does not count spectators toward the start requirement', () => {
    const r = roomManager.create('Один', 'p1');
    roomManager.join(r.id, 'Два', 'p2');
    roomManager.join(r.id, 'Зритель1', 'spec1', true);
    roomManager.join(r.id, 'Зритель2', 'spec2', true);

    expect(() => roomManager.start(r.id)).toThrow('Need at least 3 players to start');

    roomManager.join(r.id, 'Три', 'p3');
    expect(() => roomManager.start(r.id)).not.toThrow();
  });

  it('never assigns the spymaster role to a spectator', () => {
    room = buildStartedRoom();
    roomManager.join(room.id, 'Зритель', 'spec1', true);
    roomManager.start(room.id);

    const spectator = room.gameState.players.find((p: Player) => p.id === 'spec1')!;
    expect(spectator.role).toBe('spectator');
  });

  it('lets a spectator connect and receive the board', async () => {
    room = buildStartedRoom();
    roomManager.join(room.id, 'Зритель', 'spec1', true);

    const socket = await Socket.open(room.id, 'spec1', room.token);
    const list = await socket.next('player_list');
    expect((list.payload as Player[]).some((p: Player) => p.role === 'spectator')).toBe(true);

    const state = (await socket.next('game_update')).payload as GameState;
    expect(state.cards.length).toBe(25);
  });

  it('ignores guesses and skips coming from a spectator', async () => {
    room = buildStartedRoom();
    roomManager.join(room.id, 'Зритель', 'spec1', true);
    const socket = await openSynced(room.id, 'spec1', room.token);

    const turnBefore = room.gameState.currentTurn;
    socket.send('guess', { cardIndex: 0 });
    socket.send('skip_turn');
    await socket.drain();

    expect(room.gameState.cards[0].revealed).toBe(false);
    expect(room.gameState.currentTurn).toBe(turnBefore);
  });
});

describe('Turn clock', () => {
  it('arms the deadline when the spymaster gives a clue', async () => {
    room = buildStartedRoom();
    const spymaster = room.gameState.players.find(
      (p: Player) => p.role === 'spymaster' && p.team === room.gameState.currentTurn
    )!;
    const socket = await openSynced(room.id, spymaster.id, room.token);

    expect(room.gameState.turnDeadline).toBeNull();
    socket.send('start_round', { clue: { word: 'стек', count: 1 } });
    const state = (await socket.next('game_update')).payload as GameState;

    expect(typeof state.turnDeadline).toBe('number');
    expect(state.turnDeadline! > Date.now()).toBe(true);
    expect(state.turnDeadline! - Date.now() <= 60_000).toBe(true);
  });

  it('clears the deadline when the turn passes', async () => {
    room = buildStartedRoom();
    const currentTeam = room.gameState.currentTurn;
    const player = room.gameState.players.find((p: Player) => p.team === currentTeam)!;
    const socket = await openSynced(room.id, player.id, room.token);

    roomManager.startTurnClock(room.id);
    expect(room.gameState.turnDeadline).not.toBeNull();

    socket.send('skip_turn');
    await socket.next('game_update');

    expect(room.gameState.turnDeadline).toBeNull();
  });

  it('force-passes the turn once the clock has expired', async () => {
    room = buildStartedRoom();
    const currentTeam = room.gameState.currentTurn;
    const player = room.gameState.players.find((p: Player) => p.team === currentTeam)!;
    const socket = await openSynced(room.id, player.id, room.token);

    // Simulate an already expired round
    room.gameState.clues = { word: 'старый', count: 1 };
    room.gameState.status = 'playing';
    room.gameState.turnDeadline = Date.now() - 1000;
    expect(roomManager.isTurnExpired(room.id)).toBe(true);

    const expiredPromise = socket.next('turn_expired');
    socket.send('guess', { cardIndex: 0 });

    const expired = await expiredPromise;
    expect((expired.payload as { currentTurn: string }).currentTurn).not.toBe(currentTeam);
    expect(room.gameState.currentTurn).not.toBe(currentTeam);
    expect(room.gameState.turnDeadline).toBeNull();
    // The guess that arrived after the deadline must not reveal anything
    expect(room.gameState.cards[0].revealed).toBe(false);
  });

  it('reports an unexpired clock as still running', () => {
    room = buildStartedRoom();
    roomManager.startTurnClock(room.id);
    expect(roomManager.isTurnExpired(room.id)).toBe(false);
    expect(roomManager.isTurnExpired(room.id, Date.now() + 61_000)).toBe(true);
  });
});

