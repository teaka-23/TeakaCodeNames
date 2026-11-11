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
  ChatMessagePayload,
  ChatHistoryMessage,
  ErrorMessage,
} from '../types';
import { roomManager, GameRoom } from '../utils/roomManager';
import { gameStateForViewer } from '../utils/gameStateView';

/** Delay before wiping a room with no open sockets. Override in tests. */
export const EMPTY_ROOM_GRACE_MS = Number(process.env.EMPTY_ROOM_GRACE_MS) || 60_000;

/** Soft cap: messages per player per rolling window. */
const WS_RATE_LIMIT = Number(process.env.WS_RATE_LIMIT) || 30;
const WS_RATE_WINDOW_MS = Number(process.env.WS_RATE_WINDOW_MS) || 10_000;

const wsBuckets = new Map<string, { count: number; resetAt: number }>();

function allowWsMessage(playerId: string): boolean {
  const now = Date.now();
  const key = playerId;
  let bucket = wsBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WS_RATE_WINDOW_MS };
    wsBuckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count <= WS_RATE_LIMIT;
}

function sendError(ws: WebSocket, code: string, message: string) {
  sendToPlayer(ws, { type: 'error', payload: { code, message } } as ErrorMessage);
}

/**
 * Attach the game socket at `/ws?roomId&playerId&token`.
 *
 * Accepts `guess`, `skip_turn`, `start_round`, `claim_seat`, `mark_targets`, `chat`.
 */
