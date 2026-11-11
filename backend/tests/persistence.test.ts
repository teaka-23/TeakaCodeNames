import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { RoomManager } from '../src/utils/roomManager';
import { FileStore, NoopStore } from '../src/utils/persistence';

async function makeTempStore(): Promise<{ store: FileStore; filePath: string; cleanup: () => Promise<void> }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'codenames-persist-'));
  const filePath = path.join(dir, 'rooms.json');
  return {
    store: new FileStore(filePath),
    filePath,
    cleanup: () => fs.rm(dir, { recursive: true, force: true }),
  };
}

describe('NoopStore', () => {
  it('is disabled and never writes', async () => {
    const store = new NoopStore();
    expect(store.enabled).toBe(false);
    expect(await store.load()).toEqual([]);
    await expect(store.save()).resolves.toBeUndefined();
  });
});

describe('FileStore', () => {
  it('returns an empty list when the file does not exist', async () => {
    const { store, cleanup } = await makeTempStore();
    expect(store.enabled).toBe(true);
    expect(await store.load()).toEqual([]);
    await cleanup();
  });

  it('round-trips rooms through the file', async () => {
    const { store, cleanup } = await makeTempStore();
    const manager = new RoomManager(store);
    const room = manager.create('Алиса', 'p1');
    manager.startTurnClock(room.id);

    await manager.persistNow();

    const reloaded = new RoomManager(store);
    const count = await reloaded.restore();

    expect(count).toBe(1);
    const restored = reloaded.get(room.id);
    expect(restored).toBeDefined();
    expect(restored!.token).toBe(room.token);
    expect(restored!.playerTokens.p1).toBe(room.playerTokens.p1);
    expect(restored!.gameState.players[0].name).toBe('Алиса');
    expect(restored!.gameState.turnDeadline).toBe(room.gameState.turnDeadline);
    // Connections are transient and must not be restored
    expect(restored!.playerConnections.size).toBe(0);

    await cleanup();
  });

  it('overwrites the previous snapshot atomically', async () => {
    const { store, filePath, cleanup } = await makeTempStore();
    const manager = new RoomManager(store);

    const first = manager.create('Алиса', 'p1');
    await manager.persistNow();
    expect(manager.get(first.id)).toBeDefined();

    manager.delete(first.id);
    await manager.persistNow();

    const raw = JSON.parse(await fs.readFile(filePath, 'utf8'));
    expect(raw.rooms).toEqual([]);

    await cleanup();
  });

  it('survives a corrupted file by returning an empty list', async () => {
    const { store, filePath, cleanup } = await makeTempStore();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, '{ not valid json', 'utf8');

    expect(await store.load()).toEqual([]);
    await cleanup();
  });
});

describe('RoomManager persistence', () => {
  it('does not restore anything when persistence is disabled', async () => {
    const manager = new RoomManager(new NoopStore());
    manager.create('Алиса', 'p1');

    expect(await manager.restore()).toBe(0);
    expect(manager.persistenceLabel).toContain('in-memory');
  });

  it('keeps game progress across a restart', async () => {
    const { store, cleanup } = await makeTempStore();
    const manager = new RoomManager(store);

    const room = manager.create('Алиса', 'p1');
    manager.join(room.id, 'Боб', 'p2');
    manager.join(room.id, 'Виктор', 'p3');
    manager.start(room.id);

    const currentTeam = room.gameState.currentTurn;
    const player = room.gameState.players.find(p => p.team === currentTeam)!;
    room.gameState.status = 'playing';
    manager.guess(room.id, 0);

    await manager.persistNow();

    const reloaded = new RoomManager(store);
    await reloaded.restore();
    const restored = reloaded.get(room.id)!;

    expect(restored.gameState.cards[0].revealed).toBe(true);
    expect(restored.gameState.players.length).toBe(3);
    expect(restored.gameState.players.some(p => p.id === player.id)).toBe(true);

    await cleanup();
  });
});
