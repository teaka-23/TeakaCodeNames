import { randomUUID } from 'crypto';
import type { GameState, Player, ThemeId } from '../types';
import { createGameState, generateCards, handleGuess } from './gameLogic';
import type { WebSocket } from 'ws';
import {
  createPersistenceStore,
  NoopStore,
  type PersistenceStore,
  type PersistedRoom,
} from './persistence';

export type RoomStatus = 'waiting' | 'spymaster-ready' | 'playing' | 'finished';

export const TURN_DURATION_MS = 60_000;

export interface GameRoom {
  id: string;
  token: string;
  gameState: GameState;
  maxPlayers: number;
  createdAt: number;
  playerConnections: Map<string, WebSocket>;
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
      this.rooms.set(snapshot.id, {
        ...snapshot,
        gameState: { ...snapshot.gameState, theme, clueHistory },
        playerConnections: new Map(),
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
      gameState: room.gameState,
      maxPlayers: room.maxPlayers,
      createdAt: room.createdAt,
    }));

    await this.store.save(snapshots);
  }

  get persistenceLabel(): string {
    return this.store.label;
  }

  create(playerName: string, playerId: string, theme: ThemeId = 'it'): GameRoom {
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

    const gameState = createGameState(roomId, [player], theme);

    const room: GameRoom = {
      id: roomId,
      token,
      gameState,
      maxPlayers: 6,
      createdAt: Date.now(),
      playerConnections: new Map(),
    };

    this.rooms.set(roomId, room);
    this.schedulePersist();
    return room;
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

  start(roomId: string): GameRoom {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.gameState.status !== 'waiting') {
      throw new Error('Game already started');
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

    room.gameState.cards = generateCards(room.gameState.theme ?? 'it');
    room.gameState.status = 'spymaster-ready';
    room.gameState.currentTurn = Math.random() < 0.5 ? 'red' : 'blue';
    room.gameState.clues = null;
    room.gameState.clueHistory = [];
    room.gameState.turnDeadline = null;
    room.gameState.winner = null;
    this.clearTurnTimer(roomId);

    this.schedulePersist();
    return room;
  }

  /** Arm the 60s turn clock. Called when a round actually starts (a clue is given). */
  startTurnClock(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.gameState.turnDeadline = Date.now() + TURN_DURATION_MS;
    this.armTurnTimer(roomId);
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

  private armTurnTimer(roomId: string): void {
    this.clearTurnTimer(roomId);
    const timer = setTimeout(() => {
      this.turnTimers.delete(roomId);
      const room = this.rooms.get(roomId);
      if (!room || room.gameState.turnDeadline === null) return;
      if (room.gameState.status !== 'playing') return;
      this.passTurn(roomId);
      this.onTurnExpired?.(roomId);
    }, TURN_DURATION_MS);
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

    const result = handleGuess(room.gameState, cardIndex);
    room.gameState = result.newState;

    // A turn that changed hands (miss, civilian, opponent card) or ended the game
    // must not keep running the previous team's clock.
    if (result.gameOver) {
      room.gameState.turnDeadline = null;
      this.clearTurnTimer(roomId);
    } else if (room.gameState.currentTurn !== result.previousTurn) {
      room.gameState.turnDeadline = null;
      room.gameState.clues = null;
      room.gameState.status = 'spymaster-ready';
      this.clearTurnTimer(roomId);
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
