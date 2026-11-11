import { memo, useEffect, useState } from 'react';
import type { TeamColor } from '../types';
import './TurnTimer.css';

interface TurnTimerProps {
  deadline: number | null;
  currentTurn: TeamColor;
}

function getRemainingSeconds(deadline: number | null): number {
  if (deadline === null) return 0;
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

function TurnTimer({ deadline, currentTurn }: TurnTimerProps) {
  const [remaining, setRemaining] = useState<number>(() => getRemainingSeconds(deadline));

  useEffect(() => {
    if (deadline === null) return;

    const tick = () => setRemaining(getRemainingSeconds(deadline));

    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [deadline]);

  if (deadline === null) return null;

  const urgent = remaining <= 10;

  return (
    <div className={`turn-timer team-${currentTurn} ${urgent ? 'urgent' : ''}`}>
      <span className="timer-icon" aria-hidden="true">⏱️</span>
      <span className="timer-value">{remaining}</span>
      <span className="timer-label">сек</span>
      <div className="timer-bar">
        <div
          className="timer-bar-fill"
          style={{ width: `${Math.min(100, (remaining / 60) * 100)}%` }}
        />
      </div>
    </div>
  );
}

export default memo(TurnTimer);
