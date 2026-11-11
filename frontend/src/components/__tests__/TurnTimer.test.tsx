import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import TurnTimer from '../TurnTimer';

describe('TurnTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when there is no deadline', () => {
    const { container } = render(<TurnTimer deadline={null} currentTurn="red" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the remaining seconds until the deadline', () => {
    const deadline = Date.now() + 45_000;
    render(<TurnTimer deadline={deadline} currentTurn="blue" />);

    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('сек')).toBeInTheDocument();
  });

  it('counts down as time passes', () => {
    const deadline = Date.now() + 30_000;
    render(<TurnTimer deadline={deadline} currentTurn="red" />);
    expect(screen.getByText('30')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('never goes below zero after the deadline has passed', () => {
    const deadline = Date.now() + 2_000;
    const { container } = render(<TurnTimer deadline={deadline} currentTurn="red" />);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(container.querySelector('.turn-timer')).toHaveClass('urgent');
  });

  it('flags the last 10 seconds as urgent', () => {
    const deadline = Date.now() + 61_000;
    const { container } = render(<TurnTimer deadline={deadline} currentTurn="red" />);
    expect(container.querySelector('.turn-timer')).not.toHaveClass('urgent');

    act(() => {
      vi.advanceTimersByTime(52_000);
    });

    expect(container.querySelector('.turn-timer')).toHaveClass('urgent');
  });

  it('applies the team class for colouring', () => {
    const { container } = render(<TurnTimer deadline={Date.now() + 60_000} currentTurn="blue" />);
    expect(container.querySelector('.turn-timer')).toHaveClass('team-blue');
  });
});
