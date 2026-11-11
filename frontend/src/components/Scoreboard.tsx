import { memo } from 'react';
import type { TeamColor } from '../types';
import './Scoreboard.css';

interface ScoreboardProps {
  scores: { red: number; blue: number };
  remaining: { red: number; blue: number; civilian: number; assassin: number };
  currentTurn: TeamColor;
}

function Scoreboard({ scores, remaining, currentTurn }: ScoreboardProps) {
  return (
    <div className="scoreboard">
      <div className={`team-score team-red ${currentTurn === 'red' ? 'active' : ''}`}>
        <div className="score-header">
          <span className="team-icon">🔴</span>
          <span className="team-name">Красные</span>
          {currentTurn === 'red' && <span className="turn-indicator">➡️</span>}
        </div>
        <div className="score-value">{scores.red}</div>
        <div className="score-remaining">
          Осталось: {remaining.red}
        </div>
      </div>

      <div className="vs">VS</div>

      <div className={`team-score team-blue ${currentTurn === 'blue' ? 'active' : ''}`}>
        <div className="score-header">
          <span className="team-icon">🔵</span>
          <span className="team-name">Синие</span>
          {currentTurn === 'blue' && <span className="turn-indicator">➡️</span>}
        </div>
        <div className="score-value">{scores.blue}</div>
        <div className="score-remaining">
          Осталось: {remaining.blue}
        </div>
      </div>
    </div>
  );
}

export default memo(Scoreboard);
