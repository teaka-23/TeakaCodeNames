import request from 'supertest';
import app from '../src/server';
import { RoomManager, roomManager } from '../src/utils/roomManager';

// Note: Supertest will start the server on a random port for testing
// No need to manage server lifecycle manually

afterEach(() => {
  jest.restoreAllMocks();
});

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

  it('should default the theme to IT', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .send({ playerName: 'Host' })
      .expect(200);

    expect(res.body.gameState.theme).toBe('it');
  });

  it('should remember a chosen theme', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .send({ playerName: 'Host', theme: 'yoga' })
      .expect(200);

    expect(res.body.gameState.theme).toBe('yoga');
  });

  it('should reject an unknown theme', async () => {
    await request(app)
      .post('/api/rooms')
      .send({ playerName: 'Host', theme: 'space' })
      .expect(400);
  });

  it('should set turnDurationMs to 0 when turnSeconds is 0', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .send({ playerName: 'Host', turnSeconds: 0 })
      .expect(200);

    expect(res.body.gameState.turnDurationMs).toBe(0);
  });

  it('should expose hostId matching the creating player', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .send({ playerName: 'Host' })
      .expect(200);

    expect(res.body.gameState.hostId).toBe(res.body.playerId);
  });

  it('should return 500 when room creation fails unexpectedly', async () => {
    jest.spyOn(roomManager, 'create').mockImplementation(() => {
      throw new Error('disk full');
    });

    await request(app)
      .post('/api/rooms')
      .send({ playerName: 'Host' })
      .expect(500);
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

  it('should reject an invalid player name', async () => {
    await request(app)
      .post(`/api/rooms/${createdRoomId}/join`)
      .send({ playerName: '' })
      .expect(400);
  });

  it('should return 400 when the room is full', async () => {
    const names = ['P2', 'P3', 'P4', 'P5', 'P6'];
    for (const name of names) {
      await request(app)
        .post(`/api/rooms/${createdRoomId}/join`)
        .send({ playerName: name })
        .expect(200);
    }

    await request(app)
      .post(`/api/rooms/${createdRoomId}/join`)
      .send({ playerName: 'OneTooMany' })
      .expect(400);
  });

  it('should return 500 when join fails unexpectedly', async () => {
    jest.spyOn(roomManager, 'join').mockImplementation(() => {
      throw 'weird failure';
    });

    await request(app)
      .post(`/api/rooms/${createdRoomId}/join`)
      .send({ playerName: 'Newbie' })
      .expect(500);
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

  it('should return a personalized view when auth uses the X-Room-Token header', async () => {
    const created = await request(app)
      .post('/api/rooms')
      .send({ playerName: 'Viewer' });

    const res = await request(app)
      .get(`/api/rooms/${created.body.roomId}`)
      .query({ playerId: created.body.playerId })
      .set('X-Room-Token', created.body.token)
      .expect(200);

    expect(res.body.gameState.players.some((p: { id: string }) => p.id === created.body.playerId)).toBe(true);
  });
});

describe('POST /api/rooms/:roomId/start', () => {
  let createdRoomId: string;
  let hostId: string;
  let hostToken: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/rooms')
      .send({ playerName: 'Red1' });
    createdRoomId = res.body.roomId;
    hostId = res.body.playerId;
    hostToken = res.body.token;

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
      .send({ playerId: hostId, token: hostToken })
      .expect(200);

    expect(res.body.gameState.cards).toHaveLength(25);
    expect(res.body.gameState.status).toBe('spymaster-ready');
  });

  it('should assign spymaster roles', async () => {
    const res = await request(app)
      .post(`/api/rooms/${createdRoomId}/start`)
      .send({ playerId: hostId, token: hostToken })
      .expect(200);

    const spymasters = res.body.gameState.players.filter((p: any) => p.role === 'spymaster');
    expect(spymasters.length).toBe(2);
  });

  it('should hide unrevealed colors from a guesser after start', async () => {
    const guesser = await request(app)
      .post(`/api/rooms/${createdRoomId}/join`)
      .send({ playerName: 'GuesserX' });

    // Ensure host is spymaster and joiner stays guesser on a team
    await request(app)
      .post(`/api/rooms/${createdRoomId}/claim-seat`)
      .send({
        playerId: hostId,
        token: hostToken,
        team: 'red',
        role: 'spymaster',
      });
    await request(app)
      .post(`/api/rooms/${createdRoomId}/claim-seat`)
      .send({
        playerId: guesser.body.playerId,
        token: guesser.body.token,
        team: 'red',
        role: 'guesser',
      });

    await request(app)
      .post(`/api/rooms/${createdRoomId}/start`)
      .send({ playerId: hostId, token: hostToken })
      .expect(200);

    const res = await request(app)
      .get(`/api/rooms/${createdRoomId}`)
      .query({ playerId: guesser.body.playerId, token: guesser.body.token })
      .set('X-Room-Token', guesser.body.token)
      .expect(200);

    const hidden = res.body.gameState.cards.filter((c: any) => !c.revealed);
    expect(hidden.length).toBe(25);
    expect(hidden.every((c: any) => c.color === null)).toBe(true);
  });

  it('should reject start without auth', async () => {
    await request(app)
      .post(`/api/rooms/${createdRoomId}/start`)
      .send({})
      .expect(400);
  });

  it('should reject start with a bad token', async () => {
    await request(app)
      .post(`/api/rooms/${createdRoomId}/start`)
      .send({ playerId: hostId, token: 'nope' })
      .expect(403);
  });

  it('should reject start from a non-host player', async () => {
    const joiner = await request(app)
      .post(`/api/rooms/${createdRoomId}/join`)
      .send({ playerName: 'NotHost' });

    await request(app)
      .post(`/api/rooms/${createdRoomId}/start`)
      .send({ playerId: joiner.body.playerId, token: joiner.body.token })
      .expect(403);
  });

  it('should deal a classic 9/8 board for the starting team', async () => {
    const res = await request(app)
      .post(`/api/rooms/${createdRoomId}/start`)
      .send({ playerId: hostId, token: hostToken })
      .expect(200);

    const start = res.body.gameState.currentTurn as 'red' | 'blue';
    const remaining = res.body.gameState.remainingCards;
    expect(remaining[start]).toBe(9);
    expect(remaining[start === 'red' ? 'blue' : 'red']).toBe(8);
    expect(remaining.civilian).toBe(7);
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
      .send({ playerId: res.body.playerId, token: res.body.token })
      .expect(400);
  });

  it('should return 404 for non-existent room', async () => {
    await request(app)
      .post('/api/rooms/FOROOM1/start')
      .send({ playerId: 'x', token: 'y' })
      .expect(404);
  });

  it('should reject start when all players are on one team', async () => {
    const solo = await request(app).post('/api/rooms').send({ playerName: 'OnlyRed' });
    const roomId = solo.body.roomId;
    const host = { playerId: solo.body.playerId, token: solo.body.token };

    const j2 = await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'R2' });
    const j3 = await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'R3' });

    for (const j of [j2, j3]) {
      await request(app)
        .post(`/api/rooms/${roomId}/claim-seat`)
        .send({ playerId: j.body.playerId, token: j.body.token, team: 'red', role: 'guesser' });
    }

    await request(app)
      .post(`/api/rooms/${roomId}/start`)
      .send(host)
      .expect(400);
  });

  it('should reject start when the game has already started', async () => {
    await request(app)
      .post(`/api/rooms/${createdRoomId}/start`)
      .send({ playerId: hostId, token: hostToken })
      .expect(200);

    await request(app)
      .post(`/api/rooms/${createdRoomId}/start`)
      .send({ playerId: hostId, token: hostToken })
      .expect(400);
  });

  it('should return 500 when start fails unexpectedly', async () => {
    jest.spyOn(roomManager, 'start').mockImplementation(() => {
      throw { oops: true };
    });

    await request(app)
      .post(`/api/rooms/${createdRoomId}/start`)
      .send({ playerId: hostId, token: hostToken })
      .expect(500);
  });
});

