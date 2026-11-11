import { randomUUID } from 'crypto';
import type { ChatMessage, GameEvent, GameState, Player, ThemeId } from '../types';
import {
  createGameState,
  generateCards,
  handleGuess,
  remainingForDeal,
  resolveDefaultTurnDurationMs,
} from './gameLogic';
import type { WebSocket } from 'ws';
import {
  createPersistenceStore,
  NoopStore,
  type PersistenceStore,
  type PersistedRoom,
} from './persistence';

export type RoomStatus = 'waiting' | 'spymaster-ready' | 'playing' | 'finished';

/** Default / fallback; rooms store their own `turnDurationMs` (0 = off). */
export const TURN_DURATION_MS = resolveDefaultTurnDurationMs();
export const EVENT_LOG_MAX = 200;
export const CHAT_HISTORY_MAX = 100;
export const CHAT_TEXT_MAX = 200;

export interface GameRoom {
  id: string;
  /** Legacy field kept for persistence compat; equals the creator's player token. */
  token: string;
  /** Auth secret per playerId — required for WS and privileged REST. */
  playerTokens: Record<string, string>;
  gameState: GameState;
  maxPlayers: number;
  createdAt: number;
  playerConnections: Map<string, WebSocket>;
  chatMessages: ChatMessage[];
}

