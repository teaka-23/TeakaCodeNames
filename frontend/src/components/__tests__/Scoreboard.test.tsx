import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Scoreboard from '../Scoreboard';

const remaining = { red: 8, blue: 8, civilian: 8, assassin: 1 };

describe('Scoreboard', () => {
  it('renders both team names and scores', () => {
    render(
      <Scoreboard scores={{ red: 3, blue: 5 }} remaining={remaining} currentTurn="red" />
    );

    expect(screen.getByText('Красные')).toBeInTheDocument();
    expect(screen.getByText('Синие')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('×')).toBeInTheDocument();
  });

  it('shows remaining cards for each team', () => {
    render(
      <Scoreboard
        scores={{ red: 0, blue: 0 }}
        remaining={{ ...remaining, red: 6, blue: 2 }}
        currentTurn="red"
      />
    );

    expect(screen.getByText('осталось 6')).toBeInTheDocument();
    expect(screen.getByText('осталось 2')).toBeInTheDocument();
  });

  it('marks the red team as active when it is their turn', () => {
    const { container } = render(
      <Scoreboard scores={{ red: 0, blue: 0 }} remaining={remaining} currentTurn="red" />
    );

    const red = container.querySelector('.team-red');
    const blue = container.querySelector('.team-blue');

    expect(red).toHaveClass('active');
    expect(blue).not.toHaveClass('active');
    expect(container.querySelectorAll('.turn-indicator')).toHaveLength(1);
  });

  it('marks the blue team as active when it is their turn', () => {
    const { container } = render(
      <Scoreboard scores={{ red: 0, blue: 0 }} remaining={remaining} currentTurn="blue" />
    );

    expect(container.querySelector('.team-blue')).toHaveClass('active');
    expect(container.querySelector('.team-red')).not.toHaveClass('active');
  });
});