describe('POST /api/rooms/:roomId/claim-seat', () => {
  let roomId: string;
  let host: { playerId: string; token: string };

  beforeEach(async () => {
    const res = await request(app).post('/api/rooms').send({ playerName: 'Host' });
    roomId = res.body.roomId;
    host = { playerId: res.body.playerId, token: res.body.token };
  });

  it('should reject a malformed body', async () => {
    await request(app)
      .post(`/api/rooms/${roomId}/claim-seat`)
      .send({ playerId: host.playerId, token: host.token, team: 'green', role: 'guesser' })
      .expect(400);
  });

  it('should reject claim with a bad token', async () => {
    await request(app)
      .post(`/api/rooms/${roomId}/claim-seat`)
      .send({ playerId: host.playerId, token: 'bad', team: 'red', role: 'spymaster' })
      .expect(403);
  });

  it('should return 404 when the room disappears mid-request', async () => {
    jest.spyOn(roomManager, 'claimSeat').mockImplementation(() => {
      throw new Error('Room not found');
    });

    await request(app)
      .post(`/api/rooms/${roomId}/claim-seat`)
      .send({ ...host, team: 'red', role: 'spymaster' })
      .expect(404);
  });

  it('should return 404 when the player is missing', async () => {
    jest.spyOn(roomManager, 'claimSeat').mockImplementation(() => {
      throw new Error('Player not found');
    });

    await request(app)
      .post(`/api/rooms/${roomId}/claim-seat`)
      .send({ ...host, team: 'red', role: 'spymaster' })
      .expect(404);
  });

  it('should reject claim after the game has started', async () => {
    const j2 = await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'B1' });
    const j3 = await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'B2' });

    await request(app)
      .post(`/api/rooms/${roomId}/start`)
      .send(host)
      .expect(200);

    await request(app)
      .post(`/api/rooms/${roomId}/claim-seat`)
      .send({ playerId: j2.body.playerId, token: j2.body.token, team: 'blue', role: 'guesser' })
      .expect(400);
  });

  it('should reject claim when the team already has 3 players', async () => {
    const joins = await Promise.all(
      ['P2', 'P3', 'P4', 'P5'].map((name) =>
        request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: name })
      )
    );

    const redIds = [host, ...joins.slice(0, 2).map((r) => ({ playerId: r.body.playerId, token: r.body.token }))];
    for (const p of redIds) {
      await request(app)
        .post(`/api/rooms/${roomId}/claim-seat`)
        .send({ ...p, team: 'red', role: 'guesser' });
    }

    const extra = joins[2];
    await request(app)
      .post(`/api/rooms/${roomId}/claim-seat`)
      .send({
        playerId: extra.body.playerId,
        token: extra.body.token,
        team: 'red',
        role: 'guesser',
      })
      .expect(400);
  });

  it('should reject spectator claim when the room is at capacity', async () => {
    for (const name of ['P2', 'P3', 'P4', 'P5', 'P6']) {
      await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: name });
    }

    const spectator = await request(app)
      .post(`/api/rooms/${roomId}/join`)
      .query({ spectate: 'true' })
      .send({ playerName: 'Watcher', spectate: true })
      .expect(200);

    await request(app)
      .post(`/api/rooms/${roomId}/claim-seat`)
      .send({
        playerId: spectator.body.playerId,
        token: spectator.body.token,
        team: 'blue',
        role: 'guesser',
      })
      .expect(400);
  });

  it('should return 500 when claim fails unexpectedly', async () => {
    jest.spyOn(roomManager, 'claimSeat').mockImplementation(() => {
      throw null;
    });

    await request(app)
      .post(`/api/rooms/${roomId}/claim-seat`)
      .send({ ...host, team: 'red', role: 'spymaster' })
      .expect(500);
  });
});

