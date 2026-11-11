import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClueDisplay from '../ClueDisplay';

describe('ClueDisplay', () => {
  it('renders nothing when there is no clue and no round to start', () => {
    const { container } = render(
      <ClueDisplay
        clue={null}
        currentTurn="red"
        canStartRound={false}
        onStartRound={vi.fn()}
        isSpymaster={false}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the clue word and card count to guessers', () => {
    render(
      <ClueDisplay
        clue={{ word: 'база', count: 2 }}
        currentTurn="blue"
        canStartRound={false}
        onStartRound={vi.fn()}
        isSpymaster={false}
      />
    );

    expect(screen.getByText('база')).toBeInTheDocument();
    expect(screen.getByText('2 карточек')).toBeInTheDocument();
    expect(screen.getByText('Синие — ход')).toBeInTheDocument();
    expect(screen.getByText('Угадывайте карточки, подходящие к подсказке!')).toBeInTheDocument();
  });

  it('shows remaining guesses when provided', () => {
    render(
      <ClueDisplay
        clue={{ word: 'код', count: 2 }}
        currentTurn="red"
        canStartRound={false}
        onStartRound={vi.fn()}
        isSpymaster={false}
        guessesRemaining={3}
      />
    );

    expect(screen.getByText('Осталось попыток: 3')).toBeInTheDocument();
  });

  it('shows a spymaster-specific instruction', () => {
    render(
      <ClueDisplay
        clue={{ word: 'сеть', count: 1 }}
        currentTurn="red"
        canStartRound={false}
        onStartRound={vi.fn()}
        isSpymaster
      />
    );

    expect(screen.getByText('Ваша команда угадывает. Следите за доской!')).toBeInTheDocument();
  });

  it('submits the manually entered clue when targets are marked', async () => {
    const onStartRound = vi.fn();
    render(
      <ClueDisplay
        clue={null}
        currentTurn="red"
        canStartRound
        onStartRound={onStartRound}
        isSpymaster
        targetCount={2}
      />
    );

    await userEvent.type(screen.getByPlaceholderText('Слово-подсказка'), 'сервер');
    const countInput = screen.getByRole('spinbutton');
    await userEvent.clear(countInput);
    await userEvent.type(countInput, '2');
    await userEvent.click(screen.getByRole('button', { name: 'Дать подсказку' }));

    expect(onStartRound).toHaveBeenCalledWith({ word: 'сервер', count: 2 });
  });

  it('submits on Enter in the word field', async () => {
    const onStartRound = vi.fn();
    render(
      <ClueDisplay
        clue={null}
        currentTurn="red"
        canStartRound
        onStartRound={onStartRound}
        isSpymaster
        targetCount={1}
      />
    );

    const input = screen.getByPlaceholderText('Слово-подсказка');
    await userEvent.type(input, 'код{Enter}');

    expect(onStartRound).toHaveBeenCalledWith({ word: 'код', count: 1 });
  });

  it('keeps submit disabled until targets are marked', async () => {
    const onStartRound = vi.fn();
    render(
      <ClueDisplay
        clue={null}
        currentTurn="red"
        canStartRound
        onStartRound={onStartRound}
        isSpymaster
        targetCount={0}
      />
    );

    await userEvent.type(screen.getByPlaceholderText('Слово-подсказка'), 'тест');
    expect(screen.getByRole('button', { name: 'Дать подсказку' })).toBeDisabled();
    expect(onStartRound).not.toHaveBeenCalled();
  });

  it('rejects an empty clue', async () => {
    const onStartRound = vi.fn();
    render(
      <ClueDisplay
        clue={null}
        currentTurn="red"
        canStartRound
        onStartRound={onStartRound}
        isSpymaster
        targetCount={1}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Дать подсказку' }));

    expect(onStartRound).not.toHaveBeenCalled();
    expect(screen.getByText('Введите слово-подсказку')).toBeInTheDocument();
  });

  it('rejects a whitespace-only clue', async () => {
    const onStartRound = vi.fn();
    render(
      <ClueDisplay
        clue={null}
        currentTurn="red"
        canStartRound
        onStartRound={onStartRound}
        isSpymaster
        targetCount={1}
      />
    );

    await userEvent.type(screen.getByPlaceholderText('Слово-подсказка'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Дать подсказку' }));

    expect(onStartRound).not.toHaveBeenCalled();
  });

  it('clamps the count input to the 1..8 range', () => {
    render(
      <ClueDisplay
        clue={null}
        currentTurn="red"
        canStartRound
        onStartRound={vi.fn()}
        isSpymaster
        targetCount={1}
      />
    );

    const countInput = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(countInput.min).toBe('1');
    expect(countInput.max).toBe('8');
  });
});
