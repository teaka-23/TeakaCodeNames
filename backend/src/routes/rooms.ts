import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { roomManager } from '../utils/roomManager';
import { dealEntries, isThemeId, THEME_META } from '../themes';
import { broadcastRoomState } from '../utils/webSocketHandler';
import { gameStateForViewer } from '../utils/gameStateView';

const router = Router();

const CreateRoomSchema = z.object({
  playerName: z.string().trim().min(1).max(20),
  theme: z.enum(['it', 'football', 'yoga', 'movies']).optional(),
  /** Turn length in seconds; 0 disables the timer. Default from server env. */
  turnSeconds: z.number().int().min(0).max(300).optional(),
});

const JoinRoomSchema = z.object({
  playerName: z.string().trim().min(1).max(20),
  spectate: z.boolean().optional(),
});

const ClaimSeatSchema = z.object({
  playerId: z.string().trim().min(1),
  token: z.string().trim().min(1),
  team: z.enum(['red', 'blue']),
  role: z.enum(['spymaster', 'guesser']),
});

const StartRoomSchema = z.object({
  playerId: z.string().trim().min(1),
  token: z.string().trim().min(1),
});

function readToken(req: Request): string {
  const header = req.header('x-room-token');
  if (header?.trim()) return header.trim();
  const fromQuery = typeof req.query.token === 'string' ? req.query.token : '';
  return fromQuery.trim();
}

// POST /api/rooms - Create new room
router.post('/rooms', (req: Request, res: Response) => {
  const parsed = CreateRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    const themeIssue = parsed.error.issues.some((issue) => issue.path[0] === 'theme');
    res.status(400).json({
      error: themeIssue ? 'Неизвестная тема' : 'Некорректное имя игрока (1-20 символов)',
    });
    return;
  }

  try {
    const playerId = randomUUID().slice(0, 8);
    const turnDurationMs = parsed.data.turnSeconds === undefined
      ? undefined
      : parsed.data.turnSeconds * 1000;
    const room = roomManager.create(
      parsed.data.playerName,
      playerId,
      parsed.data.theme ?? 'it',
      turnDurationMs
    );
    const token = roomManager.tokenFor(room.id, playerId)!;

    res.json({
      roomId: room.id,
      token,
      playerId,
      player: room.gameState.players[0],
      gameState: gameStateForViewer(room.gameState, playerId),
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Не удалось создать комнату' });
  }
});

// POST /api/rooms/:roomId/join - Join existing room
router.post('/rooms/:roomId/join', (req: Request, res: Response) => {
  const parsed = JoinRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректное имя игрока (1-20 символов)' });
    return;
  }

  const asSpectator = req.query.spectate === 'true' || parsed.data.spectate === true;

  try {
    const { roomId } = req.params;
    const playerId = randomUUID().slice(0, 8);
    const room = roomManager.join(
      String(roomId).toUpperCase(),
      parsed.data.playerName,
      playerId,
      asSpectator
    );
    const player = room.gameState.players[room.gameState.players.length - 1];
    const token = roomManager.tokenFor(room.id, playerId)!;

    res.json({
      playerId,
      token,
      player,
      gameState: gameStateForViewer(room.gameState, playerId),
    });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'Room not found':
          res.status(404).json({ error: 'Комната не найдена' });
          return;
        case 'Room is full':
          res.status(400).json({ error: 'Комната заполнена' });
          return;
        case 'Player name already exists':
          res.status(400).json({ error: 'Игрок с таким именем уже есть' });
          return;
      }
    }
    console.error('Error joining room:', error);
    res.status(500).json({ error: 'Не удалось присоединиться' });
  }
});

// GET /api/rooms/:roomId - Public lobby snapshot, or personalized view with auth
router.get('/rooms/:roomId', (req: Request, res: Response) => {
  const roomId = String(req.params.roomId).toUpperCase();
  const room = roomManager.get(roomId);

  if (!room) {
    res.status(404).json({ error: 'Комната не найдена' });
    return;
  }

  const playerId = typeof req.query.playerId === 'string' ? req.query.playerId : '';
  const token = readToken(req);

  if (playerId && roomManager.authenticate(roomId, playerId, token)) {
    res.json({ gameState: gameStateForViewer(room.gameState, playerId) });
    return;
  }

  // Anonymous: never leak unrevealed colors / mark targets
  res.json({ gameState: gameStateForViewer(room.gameState, null) });
});

