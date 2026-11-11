import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();
let responseErrorHandler: ((error: unknown) => Promise<never>) | null = null;

vi.mock('axios', () => ({
  default: {
    create: () => ({
      post: mockPost,
      get: mockGet,
      delete: mockDelete,
      interceptors: {
        response: {
          use: (_ok: unknown, err: (error: unknown) => Promise<never>) => {
            responseErrorHandler = err;
          },
        },
      },
    }),
  },
}));

describe('api', () => {
  beforeEach(() => {
    vi.resetModules();
    mockPost.mockReset();
    mockGet.mockReset();
    mockDelete.mockReset();
    responseErrorHandler = null;
  });

  async function loadApi() {
    return import('../api');
  }

  it('createRoom posts playerName, theme, and optional turnSeconds', async () => {
    mockPost.mockResolvedValue({ data: { roomId: 'R1' } });
    const { api } = await loadApi();

    await api.createRoom('Alice', 'nature', 90);
    expect(mockPost).toHaveBeenCalledWith('/rooms', {
      playerName: 'Alice',
      theme: 'nature',
      turnSeconds: 90,
    });

    mockPost.mockClear();
    await api.createRoom('Bob');
    expect(mockPost).toHaveBeenCalledWith('/rooms', {
      playerName: 'Bob',
      theme: 'it',
    });
  });

  it('dealTheme / joinRoom / getRoom / claimSeat / startRoom / deleteRoom / listRooms', async () => {
    mockGet.mockResolvedValue({ data: { cards: [{ word: 'a', picture: 'p' }], gameState: {} } });
    mockPost.mockResolvedValue({ data: { gameState: {} } });
    mockDelete.mockResolvedValue({});
    const { api } = await loadApi();

    await expect(api.dealTheme('it')).resolves.toEqual([{ word: 'a', picture: 'p' }]);
    expect(mockGet).toHaveBeenCalledWith('/themes/it/deal');

    await api.joinRoom('ROOM', 'Carol', true);
    expect(mockPost).toHaveBeenCalledWith('/rooms/ROOM/join', {
      playerName: 'Carol',
      spectate: true,
    });

    await api.getRoom('ROOM', { playerId: 'p1', token: 'tok' });
    expect(mockGet).toHaveBeenCalledWith('/rooms/ROOM', {
      params: { playerId: 'p1', token: 'tok' },
      headers: { 'X-Room-Token': 'tok' },
    });

    await api.getRoom('ROOM');
    expect(mockGet).toHaveBeenLastCalledWith('/rooms/ROOM', {
      params: undefined,
      headers: undefined,
    });

    await api.claimSeat('ROOM', 'p1', 'tok', 'red', 'spymaster');
    expect(mockPost).toHaveBeenCalledWith('/rooms/ROOM/claim-seat', {
      playerId: 'p1',
      token: 'tok',
      team: 'red',
      role: 'spymaster',
    });

    await api.startRoom('ROOM', 'p1', 'tok');
    expect(mockPost).toHaveBeenCalledWith('/rooms/ROOM/start', {
      playerId: 'p1',
      token: 'tok',
    });

    await api.deleteRoom('ROOM', 'p1', 'tok');
    expect(mockDelete).toHaveBeenCalledWith('/rooms/ROOM', {
      data: { playerId: 'p1', token: 'tok' },
    });

    mockGet.mockResolvedValueOnce({ data: { rooms: [] } });
    await expect(api.listRooms()).resolves.toEqual({ rooms: [] });
    expect(mockGet).toHaveBeenCalledWith('/rooms');
  });

  it('maps axios errors to Error with server message', async () => {
    await loadApi();
    expect(responseErrorHandler).toBeTruthy();

    await expect(
      responseErrorHandler!({
        response: { data: { error: 'Комната не найдена' } },
      })
    ).rejects.toThrow('Комната не найдена');

    await expect(
      responseErrorHandler!({ message: 'timeout' })
    ).rejects.toThrow('timeout');

    await expect(
      responseErrorHandler!({ response: { data: { error: { nested: true } } } })
    ).rejects.toThrow('Ошибка сети');
  });
});
