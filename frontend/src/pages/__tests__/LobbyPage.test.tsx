import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LobbyPage from '../LobbyPage';

const navigate = vi.fn();
const createRoom = vi.fn();
const joinRoom = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('../../services/api', () => ({
  api: {
    createRoom: (...args: unknown[]) => createRoom(...args),
    joinRoom: (...args: unknown[]) => joinRoom(...args),
  },
  withWarmupHint: (work: () => Promise<unknown>) => work(),
}));

const player = {
  id: 'p1',
  name: 'Alice',
  team: 'red' as const,
  role: 'guesser' as const,
};

describe('LobbyPage', () => {
  beforeEach(() => {
    navigate.mockReset();
    createRoom.mockReset();
    joinRoom.mockReset();
    localStorage.clear();
  });

  function renderLobby() {
    return render(
      <MemoryRouter>
        <LobbyPage />
      </MemoryRouter>
    );
  }

  it('keeps create/join disabled until required fields are filled', () => {
    renderLobby();
    expect(screen.getByRole('button', { name: 'Создать комнату' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Присоединиться' })).toBeDisabled();
  });

  it('creates a room, stores session, and navigates', async () => {
    const user = userEvent.setup();
    createRoom.mockResolvedValue({
      roomId: 'ABC123',
      playerId: 'p1',
      token: 'tok',
      player,
      gameState: {},
    });
    renderLobby();

    await user.type(screen.getByLabelText('Ваше имя'), 'Alice');
    await user.selectOptions(screen.getByLabelText('Таймер хода'), '0');
    await user.click(screen.getByRole('button', { name: 'Создать комнату' }));

    await waitFor(() => expect(createRoom).toHaveBeenCalledWith('Alice', 'it', 0));
    expect(JSON.parse(localStorage.getItem('codenames_session')!)).toMatchObject({
      roomId: 'ABC123',
      playerId: 'p1',
      token: 'tok',
    });
    expect(navigate).toHaveBeenCalledWith('/room/ABC123');
  });

  it('joins a room with uppercase code', async () => {
    const user = userEvent.setup();
    joinRoom.mockResolvedValue({
      playerId: 'p2',
      token: 'tok2',
      player: { ...player, id: 'p2', name: 'Bob' },
      gameState: {},
    });
    renderLobby();

    await user.type(screen.getByLabelText('Ваше имя'), 'Bob');
    await user.type(screen.getByLabelText('Код комнаты'), 'xyz789');
    await user.click(screen.getByRole('button', { name: 'Присоединиться' }));

    await waitFor(() => expect(joinRoom).toHaveBeenCalledWith('XYZ789', 'Bob', false));
    expect(navigate).toHaveBeenCalledWith('/room/XYZ789');
  });

  it('shows API errors from create', async () => {
    const user = userEvent.setup();
    createRoom.mockRejectedValue(new Error('Сервер спит'));
    renderLobby();

    await user.type(screen.getByLabelText('Ваше имя'), 'Alice');
    await user.click(screen.getByRole('button', { name: 'Создать комнату' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Сервер спит');
  });

  it('joins as spectator', async () => {
    const user = userEvent.setup();
    joinRoom.mockResolvedValue({
      playerId: 's1',
      token: 'stok',
      player: { ...player, id: 's1', name: 'Viewer', role: 'spectator' },
      gameState: {},
    });
    renderLobby();

    await user.type(screen.getByLabelText('Ваше имя'), 'Viewer');
    await user.type(screen.getByLabelText('Код комнаты'), 'ROOM01');
    await user.click(screen.getByRole('button', { name: 'Наблюдать' }));

    await waitFor(() => expect(joinRoom).toHaveBeenCalledWith('ROOM01', 'Viewer', true));
    expect(navigate).toHaveBeenCalledWith('/room/ROOM01');
  });

  it('passes the selected theme into createRoom', async () => {
    const user = userEvent.setup();
    createRoom.mockResolvedValue({
      roomId: 'T1',
      playerId: 'p1',
      token: 'tok',
      player,
      gameState: {},
    });
    renderLobby();

    await user.type(screen.getByLabelText('Ваше имя'), 'Alice');
    const themeRadios = screen.getAllByRole('radio');
    await user.click(themeRadios[1]);
    await user.click(screen.getByRole('button', { name: 'Создать комнату' }));

    await waitFor(() => expect(createRoom).toHaveBeenCalled());
    expect(createRoom.mock.calls[0][1]).not.toBeUndefined();
  });

  it('navigates home from back button', async () => {
    const user = userEvent.setup();
    renderLobby();
    await user.click(screen.getByRole('button', { name: /На главную/ }));
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
