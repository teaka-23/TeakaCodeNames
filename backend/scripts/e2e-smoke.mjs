/**
 * End-to-end smoke test: boots the production server entrypoint (dist/server.js)
 * and drives a full game round over REST + WebSocket. Run after `npm run build`:
 *   node scripts/e2e-smoke.mjs
 * Exits 0 on success, 1 on first failed check.
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';

const PORT = 3457;
const base = `http://localhost:${PORT}/api`;
const wsBase = `ws://localhost:${PORT}/ws`;

const server = spawn(process.execPath, ['dist/server.js'], {
  env: { ...process.env, PORT: String(PORT), PERSISTENCE_DRIVER: 'memory' },
  stdio: ['ignore', 'pipe', 'inherit'],
});

await (async function waitForHealth() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${base}/health`);
      if (res.ok) return;
    } catch {}
    await delay(200);
  }
  throw new Error('server did not become healthy');
})();

let passed = 0;
let failed = 0;

function check(name, cond, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

async function api(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

function connectWs(roomId, playerId, token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsBase}?roomId=${roomId}&playerId=${playerId}&token=${token}`);
    const inbox = [];
    const waiters = [];
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      inbox.push(msg);
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i].pred(msg)) {
          waiters[i].resolve(msg);
          waiters.splice(i, 1);
        }
      }
    });
    ws.on('open', () => resolve({
      ws,
      send: (msg) => ws.send(JSON.stringify(msg)),
      waitFor: (pred, timeoutMs = 3000) => new Promise((res, rej) => {
        const hit = inbox.find(pred);
        if (hit) return res(hit);
        const timer = setTimeout(() => rej(new Error('waitFor timeout')), timeoutMs);
        waiters.push({ pred, resolve: (m) => { clearTimeout(timer); res(m); } });
      }),
    }));
    ws.on('error', reject);
  });
}

function expectClose(params, code) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${wsBase}?${params}`);
    ws.on('close', (c) => resolve(c === code));
    ws.on('error', () => {});
  });
}

const extraClients = [];

try {
  console.log('REST: room lifecycle');
  const health = await api('GET', '/health');
  check('GET /api/health → 200', health.status === 200 && health.json.status === 'ok');

  const bad = await api('POST', '/rooms', { playerName: '' });
  check('create with empty name → 400', bad.status === 400);

  const created = await api('POST', '/rooms', { playerName: 'Alice' });
  check('POST /api/rooms → roomId+token', created.status === 200 && created.json.roomId && created.json.token);
  const { roomId, token } = created.json;
  const alice = created.json.player;

  const joinBob = await api('POST', `/rooms/${roomId}/join`, { playerName: 'Bob' });
  check('join Bob → 200', joinBob.status === 200);
  const bob = joinBob.json.player;

  const dup = await api('POST', `/rooms/${roomId}/join`, { playerName: 'Alice' });
  check('duplicate name → 400', dup.status === 400);

  const noRoom = await api('POST', '/rooms/ZZZZZZ/join', { playerName: 'X' });
  check('join unknown room → 404', noRoom.status === 404);

  const early = await api('POST', `/rooms/${roomId}/start`);
  check('start with 2 players → 400', early.status === 400);

  await api('POST', `/rooms/${roomId}/join`, { playerName: 'Charlie' });
  await api('POST', `/rooms/${roomId}/join`, { playerName: 'Dave' });

  const list = await api('GET', '/rooms');
  check('GET /api/rooms lists room', list.json.rooms?.some((r) => r.id === roomId));

  const start = await api('POST', `/rooms/${roomId}/start`);
  const gs = start.json.gameState;
  check('start → 200, 25 cards', start.status === 200 && gs.cards.length === 25);
  check('spymasters assigned on both teams',
    gs.players.filter((p) => p.role === 'spymaster').length === 2);

  console.log('WebSocket: connect & auth');
  check('WS unknown room → close 4001', await expectClose(`roomId=ZZZZZZ&playerId=x&token=t`, 4001));
  check('WS bad token → close 4003', await expectClose(`roomId=${roomId}&playerId=${alice.id}&token=wrong`, 4003));
  check('WS missing params → close 4000', await expectClose('', 4000));

  const clients = new Map();
  async function clientOf(playerId) {
    if (!clients.has(playerId)) {
      const c = await connectWs(roomId, playerId, token);
      clients.set(playerId, c);
      extraClients.push(c);
    }
    return clients.get(playerId);
  }

  const wsAlice = await clientOf(alice.id);
  const wsBob = await clientOf(bob.id);
  await wsAlice.waitFor((m) => m.type === 'game_update');
  await wsBob.waitFor((m) => m.type === 'player_list');
  check('clients receive player_list + game_update on connect', true);

  console.log('Game flow over WS');
  const turn0 = gs.currentTurn;
  const oppTeam = turn0 === 'red' ? 'blue' : 'red';
  const spy = gs.players.find((p) => p.team === turn0 && p.role === 'spymaster');
  const guesser = gs.players.find((p) => p.team === turn0 && p.role === 'guesser');
  const oppGuesser = gs.players.find((p) => p.team === oppTeam && p.role === 'guesser');

  const wsSpy = await clientOf(spy.id);
  const wsGuesser = await clientOf(guesser.id);
  const wsOppGuesser = await clientOf(oppGuesser.id);
  const oppSpy = gs.players.find((p) => p.team === oppTeam && p.role === 'spymaster');
  const wsOppSpy = await clientOf(oppSpy.id);

  wsSpy.send({ type: 'start_round', payload: { clue: { word: 'smoke', count: 8 } } });
  const round = await wsSpy.waitFor((m) => m.type === 'start_round');
  let state = (await wsSpy.waitFor((m) => m.type === 'game_update' && m.payload.status === 'playing')).payload;
  check('start_round → clue broadcast, status playing',
    round.payload.clue.word === 'smoke' && state.clues.count === 8);

  const cardOf = (color, s) => s.cards.findIndex((c) => c.color === color && !c.revealed);

  // Correct guess: own team card → remaining decrements, turn stays
  wsGuesser.send({ type: 'guess', payload: { cardIndex: cardOf(turn0, state) } });
  let result = await wsGuesser.waitFor((m) => m.type === 'guess_result');
  state = (await wsGuesser.waitFor((m) => m.type === 'game_update' && m.payload.cards.some((c) => c.revealed))).payload;
  check('correct guess → correct=true, turn unchanged',
    result.payload.correct === true && state.currentTurn === turn0);
  check('remaining count decremented', state.remainingCards[turn0] === gs.remainingCards[turn0] - 1);

  // Wrong guess: opponent card → turn passes
  wsGuesser.send({ type: 'guess', payload: { cardIndex: cardOf(oppTeam, state) } });
  result = await wsGuesser.waitFor((m) => m.type === 'guess_result' && m.payload.correct === false);
  state = (await wsGuesser.waitFor((m) => m.type === 'game_update' && m.payload.currentTurn === oppTeam)).payload;
  check('wrong color → correct=false, turn passes', state.currentTurn === oppTeam);
  check('opponent scores the revealed card',
    state.scores[oppTeam] === 1 && state.remainingCards[oppTeam] === gs.remainingCards[oppTeam] - 1);

  // Opponent's fresh round, then skips back
  wsOppSpy.send({ type: 'start_round', payload: { clue: { word: 'mid', count: 1 } } });
  await wsOppGuesser.waitFor((m) => m.type === 'game_update' && m.payload.clues?.word === 'mid');
  wsOppGuesser.send({ type: 'skip_turn' });
  state = (await wsOppGuesser.waitFor((m) => m.type === 'game_update' && m.payload.currentTurn === turn0)).payload;
  check('skip_turn → turn passes back', state.currentTurn === turn0);

  // Fresh clue, then a civilian guess → turn passes, no score change
  wsSpy.send({ type: 'start_round', payload: { clue: { word: 'again', count: 1 } } });
  await wsGuesser.waitFor((m) => m.type === 'game_update' && m.payload.clues?.word === 'again');
  wsGuesser.send({ type: 'guess', payload: { cardIndex: cardOf('civilian', state) } });
  result = await wsGuesser.waitFor((m) => m.type === 'guess_result' && m.payload.card.color === 'civilian');
  state = (await wsGuesser.waitFor((m) => m.type === 'game_update' && m.payload.currentTurn === oppTeam)).payload;
  check('civilian → turn passes', result.payload.correct === false && state.currentTurn === oppTeam);

  // Opponent's fresh clue, then the assassin → game over, they lose
  wsOppSpy.send({ type: 'start_round', payload: { clue: { word: 'end', count: 1 } } });
  await wsOppGuesser.waitFor((m) => m.type === 'game_update' && m.payload.clues?.word === 'end');
  wsOppGuesser.send({ type: 'guess', payload: { cardIndex: cardOf('assassin', state) } });
  result = await wsOppGuesser.waitFor((m) => m.type === 'guess_result' && m.payload.gameOver);
  state = (await wsOppGuesser.waitFor((m) => m.type === 'game_update' && m.payload.status === 'finished')).payload;
  check('assassin → game over, guessing team loses',
    result.payload.gameOver === true && state.winner === turn0 && state.status === 'finished');

  console.log('Disconnect & cleanup');
  check('room exists while players connected', (await api('GET', `/rooms/${roomId}`)).status === 200);

  for (const c of clients.values()) c.ws.close();
  await delay(500);
  check('room deleted after all players disconnect', (await api('GET', `/rooms/${roomId}`)).status === 404);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
} catch (error) {
  console.error('E2E smoke failed with error:', error);
  process.exitCode = 1;
} finally {
  server.kill();
  for (const c of extraClients) c.ws.terminate();
}
