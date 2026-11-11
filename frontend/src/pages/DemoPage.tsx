import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GameBoard from '../components/GameBoard';
import Scoreboard from '../components/Scoreboard';
import { api, withWarmupHint } from '../services/api';
import { THEMES, type ThemeId } from '../data/themes';
import { shuffleDeal } from '../data/demoDecks';
import type { Card, CardColor, GameState as SharedGameState, TeamColor } from '../types';
import './DemoPage.css';

/** Local demo subset of the shared GameState (no room/WS fields). */
type DemoGameState = Pick<
  SharedGameState,
  'cards' | 'scores' | 'remainingCards' | 'currentTurn' | 'status' | 'winner'
> & { status: 'playing' | 'finished'; winner: TeamColor | null };

function buildCards(
  entries: Array<{ word: string; picture: string }>,
  startingTeam: TeamColor
): Card[] {
  const other: TeamColor = startingTeam === 'red' ? 'blue' : 'red';
  const colors: CardColor[] = [];
  for (let i = 0; i < 9; i++) colors.push(startingTeam);
  for (let i = 0; i < 8; i++) colors.push(other);
  for (let i = 0; i < 7; i++) colors.push('civilian');
  colors.push('assassin');

  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }

  return entries.slice(0, 25).map((entry, index) => ({
    word: entry.word,
    picture: entry.picture,
    color: colors[index],
    x: index % 5,
    y: Math.floor(index / 5),
    revealed: false,
  }));
}

function createInitialGameState(cards: Card[], startingTeam: TeamColor): DemoGameState {
  return {
    cards,
    scores: { red: 0, blue: 0 },
    remainingCards: {
      red: startingTeam === 'red' ? 9 : 8,
      blue: startingTeam === 'blue' ? 9 : 8,
      civilian: 7,
      assassin: 1,
    },
    currentTurn: startingTeam,
    status: 'playing',
    winner: null,
  };
}