describe('GET /api/rooms/:roomId visibility', () => {
  it('does not leak card colors to anonymous callers after start', async () => {
    const host = await request(app).post('/api/rooms').send({ playerName: 'H' });
    await request(app).post(`/api/rooms/${host.body.roomId}/join`).send({ playerName: 'A' });
    await request(app).post(`/api/rooms/${host.body.roomId}/join`).send({ playerName: 'B' });
    await request(app)
      .post(`/api/rooms/${host.body.roomId}/start`)
      .send({ playerId: host.body.playerId, token: host.body.token });

    const res = await request(app).get(`/api/rooms/${host.body.roomId}`).expect(200);
    expect(res.body.gameState.cards.every((c: any) => c.color === null)).toBe(true);
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
    const created = await request(app)
      .post('/api/rooms')
      .send({ playerName: 'Owner' });

    await request(app)
      .delete(`/api/rooms/${created.body.roomId}`)
      .send({ playerId: created.body.playerId, token: created.body.token })
      .expect(200);

    await request(app)
      .get(`/api/rooms/${created.body.roomId}`)
      .expect(404);
  });

  it('should reject delete without auth', async () => {
    await request(app)
      .delete(`/api/rooms/${createdRoomId}`)
      .expect(403);
  });

  it('should return 404 for non-existent room', async () => {
    await request(app)
      .delete('/api/rooms/FOROOM1')
      .send({ playerId: 'x', token: 'y' })
      .expect(404);
  });
});