export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  roomManager.onTurnExpired = (roomId: string) => {
    const room = roomManager.get(roomId);
    if (!room) return;
    const previousTeam = room.gameState.currentTurn === 'red' ? 'blue' : 'red';
    roomManager.appendEvent(roomId, { kind: 'turn_expired', team: previousTeam });
    broadcastToRoom(room, {
      type: 'turn_expired',
      payload: { currentTurn: room.gameState.currentTurn },
    });
    broadcastGameUpdate(room);
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

    if (!room.gameState.players.some((p) => p.id === playerId)) {
      ws.close(4002, 'Player not in room');
      return;
    }

    if (!roomManager.authenticate(roomId, playerId, token)) {
      ws.close(4003, 'Invalid player token');
      return;
    }

    room.playerConnections.set(playerId, ws);

    sendToPlayer(ws, {
      type: 'player_list',
      payload: room.gameState.players,
    } as PlayerListMessage);

    sendToPlayer(ws, {
      type: 'game_update',
      payload: gameStateForViewer(room.gameState, playerId),
    } as GameUpdateMessage);

    sendToPlayer(ws, {
      type: 'chat_history',
      payload: { messages: room.chatMessages },
    } as ChatHistoryMessage);

    ws.on('message', (data) => {
      try {
        if (!allowWsMessage(playerId)) {
          sendError(ws, 'rate_limited', 'Слишком много сообщений, подождите');
          return;
        }
        const message: WsMessage = JSON.parse(data.toString());
        handleWebSocketMessage(room, playerId, message, ws);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        sendError(ws, 'bad_message', 'Некорректное сообщение');
      }
    });

    ws.on('close', () => {
      room.playerConnections.delete(playerId);

      if (room.playerConnections.size === 0) {
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
  broadcastGameUpdate(room);
}

function handleWebSocketMessage(
  room: GameRoom,
  playerId: string,
  message: WsMessage,
  ws: WebSocket
) {
  switch (message.type) {
    case 'guess':
      handleGuessMessage(room, playerId, message, ws);
      break;
    case 'skip_turn':
      handleSkipTurn(room, playerId, ws);
      break;
    case 'start_round':
      handleStartRound(room, playerId, message, ws);
      break;
    case 'claim_seat':
      handleClaimSeat(room, playerId, message, ws);
      break;
    case 'mark_targets':
      handleMarkTargets(room, playerId, message, ws);
      break;
    case 'chat':
      handleChat(room, playerId, message, ws);
      break;
    default:
      sendError(ws, 'unknown_type', 'Неизвестный тип сообщения');
  }
}

function handleClaimSeat(room: GameRoom, playerId: string, message: WsMessage, ws: WebSocket) {
  const payload = message.payload as { team?: unknown; role?: unknown } | undefined;
  const team = payload?.team;
  const role = payload?.role;
  if ((team !== 'red' && team !== 'blue') || (role !== 'spymaster' && role !== 'guesser')) {
    sendError(ws, 'invalid_seat', 'Некорректное место');
    return;
  }

  try {
    roomManager.claimSeat(room.id, playerId, team, role);
    broadcastGameUpdate(room);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Не удалось занять место';
    sendError(ws, 'claim_failed', msg);
  }
}

function handleMarkTargets(room: GameRoom, playerId: string, message: WsMessage, ws: WebSocket) {
  const player = room.gameState.players.find((p: Player) => p.id === playerId);
  if (!player || player.role !== 'spymaster' || player.team !== room.gameState.currentTurn) {
    sendError(ws, 'forbidden', 'Отмечать цели может только шпион текущего хода');
    return;
  }
  if (room.gameState.status !== 'spymaster-ready') {
    sendError(ws, 'wrong_phase', 'Сейчас нельзя отмечать цели');
    return;
  }

  const raw = (message.payload as { words?: unknown } | undefined)?.words;
  if (!Array.isArray(raw)) {
    sendError(ws, 'invalid_targets', 'Некорректный список целей');
    return;
  }

  const boardWords = new Set(
    room.gameState.cards.filter((c) => !c.revealed).map((c) => c.word)
  );
  const words: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const word = item.trim();
    if (!word || !boardWords.has(word) || words.includes(word)) continue;
    words.push(word);
    if (words.length >= 8) break;
  }

  roomManager.setClueTargets(room.id, words);
  broadcastGameUpdate(room);
}

function handleChat(room: GameRoom, playerId: string, message: WsMessage, ws: WebSocket) {
  const text = (message.payload as { text?: unknown } | undefined)?.text;
  if (typeof text !== 'string') {
    sendError(ws, 'invalid_chat', 'Пустое сообщение');
    return;
  }

  const saved = roomManager.appendChat(room.id, playerId, text);
  if (!saved) {
    sendError(ws, 'invalid_chat', 'Сообщение не принято');
    return;
  }

  broadcastToRoom(room, {
    type: 'chat',
    payload: saved,
  } as ChatMessagePayload);
}

function handleGuessMessage(room: GameRoom, playerId: string, message: WsMessage, ws: WebSocket) {
  const player = room.gameState.players.find((p: Player) => p.id === playerId);
  if (!player || player.role === 'spectator' || player.team !== room.gameState.currentTurn) {
    sendError(ws, 'forbidden', 'Сейчас нельзя угадывать');
    return;
  }

  if (expireTurnIfNeeded(room)) {
    return;
  }

  if (room.gameState.status !== 'playing') {
    sendError(ws, 'wrong_phase', 'Раунд ещё не начат');
    return;
  }

  const payload = message.payload as { cardIndex: number };
  const cardIndex = typeof payload?.cardIndex === 'number' ? payload.cardIndex : -1;

  try {
    const { gameOver, winner, cardRevealed, previousTurn } = roomManager.guess(room.id, cardIndex);

    const revealedColor = cardRevealed.color;
    if (!revealedColor) {
      return;
    }

    roomManager.appendEvent(room.id, {
      kind: 'guess',
      team: previousTurn,
      playerId: player.id,
      playerName: player.name,
      word: cardRevealed.word,
      color: revealedColor,
      correct: revealedColor === previousTurn,
    });

    if (gameOver) {
      roomManager.appendEvent(room.id, {
        kind: 'game_over',
        winner: winner ?? null,
      });
    }

    broadcastToRoom(room, {
      type: 'guess_result',
      payload: {
        card: { ...cardRevealed, color: revealedColor },
        correct: revealedColor === previousTurn,
        gameOver,
        winner,
      },
    } as GuessResultMessage);

    broadcastGameUpdate(room);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Не удалось угадать';
    sendError(ws, 'guess_failed', msg);
  }
}

function handleSkipTurn(room: GameRoom, playerId: string, ws: WebSocket) {
  const player = room.gameState.players.find((p: Player) => p.id === playerId);
  if (!player || player.role === 'spectator' || player.team !== room.gameState.currentTurn) {
    sendError(ws, 'forbidden', 'Сейчас нельзя пропустить ход');
    return;
  }

  if (expireTurnIfNeeded(room)) {
    return;
  }

  const team = room.gameState.currentTurn;
  roomManager.passTurn(room.id);
  roomManager.appendEvent(room.id, { kind: 'skip', team });

  broadcastGameUpdate(room);
}

function expireTurnIfNeeded(room: GameRoom): boolean {
  if (!roomManager.isTurnExpired(room.id)) {
    return false;
  }

  const team = room.gameState.currentTurn;
  roomManager.passTurn(room.id);
  roomManager.appendEvent(room.id, { kind: 'turn_expired', team });

  broadcastToRoom(room, {
    type: 'turn_expired',
    payload: { currentTurn: room.gameState.currentTurn },
  });

  broadcastGameUpdate(room);
  return true;
}

function normalizeClueWord(word: string): string {
  return word.trim().toLocaleLowerCase('ru-RU');
}

function handleStartRound(room: GameRoom, playerId: string, message: WsMessage | undefined, ws: WebSocket) {
  const player = room.gameState.players.find((p: Player) => p.id === playerId);
  if (!player || player.role !== 'spymaster' || player.team !== room.gameState.currentTurn) {
    sendError(ws, 'forbidden', 'Подсказку даёт шпион текущего хода');
    return;
  }

  if (room.gameState.status !== 'spymaster-ready') {
    sendError(ws, 'wrong_phase', 'Сейчас нельзя давать подсказку');
    return;
  }

  const targets = room.gameState.clueTargets ?? [];
  if (targets.length < 1) {
    sendError(ws, 'no_targets', 'Сначала отметьте цели на доске');
    return;
  }

  const provided = (message?.payload as { clue?: { word?: unknown; count?: unknown } } | undefined)?.clue;
  if (!provided || typeof provided.word !== 'string' || !provided.word.trim()) {
    sendError(ws, 'invalid_clue', 'Введите слово-подсказку');
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
    sendError(ws, 'invalid_clue', 'Подсказка не должна совпадать со словом на доске');
    return;
  }

  const targetWords = [...targets];
  room.gameState.clues = { word: clueWord, count };
  // Classic Codenames: up to count + 1 guesses on a clue.
  room.gameState.guessesRemaining = count + 1;
  if (!room.gameState.clueHistory) {
    room.gameState.clueHistory = [];
  }
  room.gameState.clueHistory.push({
    word: clueWord,
    count,
    team: room.gameState.currentTurn,
  });
  roomManager.appendEvent(room.id, {
    kind: 'clue',
    team: room.gameState.currentTurn,
    word: clueWord,
    count,
    targetWords,
  });
  room.gameState.clueTargets = [];
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
  broadcastGameUpdate(room);
}

function broadcastGameUpdate(room: GameRoom) {
  for (const [playerId, ws] of room.playerConnections) {
    sendToPlayer(ws, {
      type: 'game_update',
      payload: gameStateForViewer(room.gameState, playerId),
    } as GameUpdateMessage);
  }
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
