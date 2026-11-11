import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { GameState, Player } from '../../types';
import GamePage from '../GamePage';

const {
  navigate,
  getRoom,
  joinRoom,
  claimSeat,
  startRoom,
  wsHandlers,
  wsClient,
  emitWs,
} = vi.hoisted(() => {
  const wsHandlers = new Map<string, Set<(msg: unknown) => void>>();
  const wsClient = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    on: vi.fn((type: string, handler: (msg: unknown) => void) => {
      if (!wsHandlers.has(type)) wsHandlers.set(type, new Set());
      wsHandlers.get(type)!.add(handler);
    }),
    off: vi.fn((type: string, handler: (msg: unknown) => void) => {
      wsHandlers.get(type)?.delete(handler);
    }),
  };
  return {
    navigate: vi.fn(),
    getRoom: vi.fn(),
    joinRoom: vi.fn(),
    claimSeat: vi.fn(),
    startRoom: vi.fn(),
    wsHandlers,
    wsClient,
    emitWs(type: string, payload: unknown = {}) {
      wsHandlers.get(type)?.forEach((h) => h({ type, payload }));
    },
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('../../services/api', () => ({
  api: {
    getRoom: (...args: unknown[]) => getRoom(...args),
    joinRoom: (...args: unknown[]) => joinRoom(...args),
    claimSeat: (...args: unknown[]) => claimSeat(...args),
    startRoom: (...args: unknown[]) => startRoom(...args),
  },
}));

vi.mock('../../services/webSocket', () => ({
  wsClient,
}));

vi.mock('../../components/GameBoard', () => ({
  default: () => <div data-testid="board" />,
}));
vi.mock('../../components/Scoreboard', () => ({
  default: () => <div data-testid="scoreboard" />,
}));
vi.mock('../../components/ClueDisplay', () => ({
  default: () => <div data-testid="clue" />,
}));
vi.mock('../../components/TurnTimer', () => ({
  default: () => <div data-testid="timer" />,
}));

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'host1',
    name: 'Host',
    team: 'red',
    role: 'guesser',
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  const host = makePlayer();
  const p2 = makePlayer({ id: 'p2', name: 'Blue1', team: 'blue' });
  const p3 = makePlayer({ id: 'p3', name: 'Red2', team: 'red' });
  return {
    roomId: 'ABC123',
    theme: 'it',
    status: 'waiting',
    players: [host, p2, p3],
    cards: [],
    currentTurn: 'red',
    clues: null,
    clueHistory: [],
    eventLog: [],
    clueTargets: [],
    scores: { red: 0, blue: 0 },
    remainingCards: { red: 9, blue: 8, civilian: 7, assassin: 1 },
    turnDeadline: null,
    guessesRemaining: null,
    turnDurationMs: 60_000,
    hostId: host.id,
    winner: null,
    ...overrides,
  };
}

function renderRoom(path = '/room/ABC123') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/room/:roomId" element={<GamePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('GamePage', () => {
  beforeEach(() => {
    navigate.mockReset();
    getRoom.mockReset();
    joinRoom.mockReset();
    claimSeat.mockReset();
    startRoom.mockReset();
    wsClient.connect.mockReset();
    wsClient.disconnect.mockReset();
    wsClient.send.mockReset();
    wsClient.on.mockClear();
    wsClient.off.mockClear();
    wsHandlers.clear();
    localStorage.clear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('shows join form for guests and joins with a name', async () => {
    const user = userEvent.setup();
    const state = makeState();
    getRoom.mockResolvedValue({ gameState: state });
    joinRoom.mockResolvedValue({
      playerId: 'guest1',
      token: 'gtok',
      player: makePlayer({ id: 'guest1', name: 'Guest', team: 'blue' }),
      gameState: {
        ...state,
        players: [...state.players, makePlayer({ id: 'guest1', name: 'Guest', team: 'blue' })],
      },
    });

    renderRoom();
    expect(await screen.findByRole('heading', { name: /Комната: ABC123/ })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Ваше имя...'), 'Guest');
    await user.click(screen.getByRole('button', { name: 'Присоединиться' }));

    await waitFor(() => expect(joinRoom).toHaveBeenCalledWith('ABC123', 'Guest'));
    expect(wsClient.connect).toHaveBeenCalledWith('ABC123', 'guest1', 'gtok');
    expect(await screen.findByText(/Комната ABC123/)).toBeInTheDocument();
  });

  it('restores a session and shows the waiting lobby for the host', async () => {
    const state = makeState();
    localStorage.setItem(
      'codenames_session',
      JSON.stringify({
        roomId: 'ABC123',
        playerId: 'host1',
        token: 'tok',
        player: makePlayer(),
      })
    );
    getRoom.mockResolvedValue({ gameState: state });

    renderRoom();
    expect(await screen.findByText(/Комната ABC123/)).toBeInTheDocument();
    expect(wsClient.connect).toHaveBeenCalledWith('ABC123', 'host1', 'tok');
    expect(screen.getByRole('button', { name: /Начать игру/ })).toBeEnabled();
  });

  it('starts the game when host clicks start', async () => {
    const user = userEvent.setup();
    const state = makeState();
    localStorage.setItem(
      'codenames_session',
      JSON.stringify({
        roomId: 'ABC123',
        playerId: 'host1',
        token: 'tok',
        player: makePlayer(),
      })
    );
    getRoom.mockResolvedValue({ gameState: state });
    startRoom.mockResolvedValue({
      gameState: {
        ...state,
        status: 'spymaster-ready',
        cards: Array.from({ length: 25 }, (_, i) => ({
          word: `W${i}`,
          picture: 'x',
          color: 'civilian' as const,
          x: i % 5,
          y: Math.floor(i / 5),
          revealed: false,
        })),
      },
    });

    renderRoom();
    await screen.findByText(/Комната ABC123/);
    await user.click(screen.getByRole('button', { name: /Начать игру/ }));

    await waitFor(() => expect(startRoom).toHaveBeenCalledWith('ABC123', 'host1', 'tok'));
    expect(await screen.findByTestId('board')).toBeInTheDocument();
  });

  it('claims a seat from the waiting lobby', async () => {
    const user = userEvent.setup();
    const state = makeState();
    localStorage.setItem(
      'codenames_session',
      JSON.stringify({
        roomId: 'ABC123',
        playerId: 'host1',
        token: 'tok',
        player: makePlayer(),
      })
    );
    getRoom.mockResolvedValue({ gameState: state });
    claimSeat.mockResolvedValue({
      gameState: {
        ...state,
        players: state.players.map((p) =>
          p.id === 'host1' ? { ...p, role: 'spymaster' as const } : p
        ),
      },
    });

    renderRoom();
    await screen.findByText(/Комната ABC123/);
    await user.click(screen.getAllByRole('button', { name: /Сесть шпионом/i })[0]);

    await waitFor(() =>
      expect(claimSeat).toHaveBeenCalledWith('ABC123', 'host1', 'tok', expect.any(String), 'spymaster')
    );
  });

  it('handles WS reconnect banner and leave', async () => {
    const user = userEvent.setup();
    const state = makeState();
    localStorage.setItem(
      'codenames_session',
      JSON.stringify({
        roomId: 'ABC123',
        playerId: 'host1',
        token: 'tok',
        player: makePlayer(),
      })
    );
    getRoom.mockResolvedValue({ gameState: state });

    renderRoom();
    await screen.findByText(/Комната ABC123/);

    act(() => {
      emitWs('ws_reconnecting', { attempt: 2, max: 8 });
    });
    expect(screen.getByText(/Переподключение 2\/8/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Выйти из игры/ }));
    expect(wsClient.disconnect).toHaveBeenCalled();
    expect(localStorage.getItem('codenames_session')).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/lobby');
  });

  it('shows load error when the room is missing', async () => {
    getRoom.mockRejectedValue(new Error('Комната не найдена'));
    renderRoom('/room/GONE01');
    expect(await screen.findByRole('alert')).toHaveTextContent('Комната не найдена');
  });

  it('renders playing board, skip, chat, and WS toasts', async () => {
    const user = userEvent.setup();
    const host = makePlayer({ role: 'guesser' });
    const state = makeState({
      status: 'playing',
      currentTurn: 'red',
      hostId: host.id,
      players: [
        host,
        makePlayer({ id: 'p2', name: 'Blue1', team: 'blue' }),
        makePlayer({ id: 'p3', name: 'Red2', team: 'red' }),
      ],
      cards: Array.from({ length: 25 }, (_, i) => ({
        word: `W${i}`,
        picture: 'x',
        color: 'civilian' as const,
        x: i % 5,
        y: Math.floor(i / 5),
        revealed: false,
      })),
      turnDeadline: Date.now() + 30_000,
      clues: { word: 'net', count: 2 },
      eventLog: [
        {
          id: 'e1',
          at: Date.now(),
          kind: 'clue' as const,
          team: 'red' as const,
          word: 'net',
          count: 2,
          targetWords: ['W0'],
        },
      ],
    });
    localStorage.setItem(
      'codenames_session',
      JSON.stringify({
        roomId: 'ABC123',
        playerId: 'host1',
        token: 'tok',
        player: host,
      })
    );
    getRoom.mockResolvedValue({ gameState: state });

    renderRoom();
    expect(await screen.findByTestId('board')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Пропустить ход' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Пропустить ход' }));
    expect(wsClient.send).toHaveBeenCalledWith({ type: 'skip_turn', payload: {} });

    await user.click(screen.getByRole('tab', { name: 'Чат' }));
    await user.type(screen.getByPlaceholderText('Сообщение…'), 'привет');
    await user.click(screen.getByRole('button', { name: '→' }));
    expect(wsClient.send).toHaveBeenCalledWith({ type: 'chat', payload: { text: 'привет' } });

    act(() => {
      emitWs('start_round', { clue: { word: 'cloud', count: 3 } });
      emitWs('turn_expired', { currentTurn: 'blue' });
      emitWs('guess_result', { card: state.cards[0], correct: true, gameOver: true, winner: 'red' });
      emitWs('chat_history', { messages: [{ id: 'c1', playerName: 'Host', text: 'hi', at: 1 }] });
      emitWs('chat', { id: 'c2', playerName: 'Blue1', text: 'yo', at: 2 });
      emitWs('error', { message: 'Не ваш ход' });
      emitWs('ws_send_failed', {});
      emitWs('ws_reconnect_failed', {});
      emitWs('game_update', { ...state, status: 'finished', winner: 'red' });
    });

    expect(await screen.findByText(/Игра окончена/)).toBeInTheDocument();
  });

  it('shows finished game over screen for a draw', async () => {
    const state = makeState({
      status: 'finished',
      winner: null,
      scores: { red: 4, blue: 4 },
      cards: Array.from({ length: 25 }, (_, i) => ({
        word: `W${i}`,
        picture: 'x',
        color: 'civilian' as const,
        x: i % 5,
        y: Math.floor(i / 5),
        revealed: true,
      })),
    });
    localStorage.setItem(
      'codenames_session',
      JSON.stringify({
        roomId: 'ABC123',
        playerId: 'host1',
        token: 'tok',
        player: makePlayer(),
      })
    );
    getRoom.mockResolvedValue({ gameState: state });

    renderRoom();
    expect(await screen.findByText(/Ничья/)).toBeInTheDocument();
  });
});
