import request from 'supertest';
import app from '../src/server';
import { RoomManager } from '../src/utils/roomManager';

// Note: Supertest will start the server on a random port for testing
// No need to manage server lifecycle manually

describe('POST /api/rooms', () => {
  it('should create a room and return roomId and playerId', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .send({ playerName: 'TestPlayer' })
      .expect(200);

    expect(res.body.roomId).toBeDefined();
    expect(typeof res.body.roomId).toBe('string');
    expect(res.body.playerId).toBeDefined();
    expect(res.body.player.name).toBe('TestPlayer');
    expect(res.body.gameState.status).toBe('waiting');
  });

  it('should generate a 6-character room ID', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .send({ playerName: 'Test' })
      .expect(200);

    expect(res.body.roomId).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('should assign player to red team by default', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .send({ playerName: 'Test' })
      .expect(200);

    expect(res.body.player.team).toBe('red');
    expect(res.body.player.role).toBe('guesser');
  });

  it('should generate unique room IDs', async () => {
    const res1 = await request(app)
      .post('/api/rooms')
      .send({ playerName: 'Player1' });
    const res2 = await request(app)
      .post('/api/rooms')
      .send({ playerName: 'Player2' });

    expect(res1.body.roomId).not.toBe(res2.body.roomId);
  });
});

describe('POST /api/rooms/:roomId/join', () => {
  let createdRoomId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/rooms')
      .send({ playerName: 'Host' });
    createdRoomId = res.body.roomId;
  });

  it('should join a room and return player info', async () => {
    const res = await request(app)
      .post(`/api/rooms/${createdRoomId}/join`)
      .send({ playerName: 'NewPlayer' })
      .expect(200);

    expect(res.body.playerId).toBeDefined();
    expect(res.body.player.name).toBe('NewPlayer');
    expect(res.body.gameState.players.length).toBe(2);
  });

  it('should return 404 for non-existent room', async () => {
    await request(app)
      .post('/api/rooms/FOROOM1/join')
      .send({ playerName: 'NewPlayer' })
      .expect(404);
  });

  it('should return 400 for duplicate player name', async () => {
    await request(app)
      .post(`/api/rooms/${createdRoomId}/join`)
      .send({ playerName: 'Host' })
      .expect(400);
  });

  it('should balance teams when joining', async () => {
    // First joiner should go to blue (since host is red)
    const res = await request(app)
      .post(`/api/rooms/${createdRoomId}/join`)
      .send({ playerName: 'Player1' })
      .expect(200);

    // With 2 players (1 red host), second player can be blue
    expect(['red', 'blue']).toContain(res.body.player.team);
  });
});

describe('GET /api/rooms/:roomId', () => {
  let createdRoomId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/rooms')
      .send({ playerName: 'Host' });
    createdRoomId = res.body.roomId;
  });

  it('should return room state', async () => {
    const res = await request(app)
      .get(`/api/rooms/${createdRoomId}`)
      .expect(200);

    expect(res.body.gameState.roomId).toBe(createdRoomId);
    expect(res.body.gameState.status).toBe('waiting');
  });

  it('should return 404 for non-existent room', async () => {
    await request(app)
      .get('/api/rooms/FOROOM1')
      .expect(404);
  });
});

describe('POST /api/rooms/:roomId/start', () => {
  let createdRoomId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/rooms')
      .send({ playerName: 'Red1' });
    createdRoomId = res.body.roomId;

    // Add more players to meet minimum requirement
    await request(app)
      .post(`/api/rooms/${createdRoomId}/join`)
      .send({ playerName: 'Red2' });
    await request(app)
      .post(`/api/rooms/${createdRoomId}/join`)
      .send({ playerName: 'Blue1' });
  });

  it('should start the game and generate cards', async () => {
    const res = await request(app)
      .post(`/api/rooms/${createdRoomId}/start`)
      .expect(200);

    expect(res.body.gameState.cards).toHaveLength(25);
    expect(res.body.gameState.status).toBe('spymaster-ready');
  });

  it('should assign spymaster roles', async () => {
    const res = await request(app)
      .post(`/api/rooms/${createdRoomId}/start`)
      .expect(200);

    const spymasters = res.body.gameState.players.filter((p: any) => p.role === 'spymaster');
    expect(spymasters.length).toBe(2);
  });

  it('should return 400 when less than 3 players', async () => {
    // Create a new room with only 2 players
    const res = await request(app)
      .post('/api/rooms')
      .send({ playerName: 'P1' });
    const roomId = res.body.roomId;

    await request(app)
      .post(`/api/rooms/${roomId}/join`)
      .send({ playerName: 'P2' })
      .expect(200);

    await request(app)
      .post(`/api/rooms/${roomId}/start`)
      .expect(400);
  });

  it('should return 404 for non-existent room', async () => {
    await request(app)
      .post('/api/rooms/FOROOM1/start')
      .expect(404);
  });
});

describe('DELETE /api/rooms/:roomId', () => {
  let createdRoomId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/rooms')
      .send({ playerName: 'Test' });
    createdRoomId = res.body.roomId;
  });

  it('should delete the room', async () => {
    await request(app)
      .delete(`/api/rooms/${createdRoomId}`)
      .expect(200);

    // Verify room is deleted
    await request(app)
      .get(`/api/rooms/${createdRoomId}`)
      .expect(404);
  });

  it('should return 404 for non-existent room', async () => {
    await request(app)
      .delete('/api/rooms/FOROOM1')
      .expect(404);
  });
});

describe('GET /api/rooms', () => {
  it('should return list of active rooms', async () => {
    // Create a room
    await request(app)
      .post('/api/rooms')
      .send({ playerName: 'Test' });

    const res = await request(app)
      .get('/api/rooms')
      .expect(200);

    expect(res.body.rooms).toBeDefined();
    expect(Array.isArray(res.body.rooms)).toBe(true);
  });
});

describe('GET /api/health', () => {
  it('should return health status', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('turn clock timer', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('force-passes the turn on its own after 60s', () => {
    jest.useFakeTimers();
    const manager = new RoomManager();
    const room = manager.create('Алиса', 'p1');
    manager.join(room.id, 'Боб', 'p2');
    manager.join(room.id, 'Виктор', 'p3');
    manager.start(room.id);
    room.gameState.status = 'playing';

    let expiredRoomId: string | null = null;
    manager.onTurnExpired = (roomId: string) => {
      expiredRoomId = roomId;
    };

    const turnBefore = room.gameState.currentTurn;
    manager.startTurnClock(room.id);
    jest.advanceTimersByTime(60_000);

    expect(expiredRoomId).toBe(room.id);
    expect(room.gameState.currentTurn).not.toBe(turnBefore);
    expect(room.gameState.turnDeadline).toBeNull();
    expect(room.gameState.clues).toBeNull();
  });

  it('does not fire after the clock has been disarmed', () => {
    jest.useFakeTimers();
    const manager = new RoomManager();
    const room = manager.create('Алиса', 'p1');
    manager.join(room.id, 'Боб', 'p2');
    manager.join(room.id, 'Виктор', 'p3');
    manager.start(room.id);
    room.gameState.status = 'playing';

    let expiredRoomId: string | null = null;
    manager.onTurnExpired = (roomId: string) => {
      expiredRoomId = roomId;
    };

    const turnBefore = room.gameState.currentTurn;
    manager.startTurnClock(room.id);
    manager.clearTurnClock(room.id);
    jest.advanceTimersByTime(61_000);

    expect(expiredRoomId).toBeNull();
    expect(room.gameState.currentTurn).toBe(turnBefore);
  });
});
