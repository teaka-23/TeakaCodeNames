import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { roomManager } from '../utils/roomManager';

const router = Router();

const CreateRoomSchema = z.object({
  playerName: z.string().trim().min(1).max(20),
});

const JoinRoomSchema = z.object({
  playerName: z.string().trim().min(1).max(20),
  spectate: z.boolean().optional(),
});

// POST /api/rooms - Create new room
router.post('/rooms', (req: Request, res: Response) => {
  const parsed = CreateRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректное имя игрока (1-20 символов)' });
    return;
  }

  try {
    const playerId = randomUUID().slice(0, 8);
    const room = roomManager.create(parsed.data.playerName, playerId);

    res.json({
      roomId: room.id,
      token: room.token,
      playerId,
      player: room.gameState.players[0],
      gameState: room.gameState,
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

    res.json({
      playerId,
      token: room.token,
      player,
      gameState: room.gameState,
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

// GET /api/rooms/:roomId - Get room state
router.get('/rooms/:roomId', (req: Request, res: Response) => {
  const room = roomManager.get(String(req.params.roomId).toUpperCase());

  if (!room) {
    res.status(404).json({ error: 'Комната не найдена' });
    return;
  }

  res.json({ gameState: room.gameState });
});

// GET /api/rooms/:roomId/token - Get room token for a joined player
router.get('/rooms/:roomId/token', (req: Request, res: Response) => {
  const room = roomManager.get(String(req.params.roomId).toUpperCase());
  if (!room) {
    res.status(404).json({ error: 'Комната не найдена' });
    return;
  }

  const playerId = typeof req.query.playerId === 'string' ? req.query.playerId : '';
  const isMember = room.gameState.players.some((p: { id: string }) => p.id === playerId);
  if (!isMember) {
    res.status(403).json({ error: 'Игрок не найден в комнате' });
    return;
  }

  res.json({ token: room.token });
});

// POST /api/rooms/:roomId/start - Start the game
router.post('/rooms/:roomId/start', (req: Request, res: Response) => {
  try {
    const room = roomManager.start(String(req.params.roomId).toUpperCase());
    res.json({ gameState: room.gameState });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'Room not found':
          res.status(404).json({ error: 'Комната не найдена' });
          return;
        case 'Need at least 3 players to start':
          res.status(400).json({ error: 'Нужно минимум 3 игрока' });
          return;
      }
    }
    console.error('Error starting room:', error);
    res.status(500).json({ error: 'Не удалось начать игру' });
  }
});

// DELETE /api/rooms/:roomId - Delete room
router.delete('/rooms/:roomId', (req: Request, res: Response) => {
  const roomId = String(req.params.roomId).toUpperCase();
  const room = roomManager.get(roomId);

  if (!room) {
    res.status(404).json({ error: 'Комната не найдена' });
    return;
  }

  roomManager.delete(roomId);
  res.json({ message: 'Комната удалена' });
});

// GET /api/rooms - List active rooms
router.get('/rooms', (_req: Request, res: Response) => {
  res.json({ rooms: roomManager.listAll() });
});

export default router;
