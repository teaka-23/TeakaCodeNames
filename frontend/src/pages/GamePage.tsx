import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { wsClient } from '../services/webSocket';
import type { Player, GameState, TeamColor, Card, WSMessage } from '../types';
import GameBoard from '../components/GameBoard';
import Scoreboard from '../components/Scoreboard';
import ClueDisplay from '../components/ClueDisplay';
import TurnTimer from '../components/TurnTimer';
import './GamePage.css';

interface GameData {
  roomId: string;
  playerId: string;
  token: string;
  player: Player | null;
  gameState: GameState | null;
}

interface SessionData {
  roomId: string;
  playerId: string;
  token: string;
  player: Player;
}

const SESSION_KEY = 'codenames_session';

function loadSession(roomId: string): SessionData | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as SessionData;
    return session.roomId === roomId ? session : null;
  } catch {
    return null;
  }
}

function saveSession(session: SessionData) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [gameData, setGameData] = useState<GameData | null>(() => {
    if (!roomId) return null;
    const upperRoomId = roomId.toUpperCase();
    const session = loadSession(upperRoomId);
    if (!session) return null;
    return {
      roomId: upperRoomId,
      playerId: session.playerId,
      token: session.token,
      player: session.player,
      gameState: null,
    };
  });
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (text: string) => {
    setNotification(text);
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    if (!roomId) return;
    const upperRoomId = roomId.toUpperCase();

    const session = loadSession(upperRoomId);
    if (session) {
      wsClient.connect(upperRoomId, session.playerId, session.token);
      api.getRoom(upperRoomId)
        .then(res => setGameData(prev => prev ? { ...prev, gameState: res.gameState } : null))
        .catch(() => {
          clearSession();
          setGameData({
            roomId: upperRoomId,
            playerId: '',
            token: '',
            player: null,
            gameState: null,
          });
        })
        .finally(() => setLoading(false));
      return;
    }

    api.getRoom(upperRoomId)
      .then(res => {
        setGameData({
          roomId: upperRoomId,
          playerId: '',
          token: '',
          player: null,
          gameState: res.gameState,
        });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить игру');
      })
      .finally(() => setLoading(false));
  }, [roomId]);

  useEffect(() => {
    if (!gameData?.playerId) return;

    const handleMessage = (message: WSMessage) => {
      if (message.type === 'game_update') {
        const payload = message.payload as GameState;
        setGameData(prev => prev ? { ...prev, gameState: payload } : null);
        return;
      }

      if (message.type === 'player_list') {
        const players = message.payload as Player[];
        setGameData(prev => prev && prev.gameState
          ? { ...prev, gameState: { ...prev.gameState, players } }
          : prev);
        return;
      }

      if (message.type === 'start_round') {
        const payload = message.payload as { clue: { word: string; count: number } };
        showNotification(`Подсказка: ${payload.clue.word} — ${payload.clue.count}`);
        return;
      }

      if (message.type === 'turn_expired') {
        const payload = message.payload as { currentTurn: TeamColor };
        showNotification(
          `⏱️ Время вышло! Ход переходит: ${payload.currentTurn === 'red' ? '🔴 Красные' : '🔵 Синие'}`
        );
        return;
      }

      if (message.type === 'guess_result') {
        const payload = message.payload as {
          card: Card;
          correct: boolean;
          gameOver: boolean;
          winner?: TeamColor;
        };
        if (payload.gameOver) {
          const winnerText = payload.winner === 'red' ? '🔴 Красные' : '🔵 Синие';
          showNotification(`🏆 ${winnerText} победили!`);
        }
        return;
      }

      if (message.type === 'ws_reconnect_failed') {
        showNotification('⚠️ Потеряно соединение с сервером');
      }
    };

    const types = ['game_update', 'player_list', 'start_round', 'turn_expired', 'guess_result', 'ws_reconnect_failed'];
    types.forEach(t => wsClient.on(t, handleMessage));

    return () => {
      types.forEach(t => wsClient.off(t, handleMessage));
    };
  }, [gameData?.playerId]);

  useEffect(() => {
    return () => wsClient.disconnect();
  }, []);

  const handleJoin = async () => {
    const upperRoomId = roomId?.toUpperCase();
    if (!upperRoomId || !playerName.trim()) {
      setError('Введите имя');
      return;
    }

    setError('');
    try {
      const response = await api.joinRoom(upperRoomId, playerName.trim());

      const session: SessionData = {
        roomId: upperRoomId,
        playerId: response.playerId,
        token: response.token,
        player: response.player,
      };
      saveSession(session);

      setGameData({
        roomId: upperRoomId,
        playerId: response.playerId,
        token: response.token,
        player: response.player,
        gameState: response.gameState,
      });

      wsClient.connect(upperRoomId, response.playerId, response.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось присоединиться');
    }
  };

  const handleGuess = useCallback((cardIndex: number) => {
    wsClient.send({ type: 'guess', payload: { cardIndex } });
  }, []);

  const handleSkipTurn = useCallback(() => {
    wsClient.send({ type: 'skip_turn', payload: {} });
  }, []);

  const handleStartRound = useCallback((clue?: { word: string; count: number }) => {
    wsClient.send({ type: 'start_round', payload: clue ? { clue } : {} });
  }, []);

  const handleLeave = () => {
    wsClient.disconnect();
    clearSession();
    navigate('/lobby');
  };

  if (loading) {
    return (
      <div className="game-loading">
        <div className="spinner"></div>
        <p>Загрузка игры...</p>
      </div>
    );
  }

  if (!gameData?.player) {
    return (
      <div className="game-join">
        <div className="join-card">
          <h2>Комната: {roomId?.toUpperCase()}</h2>
          <p>Введите ваше имя, чтобы присоединиться</p>

          <div className="join-input">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Ваше имя..."
              maxLength={20}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
          </div>

          <button className="btn-join-game" onClick={handleJoin}>
            Присоединиться
          </button>

          {error && <div className="error">{error}</div>}
          {!error && gameData?.gameState && (
            <p className="join-hint">
              В комнате: {gameData.gameState.players.length} игроков
            </p>
          )}
        </div>
      </div>
    );
  }

  const { player, gameState } = gameData;
  if (!gameState) return null;

  const isSpectator = player.role === 'spectator';
  const isSpymaster = player.role === 'spymaster';
  const isCurrentTeam = !isSpectator && gameState.currentTurn === player.team;
  const canStartRound = isSpymaster && isCurrentTeam && gameState.status === 'spymaster-ready';
  const gameFinished = gameState.status === 'finished';
  // Spymasters and spectators see every card. At game over the board flips for everyone.
  const canSeeColors = isSpymaster || isSpectator || gameFinished;
  // Prefer the authoritative winner; fall back to the score for legacy states
  const winner: TeamColor | null =
    gameState.winner ??
    (gameState.scores.red === gameState.scores.blue
      ? null
      : gameState.scores.red > gameState.scores.blue
        ? 'red'
        : 'blue');

  return (
    <div className="game-container">
      {notification && <div className="toast-notification">{notification}</div>}

      <div className="game-header">
        <button className="btn-back" onClick={handleLeave}>
          ← Выйти из игры
        </button>

        <div className="player-info">
          {isSpectator ? (
            <span className="spectator-badge">👀 Наблюдатель</span>
          ) : (
            <span className={`team-badge team-${player.team}`}>
              {player.team === 'red' ? '🔴' : '🔵'} {player.team === 'red' ? 'КРАСНЫЕ' : 'СИНИЕ'}
            </span>
          )}
          <span className="player-name">{player.name}</span>
          {isSpymaster && <span className="spymaster-badge">🕵️ Шпион</span>}
        </div>
      </div>

      {isSpymaster && !gameFinished && (
        <div className="spymaster-panel">
          <span>👁️ Вы видите все карты. Дайте подсказку своей команде.</span>
        </div>
      )}

      {isSpectator && (
        <div className="spectator-panel">
          <span>👀 Режим наблюдения: вы видите расклад, но не участвуете в игре.</span>
        </div>
      )}

      <Scoreboard
        scores={gameState.scores}
        remaining={gameState.remainingCards}
        currentTurn={gameState.currentTurn}
      />

      {!gameFinished && (
        <TurnTimer deadline={gameState.turnDeadline} currentTurn={gameState.currentTurn} />
      )}

      {gameFinished ? (
        <div className="game-over">
          <h2>🏆 Игра окончена!</h2>
          <p>
            {winner === null ? (
              'Ничья!'
            ) : (
              <>
                Победила команда{' '}
                <span className={`team-${winner}`}>
                  {winner === 'red' ? 'КРАСНЫХ' : 'СИНИХ'}
                </span>
              </>
            )}
          </p>
          <button className="btn-play-again" onClick={handleLeave}>
            Вернуться в лобби
          </button>
        </div>
      ) : (
        <>
          <ClueDisplay
            clue={gameState.clues}
            currentTurn={gameState.currentTurn}
            canStartRound={canStartRound}
            onStartRound={handleStartRound}
            isSpymaster={isSpymaster}
          />

          {!isSpymaster && isCurrentTeam && (
            <button className="btn-skip" onClick={handleSkipTurn}>
              Пропустить ход
            </button>
          )}
        </>
      )}

      <GameBoard
        cards={gameState.cards}
        onGuess={handleGuess}
        disabled={!isCurrentTeam || isSpymaster || gameFinished || gameState.status !== 'playing'}
        showAll={canSeeColors}
      />

      <div className="player-list">
        <h4>Игроки ({gameState.players.length})</h4>
        <div className="players-grid">
          {gameState.players.map(p => (
            <div key={p.id} className={`player-item team-${p.team}`}>
              <span>{p.name}</span>
              <span className="player-role">{p.role === 'spymaster' ? '🕵️' : '👆'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GamePage;