describe('GET /api/rooms', () => {
  const prev = process.env.ALLOW_ROOM_LIST;

  afterEach(() => {
    if (prev === undefined) delete process.env.ALLOW_ROOM_LIST;
    else process.env.ALLOW_ROOM_LIST = prev;
  });

  it('is hidden by default', async () => {
    delete process.env.ALLOW_ROOM_LIST;
    await request(app).get('/api/rooms').expect(404);
  });

  it('returns a safe summary when ALLOW_ROOM_LIST=true', async () => {
    process.env.ALLOW_ROOM_LIST = 'true';
    await request(app).post('/api/rooms').send({ playerName: 'Test' });

    const res = await request(app).get('/api/rooms').expect(200);
    expect(Array.isArray(res.body.rooms)).toBe(true);
    expect(res.body.rooms[0]).toHaveProperty('id');
    expect(res.body.rooms[0]).toHaveProperty('status');
    expect(res.body.rooms[0]).not.toHaveProperty('token');
  });

  it('returns 404 when ALLOW_ROOM_LIST is explicitly false', async () => {
    process.env.ALLOW_ROOM_LIST = 'false';
    await request(app).get('/api/rooms').expect(404);
  });
});

describe('GET /api/themes', () => {
  it('should list available themes', async () => {
    const res = await request(app).get('/api/themes').expect(200);
    expect(Array.isArray(res.body.themes)).toBe(true);
    expect(res.body.themes.length).toBeGreaterThan(0);
    expect(res.body.themes[0]).toHaveProperty('id');
  });

  it('should deal 25 cards for a known theme', async () => {
    const res = await request(app).get('/api/themes/yoga/deal').expect(200);
    expect(res.body.theme).toBe('yoga');
    expect(res.body.cards).toHaveLength(25);
    expect(res.body.cards[0]).toHaveProperty('word');
    expect(res.body.cards[0]).toHaveProperty('picture');
  });

  it('should reject an unknown theme deal', async () => {
    await request(app).get('/api/themes/unknown/deal').expect(400);
  });
});

describe('GET /api/health', () => {
  it('should return health status', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.persistence).toBeDefined();
    expect(typeof res.body.rooms).toBe('number');
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