function DemoPage() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<ThemeId>('it');
  const [deckKey, setDeckKey] = useState(0);
  const [gameState, setGameState] = useState<DemoGameState | null>(null);
  const [loadHint, setLoadHint] = useState('');
  const [offline, setOffline] = useState(false);
  const [debugMode, setDebugMode] = useState(true);
  const [turnCount, setTurnCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setGameState(null);
    setLoadHint('');
    setOffline(false);

    withWarmupHint(
      () => api.dealTheme(theme),
      () => {
        if (!cancelled) setLoadHint('Сервер просыпается… обычно до минуты на бесплатном тарифе.');
      }
    )
      .then((cards) => {
        if (cancelled) return;
        const start: TeamColor = Math.random() < 0.5 ? 'red' : 'blue';
        setGameState(createInitialGameState(buildCards(cards, start), start));
        setTurnCount(0);
        setLoadHint('');
        setOffline(false);
      })
      .catch(() => {
        if (cancelled) return;
        const start: TeamColor = Math.random() < 0.5 ? 'red' : 'blue';
        setGameState(createInitialGameState(buildCards(shuffleDeal(theme), start), start));
        setTurnCount(0);
        setOffline(true);
        setLoadHint('API недоступен — играем с локальной колодой.');
      });

    return () => {
      cancelled = true;
    };
  }, [theme, deckKey]);

  const handleGuess = (cardIndex: number) => {
    if (!gameState) return;
    const card = gameState.cards[cardIndex];
    if (!card || card.revealed || gameState.status === 'finished') return;

    setGameState(prev => {
      if (!prev) return prev;
      const picked = prev.cards[cardIndex];
      const cards = prev.cards.map((c, i) => (i === cardIndex ? { ...c, revealed: true } : c));
      const remaining = { ...prev.remainingCards };
      const scores = { ...prev.scores };
      let currentTurn = prev.currentTurn;
      let status = prev.status;
      let winner: TeamColor | null = null;

      const finish = (team: TeamColor) => {
        status = 'finished';
        winner = team;
        for (let i = 0; i < cards.length; i++) cards[i] = { ...cards[i], revealed: true };
      };

      if (picked.color === 'assassin') {
        remaining.assassin = 0;
        finish(currentTurn === 'red' ? 'blue' : 'red');
      } else if (picked.color === currentTurn) {
        scores[currentTurn]++;
        remaining[currentTurn]--;
        if (remaining[currentTurn] === 0) finish(currentTurn);
      } else if (picked.color === 'civilian') {
        remaining.civilian--;
        currentTurn = currentTurn === 'red' ? 'blue' : 'red';
      } else if (picked.color === 'red' || picked.color === 'blue') {
        const owner = picked.color;
        scores[owner]++;
        remaining[owner]--;
        if (remaining[owner] === 0) finish(owner);
        else currentTurn = currentTurn === 'red' ? 'blue' : 'red';
      }

      return { cards, scores, remainingCards: remaining, currentTurn, status, winner };
    });

    setTurnCount(prev => prev + 1);
  };

  const handleReset = () => {
    setDeckKey(key => key + 1);
  };

  return (
    <div className="demo-page">
      <div className="demo-header">
        <button className="btn-back" onClick={() => navigate('/')}>
          ← На главную
        </button>

        <h1>Демо-режим</h1>
        <p className="demo-subtitle">
          {offline
            ? 'Локальная колода — ходы в браузере, без комнаты и WebSocket.'
            : 'Колода с сервера, ходы в браузере — без комнаты и WebSocket.'}
        </p>
      </div>

      <div className="demo-themes" role="radiogroup" aria-label="Тема демо">
        {THEMES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={theme === item.id}
            className={`theme-option ${theme === item.id ? 'selected' : ''}`}
            onClick={() => setTheme(item.id)}
          >
            {item.title}
          </button>
        ))}
      </div>

      <div className="demo-controls">
        <button
          className={`btn-debug ${debugMode ? 'active' : ''}`}
          onClick={() => setDebugMode(!debugMode)}
        >
          {debugMode ? 'Скрыть цвета' : 'Показать расклад'}
        </button>
        <button className="btn-reset" onClick={handleReset}>
          Новая раздача
        </button>
      </div>

      {loadHint && <p className={`demo-hint ${offline ? 'offline' : ''}`} role="status">{loadHint}</p>}
      {!gameState && !loadHint && <p className="demo-subtitle">Загрузка колоды...</p>}
      {!gameState && loadHint && !offline && <p className="demo-subtitle">Ждём ответ API…</p>}

      {gameState && (
        <>
          <div className="demo-stats">
            <div className="stat-item">
              <span className="stat-label">Ходов сделано:</span>
              <span className="stat-value">{turnCount}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Текущая команда:</span>
              <span className={`stat-value team-${gameState.currentTurn}`}>
                {gameState.currentTurn === 'red' ? 'Красные' : 'Синие'}
              </span>
            </div>
          </div>

          <Scoreboard
            scores={gameState.scores}
            remaining={gameState.remainingCards}
            currentTurn={gameState.currentTurn}
          />

          {gameState.status === 'finished' && (
            <div className="game-finished">
              <h2>Игра окончена</h2>
              {gameState.winner === 'red' ? (
                <p className="winner-red">Красные победили</p>
              ) : gameState.winner === 'blue' ? (
                <p className="winner-blue">Синие победили</p>
              ) : (
                <p>Ничья</p>
              )}
              <button className="btn-play-again" onClick={handleReset}>
                Новая раздача
              </button>
            </div>
          )}

          <GameBoard
            cards={gameState.cards}
            onGuess={handleGuess}
            disabled={gameState.status === 'finished'}
            showAll={debugMode || gameState.status === 'finished'}
          />
        </>
      )}

      <div className="demo-info">
        <h3>Как тестировать</h3>
        <ul>
          <li><strong>Тема</strong> — переключите колоду сверху, раздача обновится</li>
          <li><strong>Картинка</strong> — знак при слове не выдаёт цвет команды</li>
          <li><strong>Расклад</strong> — цвета видны только при «Показать расклад»</li>
          <li><strong>Победа</strong> — откройте все карточки своей команды (9 у стартовой, 8 у второй)</li>
          <li><strong>Поражение</strong> — откройте ассасина</li>
        </ul>
      </div>
    </div>
  );
}

export default DemoPage;