export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  private store: PersistenceStore;
  private saveTimer: NodeJS.Timeout | null = null;
  private turnTimers = new Map<string, NodeJS.Timeout>();
  /** Wired by the WebSocket layer; invoked when a turn expires on its own. */
  onTurnExpired: ((roomId: string) => void) | null = null;

  constructor(store: PersistenceStore = new NoopStore()) {
    this.store = store;
  }

  /** Restore rooms from the configured store; called once at startup. */
  async restore(): Promise<number> {
    if (!this.store.enabled) return 0;

    const persisted = await this.store.load();
    for (const snapshot of persisted) {
      const theme = snapshot.gameState.theme ?? 'it';
      const clueHistory = snapshot.gameState.clueHistory ?? [];
      const eventLog = snapshot.gameState.eventLog ?? migrateClueHistory(clueHistory);
      const clueTargets = snapshot.gameState.clueTargets ?? [];
      const guessesRemaining = snapshot.gameState.guessesRemaining ?? null;
      const turnDurationMs = snapshot.gameState.turnDurationMs ?? resolveDefaultTurnDurationMs();
      const hostId = snapshot.gameState.hostId
        ?? snapshot.gameState.players[0]?.id
        ?? '';
      const playerTokens = snapshot.playerTokens
        ?? Object.fromEntries(
          snapshot.gameState.players.map((p) => [p.id, snapshot.token])
        );
      this.rooms.set(snapshot.id, {
        ...snapshot,
        playerTokens,
        gameState: {
          ...snapshot.gameState,
          theme,
          clueHistory,
          eventLog,
          clueTargets,
          guessesRemaining,
          turnDurationMs,
          hostId,
        },
        playerConnections: new Map(),
        chatMessages: snapshot.chatMessages ?? [],
      });
    }
    return persisted.length;
  }

  /** Debounced snapshot — cheap to call after every mutation. */
  private schedulePersist(): void {
    if (!this.store.enabled) return;
    if (this.saveTimer) return;

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.persistNow();
    }, 500);
    this.saveTimer.unref?.();
  }

  /** Force an immediate write; used on shutdown and in tests. */
  async persistNow(): Promise<void> {
    if (!this.store.enabled) return;

    const snapshots: PersistedRoom[] = Array.from(this.rooms.values()).map((room) => ({
      id: room.id,
      token: room.token,
      playerTokens: room.playerTokens,
      gameState: room.gameState,
      maxPlayers: room.maxPlayers,
      createdAt: room.createdAt,
      chatMessages: room.chatMessages,
    }));

    await this.store.save(snapshots);
  }

  appendEvent(
    roomId: string,
    event:
      | Omit<Extract<GameEvent, { kind: 'clue' }>, 'id' | 'at'>
      | Omit<Extract<GameEvent, { kind: 'guess' }>, 'id' | 'at'>
      | Omit<Extract<GameEvent, { kind: 'skip' | 'turn_expired' }>, 'id' | 'at'>
      | Omit<Extract<GameEvent, { kind: 'game_over' }>, 'id' | 'at'>
  ): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (!room.gameState.eventLog) room.gameState.eventLog = [];
    const full = {
      ...event,
      id: randomUUID().slice(0, 8),
      at: Date.now(),
    } as GameEvent;
    room.gameState.eventLog.push(full);
    if (room.gameState.eventLog.length > EVENT_LOG_MAX) {
      room.gameState.eventLog = room.gameState.eventLog.slice(-EVENT_LOG_MAX);
    }
    this.schedulePersist();
  }

  setClueTargets(roomId: string, words: string[]): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.gameState.clueTargets = words;
    this.schedulePersist();
  }

  appendChat(roomId: string, playerId: string, text: string): ChatMessage | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const player = room.gameState.players.find((p) => p.id === playerId);
    if (!player) return null;

    const cleaned = text.replace(/\s+/g, ' ').trim().slice(0, CHAT_TEXT_MAX);
    if (!cleaned) return null;

    const message: ChatMessage = {
      id: randomUUID().slice(0, 8),
      at: Date.now(),
      playerId: player.id,
      playerName: player.name,
      text: cleaned,
    };
    room.chatMessages.push(message);
    if (room.chatMessages.length > CHAT_HISTORY_MAX) {
      room.chatMessages = room.chatMessages.slice(-CHAT_HISTORY_MAX);
    }
    this.schedulePersist();
    return message;
  }

  get persistenceLabel(): string {
    return this.store.label;
  }

  create(
    playerName: string,
    playerId: string,
    theme: ThemeId = 'it',
    turnDurationMs: number = resolveDefaultTurnDurationMs()
  ): GameRoom {
    let roomId = generateRoomId();
    // Ensure uniqueness
    while (this.rooms.has(roomId)) {
      roomId = generateRoomId();
    }
    const token = generateToken();

    const player: Player = {
      id: playerId,
      name: playerName || `Player-${playerId}`,
      team: 'red',
      role: 'guesser',
    };

    const gameState = createGameState(roomId, [player], theme, playerId);
    gameState.turnDurationMs = Math.max(0, Math.round(turnDurationMs));

    const room: GameRoom = {
      id: roomId,
      token,
      playerTokens: { [playerId]: token },
      gameState,
      maxPlayers: 6,
      createdAt: Date.now(),
      playerConnections: new Map(),
      chatMessages: [],
    };

    this.rooms.set(roomId, room);
    this.schedulePersist();
    return room;
  }

  /** Issue or look up the auth token for a player in the room. */
  tokenFor(roomId: string, playerId: string): string | undefined {
    return this.rooms.get(roomId)?.playerTokens[playerId];
  }

  /** True when playerId is a member and token matches that player. */
  authenticate(roomId: string, playerId: string, token: string | null | undefined): boolean {
    const room = this.rooms.get(roomId);
    if (!room || !token || !playerId) return false;
    if (!room.gameState.players.some((p) => p.id === playerId)) return false;
    return room.playerTokens[playerId] === token;
  }

  get(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  delete(roomId: string): void {
    this.rooms.delete(roomId);
    this.clearTurnTimer(roomId);
    this.schedulePersist();
  }

  join(roomId: string, playerName: string, playerId: string, asSpectator = false): GameRoom {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (!asSpectator && this.activePlayerCount(room) >= room.maxPlayers) {
      throw new Error('Room is full');
    }

    const existingPlayer = room.gameState.players.find(
      (p: Player) => p.name.toLowerCase() === playerName.toLowerCase()
    );
    if (existingPlayer) {
      throw new Error('Player name already exists');
    }

    const player: Player = {
      id: playerId,
      name: playerName,
      team: 'blue',
      role: asSpectator ? 'spectator' : 'guesser',
    };

    if (!asSpectator) {
      // Balance teams; spectators never occupy a team slot
      const redCount = room.gameState.players.filter((p: Player) => p.team === 'red').length;
      const blueCount = room.gameState.players.filter((p: Player) => p.team === 'blue').length;

      if (blueCount >= redCount && redCount < 3) {
        player.team = 'red';
      } else if (redCount >= blueCount && blueCount < 3) {
        player.team = 'blue';
      }
    }

    room.gameState.players.push(player);
    room.playerTokens[playerId] = generateToken();
    this.schedulePersist();
    return room;
  }

  /** Number of participants counted toward the room capacity (spectators excluded). */
  private activePlayerCount(room: GameRoom): number {
    return room.gameState.players.filter((p: Player) => p.role !== 'spectator').length;
  }

  private teamActiveCount(room: GameRoom, team: 'red' | 'blue'): number {
    return room.gameState.players.filter(
      (p: Player) => p.team === team && p.role !== 'spectator'
    ).length;
  }

  /**
   * Sit at a team seat while the lobby is waiting.
   * Claiming spymaster demotes the previous spymaster of that team to guesser.
   */
  claimSeat(
    roomId: string,
    playerId: string,
    team: 'red' | 'blue',
    role: 'spymaster' | 'guesser'
  ): GameRoom {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }
    if (room.gameState.status !== 'waiting') {
      throw new Error('Game already started');
    }

    const player = room.gameState.players.find((p: Player) => p.id === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    const wasSpectator = player.role === 'spectator';
    if (wasSpectator && this.activePlayerCount(room) >= room.maxPlayers) {
      throw new Error('Room is full');
    }

    const leavingTeam = !wasSpectator && player.team !== team;
    const joiningTeam = wasSpectator || leavingTeam;
    if (joiningTeam && this.teamActiveCount(room, team) >= 3) {
      throw new Error('Team is full');
    }

    if (role === 'spymaster') {
      for (const other of room.gameState.players) {
        if (other.id !== playerId && other.team === team && other.role === 'spymaster') {
          other.role = 'guesser';
        }
      }
    }

    player.team = team;
    player.role = role;
    this.schedulePersist();
    return room;
  }

  start(roomId: string, byPlayerId?: string): GameRoom {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.gameState.status !== 'waiting') {
      throw new Error('Game already started');
    }

    if (byPlayerId && room.gameState.hostId && byPlayerId !== room.gameState.hostId) {
      throw new Error('Only host can start');
    }

    if (this.activePlayerCount(room) < 3) {
      throw new Error('Need at least 3 players to start');
    }

    const redPlayers = room.gameState.players.filter(
      (p: Player) => p.team === 'red' && p.role !== 'spectator'
    );
    const bluePlayers = room.gameState.players.filter(
      (p: Player) => p.team === 'blue' && p.role !== 'spectator'
    );

    if (redPlayers.length === 0 || bluePlayers.length === 0) {
      throw new Error('Both teams need at least one player');
    }

    // Keep seats players already claimed; fill missing spymasters from the first seat.
    if (!redPlayers.some((p: Player) => p.role === 'spymaster')) {
      redPlayers[0].role = 'spymaster';
    }
    if (!bluePlayers.some((p: Player) => p.role === 'spymaster')) {
      bluePlayers[0].role = 'spymaster';
    }

    const startingTeam = Math.random() < 0.5 ? 'red' : 'blue';
    room.gameState.cards = generateCards(room.gameState.theme ?? 'it', startingTeam);
    room.gameState.remainingCards = remainingForDeal(startingTeam);
    room.gameState.status = 'spymaster-ready';
    room.gameState.currentTurn = startingTeam;
    room.gameState.clues = null;
    room.gameState.clueHistory = [];
    room.gameState.eventLog = [];
    room.gameState.clueTargets = [];
    room.gameState.guessesRemaining = null;
    room.gameState.turnDeadline = null;
    room.gameState.winner = null;
    this.clearTurnTimer(roomId);

    this.schedulePersist();
    return room;
  }

  /** Arm the turn clock when a clue is given. No-op when turnDurationMs is 0. */
  startTurnClock(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const duration = room.gameState.turnDurationMs ?? TURN_DURATION_MS;
    if (!duration || duration <= 0) {
      room.gameState.turnDeadline = null;
      this.clearTurnTimer(roomId);
      this.schedulePersist();
      return;
    }
    room.gameState.turnDeadline = Date.now() + duration;
    this.armTurnTimer(roomId, duration);
    this.schedulePersist();
  }

  /** Clear the turn clock (turn ended either by guess-out, skip or expiry). */
  clearTurnClock(roomId: string): void {
    const room = this.rooms.get(roomId);
    this.clearTurnTimer(roomId);
    if (!room) return;
    room.gameState.turnDeadline = null;
    this.schedulePersist();
  }

  private armTurnTimer(roomId: string, durationMs: number = TURN_DURATION_MS): void {
    this.clearTurnTimer(roomId);
    if (!durationMs || durationMs <= 0) return;
    const timer = setTimeout(() => {
      this.turnTimers.delete(roomId);
      const room = this.rooms.get(roomId);
      if (!room || room.gameState.turnDeadline === null) return;
      if (room.gameState.status !== 'playing') return;
      this.passTurn(roomId);
      this.onTurnExpired?.(roomId);
    }, durationMs);
    timer.unref?.();
    this.turnTimers.set(roomId, timer);
  }

  private clearTurnTimer(roomId: string): void {
    const timer = this.turnTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(roomId);
    }
  }

  /** True when the active round has run out of time. */
  isTurnExpired(roomId: string, now: number = Date.now()): boolean {
    const room = this.rooms.get(roomId);
    if (!room || room.gameState.turnDeadline === null) return false;
    return now >= room.gameState.turnDeadline;
  }

  /**
   * Hand the turn to the other team.
   * The previous clue and the 60s clock belong to the team that just finished,
   * so both are cleared and the next spymaster must give a new clue.
   */
  passTurn(roomId: string): GameRoom {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    room.gameState.currentTurn = room.gameState.currentTurn === 'red' ? 'blue' : 'red';
    room.gameState.clues = null;
    room.gameState.clueTargets = [];
    room.gameState.guessesRemaining = null;
    room.gameState.turnDeadline = null;
    room.gameState.status = 'spymaster-ready';
    this.clearTurnTimer(roomId);

    this.schedulePersist();
    return room;
  }

  guess(roomId: string, cardIndex: number) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (cardIndex < 0 || cardIndex >= room.gameState.cards.length) {
      throw new Error('Invalid card index');
    }

    if (room.gameState.cards[cardIndex].revealed) {
      throw new Error('Card already revealed');
    }

    if (room.gameState.status === 'finished') {
      throw new Error('Game is finished');
    }

    if (room.gameState.status !== 'playing') {
      throw new Error('Round has not started');
    }

    if (room.gameState.guessesRemaining !== null && room.gameState.guessesRemaining <= 0) {
      throw new Error('No guesses remaining');
    }

    const result = handleGuess(room.gameState, cardIndex);
    room.gameState = result.newState;

    // A turn that changed hands (miss, civilian, opponent card) or ended the game
    // must not keep running the previous team's clock.
    if (result.gameOver) {
      room.gameState.turnDeadline = null;
      room.gameState.clueTargets = [];
      room.gameState.guessesRemaining = null;
      this.clearTurnTimer(roomId);
    } else if (room.gameState.currentTurn !== result.previousTurn) {
      room.gameState.turnDeadline = null;
      room.gameState.clues = null;
      room.gameState.clueTargets = [];
      room.gameState.guessesRemaining = null;
      room.gameState.status = 'spymaster-ready';
      this.clearTurnTimer(roomId);
    } else {
      // Correct guess — classic limit is clue.count + 1
      const left = Math.max(0, (room.gameState.guessesRemaining ?? 1) - 1);
      room.gameState.guessesRemaining = left;
      if (left <= 0) {
        room.gameState.currentTurn = room.gameState.currentTurn === 'red' ? 'blue' : 'red';
        room.gameState.clues = null;
        room.gameState.clueTargets = [];
        room.gameState.guessesRemaining = null;
        room.gameState.turnDeadline = null;
        room.gameState.status = 'spymaster-ready';
        this.clearTurnTimer(roomId);
      }
    }

    this.schedulePersist();

    return {
      gameOver: result.gameOver,
      winner: result.winner,
      cardRevealed: result.cardRevealed,
      previousTurn: result.previousTurn,
    };
  }

  listAll(): Array<{
    id: string;
    playerCount: number;
    maxPlayers: number;
    status: RoomStatus;
    theme: ThemeId;
  }> {
    return Array.from(this.rooms.values()).map(room => ({
      id: room.id,
      playerCount: room.gameState.players.length,
      maxPlayers: room.maxPlayers,
      status: room.gameState.status,
      theme: room.gameState.theme ?? 'it',
    }));
  }

  cleanEmptyRooms(): void {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.playerConnections.size === 0) {
        this.rooms.delete(roomId);
        this.clearTurnTimer(roomId);
      }
    }
    this.schedulePersist();
  }
}

function migrateClueHistory(clueHistory: GameState['clueHistory']): GameEvent[] {
  return clueHistory.map((entry, index) => ({
    id: `legacy-${index}`,
    at: 0,
    kind: 'clue' as const,
    team: entry.team,
    word: entry.word,
    count: entry.count,
    targetWords: [],
  }));
}

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function generateToken(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16);
}

export const roomManager = new RoomManager(createPersistenceStore());

// Periodic cleanup of empty rooms (every 30 minutes)
setInterval(() => roomManager.cleanEmptyRooms(), 30 * 60 * 1000).unref();
