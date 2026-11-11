import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DemoPage from '../DemoPage';

const navigate = vi.fn();
const dealTheme = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('../../services/api', () => ({
  api: {
    dealTheme: (...args: unknown[]) => dealTheme(...args),
  },
  withWarmupHint: (work: () => Promise<unknown>) => work(),
}));

vi.mock('../../components/GameBoard', () => ({
  default: ({ onGuess, cards }: { onGuess: (i: number) => void; cards: Array<{ word: string }> }) => (
    <div data-testid="board">
      {cards.slice(0, 3).map((c, i) => (
        <button key={c.word} type="button" onClick={() => onGuess(i)}>
          {c.word}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../../components/Scoreboard', () => ({
  default: () => <div data-testid="scoreboard" />,
}));

function fakeDeck() {
  return Array.from({ length: 25 }, (_, i) => ({
    word: `Word${i}`,
    picture: '📷',
  }));
}

describe('DemoPage', () => {
  beforeEach(() => {
    navigate.mockReset();
    dealTheme.mockReset();
  });

  it('loads a server deck and lets the player guess', async () => {
    const user = userEvent.setup();
    dealTheme.mockResolvedValue(fakeDeck());

    render(
      <MemoryRouter>
        <DemoPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Загрузка колоды/)).toBeInTheDocument();
    expect(await screen.findByTestId('board')).toBeInTheDocument();
    expect(dealTheme).toHaveBeenCalledWith('it');

    await user.click(screen.getByRole('button', { name: 'Word0' }));
    expect(screen.getByText('1')).toBeInTheDocument(); // turn count
  });

  it('falls back to a local deck when the API fails', async () => {
    dealTheme.mockRejectedValue(new Error('offline'));

    render(
      <MemoryRouter>
        <DemoPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('status')).toHaveTextContent(/локальной колодой/i);
    expect(screen.getByTestId('board')).toBeInTheDocument();
  });

  it('toggles color reveal and navigates home', async () => {
    const user = userEvent.setup();
    dealTheme.mockResolvedValue(fakeDeck());

    render(
      <MemoryRouter>
        <DemoPage />
      </MemoryRouter>
    );
    await screen.findByTestId('board');

    await user.click(screen.getByRole('button', { name: 'Скрыть цвета' }));
    expect(screen.getByRole('button', { name: 'Показать расклад' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /На главную/ }));
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('redeals when Новая раздача is clicked', async () => {
    const user = userEvent.setup();
    dealTheme.mockResolvedValue(fakeDeck());

    render(
      <MemoryRouter>
        <DemoPage />
      </MemoryRouter>
    );
    await screen.findByTestId('board');
    expect(dealTheme).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Новая раздача' }));
    await waitFor(() => expect(dealTheme).toHaveBeenCalledTimes(2));
  });

  it('switches theme and reloads the deck', async () => {
    const user = userEvent.setup();
    dealTheme.mockResolvedValue(fakeDeck());

    render(
      <MemoryRouter>
        <DemoPage />
      </MemoryRouter>
    );
    await screen.findByTestId('board');

    const themes = screen.getAllByRole('radio');
    await user.click(themes[1]);
    await waitFor(() => expect(dealTheme.mock.calls.length).toBeGreaterThan(1));
  });
});