// POST /api/rooms/:roomId/claim-seat - Sit as spymaster/guesser on a team
router.post('/rooms/:roomId/claim-seat', (req: Request, res: Response) => {
  const parsed = ClaimSeatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректное место' });
    return;
  }

  const roomId = String(req.params.roomId).toUpperCase();
  if (!roomManager.authenticate(roomId, parsed.data.playerId, parsed.data.token)) {
    res.status(403).json({ error: 'Нет доступа' });
    return;
  }

  try {
    const room = roomManager.claimSeat(
      roomId,
      parsed.data.playerId,
      parsed.data.team,
      parsed.data.role
    );
    broadcastRoomState(roomId);
    res.json({ gameState: gameStateForViewer(room.gameState, parsed.data.playerId) });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'Room not found':
          res.status(404).json({ error: 'Комната не найдена' });
          return;
        case 'Player not found':
          res.status(404).json({ error: 'Игрок не найден' });
          return;
        case 'Game already started':
          res.status(400).json({ error: 'Игра уже началась' });
          return;
        case 'Room is full':
          res.status(400).json({ error: 'Комната заполнена' });
          return;
        case 'Team is full':
          res.status(400).json({ error: 'В команде уже 3 игрока' });
          return;
      }
    }
    console.error('Error claiming seat:', error);
    res.status(500).json({ error: 'Не удалось занять место' });
  }
});

// POST /api/rooms/:roomId/start - Start the game (authed member)
router.post('/rooms/:roomId/start', (req: Request, res: Response) => {
  const parsed = StartRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Нужна авторизация игрока' });
    return;
  }

  const roomId = String(req.params.roomId).toUpperCase();
  if (!roomManager.get(roomId)) {
    res.status(404).json({ error: 'Комната не найдена' });
    return;
  }
  if (!roomManager.authenticate(roomId, parsed.data.playerId, parsed.data.token)) {
    res.status(403).json({ error: 'Нет доступа' });
    return;
  }

  try {
    const room = roomManager.start(roomId, parsed.data.playerId);
    broadcastRoomState(roomId);
    res.json({ gameState: gameStateForViewer(room.gameState, parsed.data.playerId) });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'Only host can start':
          res.status(403).json({ error: 'Начать игру может только создатель комнаты' });
          return;
        case 'Need at least 3 players to start':
          res.status(400).json({ error: 'Нужно минимум 3 игрока' });
          return;
        case 'Both teams need at least one player':
          res.status(400).json({ error: 'Нужны игроки в обеих командах' });
          return;
        case 'Game already started':
          res.status(400).json({ error: 'Игра уже началась' });
          return;
      }
    }
    console.error('Error starting room:', error);
    res.status(500).json({ error: 'Не удалось начать игру' });
  }
});

// DELETE /api/rooms/:roomId - Delete room (authed member)
router.delete('/rooms/:roomId', (req: Request, res: Response) => {
  const roomId = String(req.params.roomId).toUpperCase();
  const room = roomManager.get(roomId);

  if (!room) {
    res.status(404).json({ error: 'Комната не найдена' });
    return;
  }

  const playerId = typeof req.body?.playerId === 'string'
    ? req.body.playerId
    : typeof req.query.playerId === 'string'
      ? req.query.playerId
      : '';
  const token = typeof req.body?.token === 'string' ? req.body.token : readToken(req);

  if (!roomManager.authenticate(roomId, playerId, token)) {
    res.status(403).json({ error: 'Нет доступа' });
    return;
  }

  roomManager.delete(roomId);
  res.json({ message: 'Комната удалена' });
});

// GET /api/themes - Themes a host can choose before the deal
router.get('/themes', (_req: Request, res: Response) => {
  res.json({ themes: THEME_META });
});

// GET /api/themes/:theme/deal - 25 pictured words for the offline-feel demo
router.get('/themes/:theme/deal', (req: Request, res: Response) => {
  const theme = String(req.params.theme);
  if (!isThemeId(theme)) {
    res.status(400).json({ error: 'Неизвестная тема' });
    return;
  }

  const cards = dealEntries(theme, 25).map((entry) => ({
    word: entry.word,
    picture: entry.picture,
  }));
  res.json({ theme, cards });
});

// GET /api/rooms — disabled by default (was a public inventory of live games).
// Set ALLOW_ROOM_LIST=true for local tooling / admin.
router.get('/rooms', (_req: Request, res: Response) => {
  if (process.env.ALLOW_ROOM_LIST !== 'true') {
    res.status(404).json({ error: 'Не найдено' });
    return;
  }
  res.json({ rooms: roomManager.listAll() });
});

export default router;
