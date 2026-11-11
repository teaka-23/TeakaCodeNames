import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import { Server } from 'http';
import {
  Player,
  ServerMessageType,
  WsMessage,
  GameUpdateMessage,
  GuessResultMessage,
  PlayerListMessage,
  StartRoundMessage,
} from '../types';
import { roomManager, GameRoom } from '../utils/roomManager';

/** Delay before wiping a room with no open sockets. Override in tests. */
export const EMPTY_ROOM_GRACE_MS = Number(process.env.EMPTY_ROOM_GRACE_MS) || 60_000;

/**
 * Attach the game socket at `/ws?roomId&playerId&token`.
 *
 * The room token is checked on connect. After that the server accepts
 * `guess`, `skip_turn`, `start_round` and `claim_seat`, and answers with
 * `guess_result`, `start_round`, `turn_expired`, `player_list` and a full
 * `game_update`. One room shares a single token, so the payload is the same
 * for every client.
 */
export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // A turn whose clock ran out passes to the other team without any client action
  roomManager.onTurnExpired = (roomId: string) => {
    const room = roomManager.get(roomId);
    if (!room) return;
    broadcastToRoom(room, {
      type: 'turn_expired',
      payload: { currentTurn: room.gameState.currentTurn },
    });
    broadcastToRoom(room, {
      type: 'game_update',
      payload: room.gameState,
    } as GameUpdateMessage);
  };

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const params = new URL(req.url || '', 'ws://localhost').searchParams;
    const roomId = params.get('roomId')?.toUpperCase();
    const playerId = params.get('playerId');
    const token = params.get('token');

    if (!roomId || !playerId) {
      ws.close(4000, 'roomId and playerId are required');
      return;
    }

    const room = roomManager.get(roomId);
    if (!room) {
      ws.close(4001, 'Room not found');
      return;
    }

    if (!token || token !== room.token) {
      ws.close(4003, 'Invalid room token');
      return;
    }

    room.playerConnections.set(playerId, ws);

    sendToPlayer(ws, {
      type: 'player_list',
      payload: room.gameState.players,
    } as PlayerListMessage);

    sendToPlayer(ws, {
      type: 'game_update',
      payload: room.gameState,
    } as GameUpdateMessage);

    ws.on('message', (data) => {
      try {
        const message: WsMessage = JSON.parse(data.toString());
        handleWebSocketMessage(room, playerId, message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      room.playerConnections.delete(playerId);

      if (room.playerConnections.size === 0) {
        // Brief reconnects and lobby↔room navigations must not wipe an empty room.
        setTimeout(() => {
          const current = roomManager.get(roomId);
          if (current && current.playerConnections.size === 0) {
            roomManager.delete(roomId);
          }
        }, EMPTY_ROOM_GRACE_MS).unref?.();
      } else {
        broadcastToRoom(room, {
          type: 'player_list',
          payload: room.gameState.players,
        } as PlayerListMessage);
      }
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for player ${playerId}:`, error);
      ws.close(1011, 'Internal error');
    });
  });

  console.log('WebSocket server initialized');
}

/** Push the current room state to every open socket (used after REST start). */
export function broadcastRoomState(roomId: string): void {
  const room = roomManager.get(roomId);
  if (!room) return;
  broadcastToRoom(room, {
    type: 'game_update',
    payload: room.gameState,
  } as GameUpdateMessage);
}

function handleWebSocketMessage(room: GameRoom, playerId: string, message: WsMessage) {
  switch (message.type) {
    case 'guess':
      handleGuessMessage(room, playerId, message);
      break;
    case 'skip_turn':
      handleSkipTurn(room, playerId);
      break;
    case 'start_round':
      handleStartRound(room, playerId, message);
      break;
    case 'claim_seat':
      handleClaimSeat(room, playerId, message);
      break;
    default:
      console.log('Unknown message type:', message.type);
  }
}

function handleClaimSeat(room: GameRoom, playerId: string, message: WsMessage) {
  const payload = message.payload as { team?: unknown; role?: unknown } | undefined;
  const team = payload?.team;
  const role = payload?.role;
  if ((team !== 'red' && team !== 'blue') || (role !== 'spymaster' && role !== 'guesser')) {
    return;
  }

  try {
    roomManager.claimSeat(room.id, playerId, team, role);
    broadcastToRoom(room, {
      type: 'game_update',
      payload: room.gameState,
    } as GameUpdateMessage);
  } catch (error) {
    console.error('Error claiming seat:', error);
  }
}

function handleGuessMessage(room: GameRoom, playerId: string, message: WsMessage) {
  const player = room.gameState.players.find((p: Player) => p.id === playerId);
  if (!player || player.role === 'spectator' || player.team !== room.gameState.currentTurn) {
    return;
  }

  if (expireTurnIfNeeded(room)) {
    return;
  }

  if (room.gameState.status !== 'playing') {
    return;
  }

  const payload = message.payload as { cardIndex: number };
  const cardIndex = typeof payload?.cardIndex === 'number' ? payload.cardIndex : -1;

  try {
    const { gameOver, winner, cardRevealed, previousTurn } = roomManager.guess(room.id, cardIndex);

    broadcastToRoom(room, {
      type: 'guess_result',
      payload: {
        card: cardRevealed,
        correct: cardRevealed.color === previousTurn,
        gameOver,
        winner,
      },
    } as GuessResultMessage);

    // Always broadcast the state — including on game over, so clients flip the
    // board, see the winner and stop accepting guesses.
    broadcastToRoom(room, {
      type: 'game_update',
      payload: room.gameState,
    } as GameUpdateMessage);
  } catch (error) {
    console.error('Error handling guess:', error);
  }
}

function handleSkipTurn(room: GameRoom, playerId: string) {
  const player = room.gameState.players.find((p: Player) => p.id === playerId);
  if (!player || player.role === 'spectator' || player.team !== room.gameState.currentTurn) {
    return;
  }

  if (expireTurnIfNeeded(room)) {
    return;
  }

  roomManager.passTurn(room.id);

  broadcastToRoom(room, {
    type: 'game_update',
    payload: room.gameState,
  } as GameUpdateMessage);
}

/**
 * Enforces the 60s turn clock. Returns true when the turn was force-passed,
 * so callers can stop processing the incoming action.
 */
function expireTurnIfNeeded(room: GameRoom): boolean {
  if (!roomManager.isTurnExpired(room.id)) {
    return false;
  }

  roomManager.passTurn(room.id);

  broadcastToRoom(room, {
    type: 'turn_expired',
    payload: { currentTurn: room.gameState.currentTurn },
  });

  broadcastToRoom(room, {
    type: 'game_update',
    payload: room.gameState,
  } as GameUpdateMessage);

  return true;
}

function normalizeClueWord(word: string): string {
  return word.trim().toLocaleLowerCase('ru-RU');
}

function handleStartRound(room: GameRoom, playerId: string, message?: WsMessage) {
  const player = room.gameState.players.find((p: Player) => p.id === playerId);
  if (!player || player.role !== 'spymaster' || player.team !== room.gameState.currentTurn) {
    return;
  }

  if (room.gameState.status !== 'spymaster-ready') {
    return;
  }

  const provided = (message?.payload as { clue?: { word?: unknown; count?: unknown } } | undefined)?.clue;
  if (!provided || typeof provided.word !== 'string' || !provided.word.trim()) {
    return;
  }

  const clueWord = provided.word.trim().slice(0, 30);
  const rawCount = Number(provided.count);
  const count = Number.isFinite(rawCount) ? Math.min(Math.max(Math.round(rawCount), 1), 8) : 1;

  const normalized = normalizeClueWord(clueWord);
  const matchesBoard = room.gameState.cards.some(
    (card) => normalizeClueWord(card.word) === normalized
  );
  if (matchesBoard) {
    return;
  }

  room.gameState.clues = { word: clueWord, count };
  if (!room.gameState.clueHistory) {
    room.gameState.clueHistory = [];
  }
  room.gameState.clueHistory.push({
    word: clueWord,
    count,
    team: room.gameState.currentTurn,
  });
  room.gameState.status = 'playing';
  roomManager.startTurnClock(room.id);

  const startRoundMsg: StartRoundMessage = {
    type: 'start_round',
    payload: {
      clue: { word: clueWord, count },
      currentTurn: room.gameState.currentTurn,
    },
  };

  broadcastToRoom(room, startRoundMsg);
  broadcastToRoom(room, {
    type: 'game_update',
    payload: room.gameState,
  } as GameUpdateMessage);
}

function sendToPlayer(ws: WebSocket, message: ServerMessageType) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcastToRoom(room: GameRoom, message: ServerMessageType) {
  for (const [, ws] of room.playerConnections) {
    sendToPlayer(ws, message);
  }
}
