import { promises as fs } from 'fs';
import path from 'path';
import type { ChatMessage, GameState } from '../types';

/**
 * Durable snapshot of a room. WebSocket connections are transient and are
 * deliberately not persisted — clients reconnect after a restart.
 */
export interface PersistedRoom {
  id: string;
  /** @deprecated Legacy shared room token; prefer playerTokens. */
  token: string;
  /** Per-player auth secrets. Missing on old snapshots — restored from token. */
  playerTokens?: Record<string, string>;
  gameState: GameState;
  maxPlayers: number;
  createdAt: number;
  chatMessages?: ChatMessage[];
}

export interface PersistenceStore {
  /** True when a durable backend is configured and usable. */
  readonly enabled: boolean;
  /** Human-readable description for startup logs. */
  readonly label: string;
  load(): Promise<PersistedRoom[]>;
  save(rooms: PersistedRoom[]): Promise<void>;
}

/** No-op store used when persistence is disabled (the default). */
export class NoopStore implements PersistenceStore {
  readonly enabled = false;
  readonly label = 'in-memory (no persistence)';

  async load(): Promise<PersistedRoom[]> {
    return [];
  }

  async save(): Promise<void> {
    // nothing to do
  }
}

/**
 * JSON file store. Survives a process restart without any external service,
 * which is enough for a single-instance deployment.
 */
export class FileStore implements PersistenceStore {
  readonly enabled = true;
  readonly label: string;
  private readonly filePath: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = filePath;
    this.label = `file (${filePath})`;
  }

  async load(): Promise<PersistedRoom[]> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.rooms) ? (parsed.rooms as PersistedRoom[]) : [];
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        console.error('Failed to load persisted rooms:', error);
      }
      return [];
    }
  }

  async save(rooms: PersistedRoom[]): Promise<void> {
    // Serialise writes so concurrent saves cannot interleave a partial file
    this.writeQueue = this.writeQueue.then(async () => {
      const payload = JSON.stringify({ savedAt: Date.now(), rooms }, null, 2);
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const tmpPath = `${this.filePath}.tmp`;
      await fs.writeFile(tmpPath, payload, 'utf8');
      await fs.rename(tmpPath, this.filePath);
    }).catch((error) => {
      console.error('Failed to persist rooms:', error);
    });

    return this.writeQueue;
  }
}

/** Builds the store from environment configuration. */
export function createPersistenceStore(): PersistenceStore {
  const driver = (process.env.PERSISTENCE_DRIVER || '').toLowerCase();

  if (driver === 'file') {
    const filePath = process.env.PERSISTENCE_FILE
      || path.resolve(process.cwd(), 'data/rooms.json');
    return new FileStore(filePath);
  }

  return new NoopStore();
}
