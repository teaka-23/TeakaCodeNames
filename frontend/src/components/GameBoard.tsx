import { memo } from 'react';
import type { Card, CardColor } from '../types';
import './GameBoard.css';

interface GameBoardProps {
  cards: Card[];
  onGuess: (cardIndex: number) => void;
  disabled: boolean;
  showAll?: boolean;
  /** Spymaster mark mode: click toggles target instead of guessing. */
  markMode?: boolean;
  markedWords?: string[];
}

const HIDDEN_FACE = 'linear-gradient(180deg, #2f281f 0%, #221c16 100%)';

function faceColor(color: CardColor | null): string {
  switch (color) {
    case 'red': return 'linear-gradient(160deg, #b85a52 0%, #8a3a35 100%)';
    case 'blue': return 'linear-gradient(160deg, #5a7f9c 0%, #3b5874 100%)';
    case 'civilian': return 'linear-gradient(160deg, #6a7366 0%, #4d554a 100%)';
    case 'assassin': return 'linear-gradient(160deg, #2a201c 0%, #15110f 100%)';
    default: return HIDDEN_FACE;
  }
}

function revealedColor(color: CardColor | null): string {
  switch (color) {
    case 'red': return '#4a2623';
    case 'blue': return '#243849';
    case 'civilian': return '#2d332c';
    case 'assassin': return '#120f0d';
    default: return '#221c16';
  }
}

function borderColor(color: CardColor | null): string {
  switch (color) {
    case 'red': return '#c47a72';
    case 'blue': return '#7ea3c4';
    case 'civilian': return '#8a9284';
    case 'assassin': return '#8a5048';
    default: return '#444';
  }
}

function GameBoard({ cards, onGuess, disabled, showAll, markMode, markedWords = [] }: GameBoardProps) {
  const revealedCounts = { red: 0, blue: 0, civilian: 0, assassin: 0 };
  for (const card of cards) {
    if (card.revealed && card.color) revealedCounts[card.color]++;
  }
  const marked = new Set(markedWords);

  return (
    <div className="game-board">
      <div className="card-grid">
        {cards.map((card, index) => {
          // Guessers must not learn a color from the paint. Server also omits
          // color; client only paints when revealed or showAll with a known color.
          const exposed = (card.revealed || Boolean(showAll)) && Boolean(card.color);
          const isMarked = marked.has(card.word);
          const clickable = markMode
            ? !card.revealed
            : !disabled && !card.revealed;

          return (
            <button
              key={`${card.x}-${card.y}`}
              className={`game-card ${card.revealed ? 'revealed' : ''} ${showAll && card.color ? 'show-all-card' : ''} ${isMarked ? 'marked-target' : ''}`}
              data-color={exposed ? card.color ?? undefined : undefined}
              style={{
                background: !exposed
                  ? HIDDEN_FACE
                  : card.revealed
                    ? revealedColor(card.color)
                    : faceColor(card.color),
                borderColor: isMarked ? '#ffc107' : exposed ? borderColor(card.color) : '#444',
                opacity: card.revealed ? 0.85 : 1,
                cursor: clickable ? 'pointer' : 'not-allowed',
              }}
              onClick={() => clickable && onGuess(index)}
              disabled={!clickable}
              aria-pressed={markMode ? isMarked : undefined}
            >
              <span className="card-picture" aria-hidden="true">{card.picture || '🂠'}</span>
              <span className="card-word">{card.word}</span>
              {isMarked && !card.revealed && <span className="card-mark">✓</span>}
              {card.revealed && card.color && <span className="card-badge" data-tone={card.color} />}
            </button>
          );
        })}
      </div>

      <div className="reveal-legend">
        <h5>Открыто</h5>
        <div className="legend-items">
          <span className="legend-item legend-red">Красные {revealedCounts.red}</span>
          <span className="legend-item legend-blue">Синие {revealedCounts.blue}</span>
          <span className="legend-item legend-civilian">Нейтральные {revealedCounts.civilian}</span>
          {revealedCounts.assassin > 0 && (
            <span className="legend-item legend-assassin">Ассасин</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(GameBoard);
