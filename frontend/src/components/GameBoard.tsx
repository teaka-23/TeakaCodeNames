import { memo } from 'react';
import type { Card, CardColor } from '../types';
import './GameBoard.css';

interface GameBoardProps {
  cards: Card[];
  onGuess: (cardIndex: number) => void;
  disabled: boolean;
  showAll?: boolean;
}

const HIDDEN_FACE = '#2a2a4a';

function faceColor(color: CardColor): string {
  switch (color) {
    case 'red': return 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
    case 'blue': return 'linear-gradient(135deg, #0d6efd 0%, #0b5ed5 100%)';
    case 'civilian': return '#3a4a3a';
    case 'assassin': return '#3a1a1a';
  }
}

function revealedColor(color: CardColor): string {
  switch (color) {
    case 'red': return '#4a1520';
    case 'blue': return '#152545';
    case 'civilian': return '#2a3a2a';
    case 'assassin': return '#1a1a1a';
  }
}

function borderColor(color: CardColor): string {
  switch (color) {
    case 'red': return '#ff6b6b';
    case 'blue': return '#6bb5ff';
    case 'civilian': return '#888';
    case 'assassin': return '#ff4444';
  }
}

function cardIcon(color: CardColor): string {
  switch (color) {
    case 'red': return '🔴';
    case 'blue': return '🔵';
    case 'civilian': return '⚪';
    case 'assassin': return '💀';
  }
}

function GameBoard({ cards, onGuess, disabled, showAll }: GameBoardProps) {
  const revealedCounts = { red: 0, blue: 0, civilian: 0, assassin: 0 };
  for (const card of cards) {
    if (card.revealed) revealedCounts[card.color]++;
  }

  return (
    <div className="game-board">
      <div className="card-grid">
        {cards.map((card, index) => {
          // Guessers must not learn a color from the paint. Color is visible
          // only after a reveal, or when showAll is set (spymaster, spectator, game over).
          const exposed = card.revealed || Boolean(showAll);

          return (
            <button
              key={`${card.x}-${card.y}`}
              className={`game-card ${card.revealed ? 'revealed' : ''} ${showAll ? 'show-all-card' : ''}`}
              data-color={exposed ? card.color : undefined}
              style={{
                background: !exposed
                  ? HIDDEN_FACE
                  : card.revealed
                    ? revealedColor(card.color)
                    : faceColor(card.color),
                borderColor: exposed ? borderColor(card.color) : '#444',
                opacity: card.revealed ? 0.85 : 1,
                cursor: disabled || card.revealed ? 'not-allowed' : 'pointer',
              }}
              onClick={() => !disabled && !card.revealed && onGuess(index)}
              disabled={disabled || card.revealed}
            >
              <span className="card-picture" aria-hidden="true">{card.picture || '🂠'}</span>
              <span className="card-word">{card.word}</span>
              {card.revealed && <span className="card-badge">{cardIcon(card.color)}</span>}
            </button>
          );
        })}
      </div>

      <div className="reveal-legend">
        <h5>Открыто</h5>
        <div className="legend-items">
          <span className="legend-item legend-red">🔴 Красные: {revealedCounts.red}</span>
          <span className="legend-item legend-blue">🔵 Синие: {revealedCounts.blue}</span>
          <span className="legend-item legend-civilian">⚪ Нейтральные: {revealedCounts.civilian}</span>
          {revealedCounts.assassin > 0 && (
            <span className="legend-item legend-assassin">💀 Ассасин открыт!</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(GameBoard);
