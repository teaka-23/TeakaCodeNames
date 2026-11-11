import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GameBoard from '../GameBoard';
import type { Card, CardColor } from '../../types';

function makeCard(word: string, color: CardColor, index: number, revealed = false): Card {
  return {
    word,
    color,
    x: index % 5,
    y: Math.floor(index / 5),
    revealed,
  };
}

const mixedCards: Card[] = [
  makeCard('React', 'red', 0),
  makeCard('Django', 'blue', 1),
  makeCard('Python', 'civilian', 2),
  makeCard('Assassin', 'assassin', 3),
  makeCard('Old', 'red', 4, true),
];

describe('GameBoard', () => {
  it('renders one button per card', () => {
    render(<GameBoard cards={mixedCards} onGuess={vi.fn()} disabled={false} />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('keeps the word and marks the color when showAll is on', () => {
    render(<GameBoard cards={mixedCards} onGuess={vi.fn()} disabled={false} showAll />);

    const red = screen.getByText('React').closest('button');
    const blue = screen.getByText('Django').closest('button');
    expect(red).toHaveAttribute('data-color', 'red');
    expect(blue).toHaveAttribute('data-color', 'blue');
    expect(red?.style.background).toContain('rgb(184, 90, 82)');
  });

  it('paints face-down cards with a neutral back', () => {
    render(<GameBoard cards={mixedCards} onGuess={vi.fn()} disabled={false} />);

    const hidden = screen.getByText('React').closest('button');
    expect(hidden).not.toHaveAttribute('data-color');
    expect(hidden?.style.background).toContain('rgb(47, 40, 31)');
  });

  it('shows plain words when showAll is off', () => {
    render(<GameBoard cards={mixedCards} onGuess={vi.fn()} disabled={false} />);

    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Django')).toBeInTheDocument();
    expect(screen.queryByText('🔴 КРАСНАЯ')).not.toBeInTheDocument();
  });

  it('calls onGuess with the card index when clicked', async () => {
    const onGuess = vi.fn();
    render(<GameBoard cards={mixedCards} onGuess={onGuess} disabled={false} />);

    await userEvent.click(screen.getByText('Django'));

    expect(onGuess).toHaveBeenCalledTimes(1);
    expect(onGuess).toHaveBeenCalledWith(1);
  });

  it('does not fire onGuess for an already revealed card', async () => {
    const onGuess = vi.fn();
    render(<GameBoard cards={mixedCards} onGuess={onGuess} disabled={false} />);

    const revealed = screen.getAllByRole('button')[4];
    expect(revealed).toBeDisabled();

    await userEvent.click(revealed);
    expect(onGuess).not.toHaveBeenCalled();
  });

  it('keeps the word on a revealed card and adds a color badge', () => {
    const { container } = render(<GameBoard cards={mixedCards} onGuess={vi.fn()} disabled={false} />);

    expect(screen.getByText('Old')).toBeInTheDocument();
    expect(container.querySelector('.card-badge[data-tone="red"]')).toBeTruthy();
  });

  it('shows the picture glyph for a card', () => {
    const cards = [{ ...mixedCards[0], picture: '⚛️' }];
    render(<GameBoard cards={cards} onGuess={vi.fn()} disabled={false} />);
    expect(screen.getByText('⚛️')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('counts revealed cards in the legend', () => {
    const cards: Card[] = [
      makeCard('A', 'red', 0, true),
      makeCard('B', 'red', 1, true),
      makeCard('C', 'blue', 2, true),
      makeCard('D', 'civilian', 3, false),
    ];
    render(<GameBoard cards={cards} onGuess={vi.fn()} disabled={false} />);

    expect(screen.getByText(/Красные\s+2/)).toBeInTheDocument();
    expect(screen.getByText(/Синие\s+1/)).toBeInTheDocument();
    expect(screen.getByText(/Нейтральные\s+0/)).toBeInTheDocument();
  });

  it('warns when the assassin has been revealed', () => {
    const cards: Card[] = [makeCard('Boom', 'assassin', 0, true)];
    render(<GameBoard cards={cards} onGuess={vi.fn()} disabled={false} />);

    expect(screen.getByText('Ассасин')).toBeInTheDocument();
  });

  it('does not show the assassin warning while it is hidden', () => {
    const cards: Card[] = [makeCard('Boom', 'assassin', 0, false)];
    render(<GameBoard cards={cards} onGuess={vi.fn()} disabled={false} />);

    expect(screen.queryByText('Ассасин')).not.toBeInTheDocument();
  });

  it('does not call onGuess when the board is disabled', async () => {
    const onGuess = vi.fn();
    render(<GameBoard cards={mixedCards} onGuess={onGuess} disabled />);

    await userEvent.click(screen.getByText('React'));
    expect(onGuess).not.toHaveBeenCalled();
  });
});
