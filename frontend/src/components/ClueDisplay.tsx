import { memo, useState } from 'react';
import type { TeamColor } from '../types';
import './ClueDisplay.css';

interface ClueDisplayProps {
  clue: { word: string; count: number } | null;
  currentTurn: TeamColor;
  canStartRound: boolean;
  onStartRound: (clue?: { word: string; count: number }) => void;
  isSpymaster: boolean;
}

function ClueDisplay({
  clue,
  currentTurn,
  canStartRound,
  onStartRound,
  isSpymaster,
}: ClueDisplayProps) {
  const [word, setWord] = useState('');
  const [count, setCount] = useState(1);
  const [error, setError] = useState('');

  const submitClue = () => {
    const trimmed = word.trim();
    if (!trimmed) {
      setError('Введите слово-подсказку');
      return;
    }
    if (count < 1 || count > 8) {
      setError('Количество карточек: от 1 до 8');
      return;
    }
    setError('');
    onStartRound({ word: trimmed, count });
    setWord('');
    setCount(1);
  };

  if (!clue && !canStartRound) return null;

  return (
    <div className={`clue-display team-${currentTurn}`}>
      {canStartRound ? (
        <div className="clue-prompt">
          <p>Ваш ход, шпион! Придумайте подсказку для своей команды.</p>
          <div className="clue-form">
            <input
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="Слово-подсказка"
              maxLength={30}
              onKeyDown={(e) => e.key === 'Enter' && submitClue()}
            />
            <input
              type="number"
              value={count}
              min={1}
              max={8}
              onChange={(e) => setCount(Number(e.target.value))}
            />
            <button className="btn-get-clue" onClick={submitClue}>
              Дать подсказку
            </button>
          </div>
          {error && <div className="clue-error">{error}</div>}
        </div>
      ) : clue ? (
        <div className="clue-card">
          <div className="clue-team">
            {currentTurn === 'red' ? '🔴 Красные' : '🔵 Синие'} — ход
          </div>
          <div className="clue-content">
            <span className="clue-word">{clue.word}</span>
            <span className="clue-count">{clue.count} карточек</span>
          </div>
          <p className="clue-instruction">
            {isSpymaster
              ? 'Ваша команда угадывает. Следите за доской!'
              : 'Угадывайте карточки, подходящие к подсказке!'}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default memo(ClueDisplay);
