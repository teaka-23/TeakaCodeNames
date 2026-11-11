import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { wsClient } from '../services/webSocket';
import type { Player, GameState, TeamColor, Card, WSMessage, PlayerRole } from '../types';
import GameBoard from '../components/GameBoard';
import Scoreboard from '../components/Scoreboard';
import ClueDisplay from '../components/ClueDisplay';
import TurnTimer from '../components/TurnTimer';
import { themeTitle } from '../data/themes';
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

function syncPlayer(prev: GameData | null, gameState: GameState): GameData | null {
  if (!prev) return prev;
  const me = gameState.players.find((p) => p.id === prev.playerId) ?? prev.player;
  if (me && prev.player) {
    saveSession({
      roomId: prev.roomId,
      playerId: prev.playerId,
      token: prev.token,
      player: me,
    });
  }
  return { ...prev, gameState, player: me };
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
  const [starting, setStarting] = useState(false);

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
        .then(res => setGameData(prev => prev ? syncPlayer(prev, res.gameState) : null))
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
        setGameData(prev => syncPlayer(prev, payload));
        return;
      }

      if (message.type === 'player_list') {
        const players = message.payload as Player[];
        setGameData(prev => {
          if (!prev?.gameState) return prev;
          return syncPlayer(prev, { ...prev.gameState, players });
        });
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
    if (!clue?.word.trim()) return;
    wsClient.send({ type: 'start_round', payload: { clue } });
  }, []);

  const handleClaimSeat = useCallback(async (team: TeamColor, role: Exclude<PlayerRole, 'spectator'>) => {
    if (!gameData?.playerId || !gameData.roomId) return;
    setError('');
    try {
      wsClient.send({ type: 'claim_seat', payload: { team, role } });
      const response = await api.claimSeat(gameData.roomId, gameData.playerId, team, role);
      setGameData(prev => syncPlayer(prev, response.gameState));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось занять место');
    }
  }, [gameData?.playerId, gameData?.roomId]);

  const handleStartGame = useCallback(async () => {
    if (!gameData?.roomId) return;
    setStarting(true);
    setError('');
    try {
      const response = await api.startRoom(gameData.roomId);
      setGameData(prev => syncPlayer(prev, response.gameState));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось начать игру');
    } finally {
      setStarting(false);
    }
  }, [gameData?.roomId]);

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
  const waiting = gameState.status === 'waiting';
  // Spymasters and spectators see every card. At game over the board flips for everyone.
  const canSeeColors = isSpymaster || isSpectator || gameFinished;
  const activePlayers = gameState.players.filter((p) => p.role !== 'spectator');
  const redPlayers = activePlayers.filter((p) => p.team === 'red');
  const bluePlayers = activePlayers.filter((p) => p.team === 'blue');
  const canStartGame =
    waiting
    && activePlayers.length >= 3
    && redPlayers.length > 0
    && bluePlayers.length > 0;
  const roomLink = `${window.location.origin}/room/${gameData.roomId}`;
  const clueHistory = gameState.clueHistory ?? [];
  const winner: TeamColor | null =
    gameState.winner ??
    (gameState.scores.red === gameState.scores.blue
      ? null
      : gameState.scores.red > gameState.scores.blue
        ? 'red'
        : 'blue');

  if (waiting) {
    return (
      <div className="game-container">
        {notification && <div className="toast-notification">{notification}</div>}

        <div className="game-header">
          <button className="btn-back" onClick={handleLeave}>
            ← Выйти из игры
          </button>
          <div className="player-info">
            <span className="theme-chip">{themeTitle(gameState.theme)}</span>
            <span className="player-name">{player.name}</span>
          </div>
        </div>

        <div className="lobby-wait">
          <h2>Комната {gameData.roomId}</h2>
          <p>Выберите место. Нужны минимум 3 игрока и обе команды.</p>

          <div className="invite-box">
            <div className="invite-row">
              <span className="invite-label">Код</span>
              <strong>{gameData.roomId}</strong>
              <button type="button" className="copy-btn" onClick={() => navigator.clipboard.writeText(gameData.roomId)}>
                Копировать
              </button>
            </div>
            <div className="invite-row">
              <span className="invite-label">Ссылка</span>
              <span className="invite-link">{roomLink}</span>
              <button type="button" className="copy-btn" onClick={() => navigator.clipboard.writeText(roomLink)}>
                Копировать
              </button>
            </div>
          </div>

          <div className="seat-board">
            {(['red', 'blue'] as TeamColor[]).map((team) => {
              const teamPlayers = team === 'red' ? redPlayers : bluePlayers;
              const spy = teamPlayers.find((p) => p.role === 'spymaster');
              const guessers = teamPlayers.filter((p) => p.role === 'guesser');
              return (
                <div key={team} className={`seat-column team-${team}`}>
                  <h3>{team === 'red' ? '🔴 Красные' : '🔵 Синие'}</h3>

                  <div className="seat-slot">
                    <span className="seat-label">🕵️ Шпион</span>
                    {spy ? (
                      <div className={`seat-player ${spy.id === player.id ? 'me' : ''}`}>
                        {spy.name}{spy.id === player.id ? ' (вы)' : ''}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn-seat"
                        onClick={() => handleClaimSeat(team, 'spymaster')}
                        disabled={isSpectator && activePlayers.length >= 6}
                      >
                        Занять
                      </button>
                    )}
                    {spy && spy.id !== player.id && (
                      <button
                        type="button"
                        className="btn-seat secondary"
                        onClick={() => handleClaimSeat(team, 'spymaster')}
                      >
                        Стать шпионом
                      </button>
                    )}
                    {spy?.id === player.id && (
                      <button
                        type="button"
                        className="btn-seat secondary"
                        onClick={() => handleClaimSeat(team, 'guesser')}
                      >
                        Стать угадывающим
                      </button>
                    )}
                  </div>

                  <div className="seat-slot">
                    <span className="seat-label">👆 Угадывающие</span>
                    {guessers.map((p) => (
                      <div key={p.id} className={`seat-player ${p.id === player.id ? 'me' : ''}`}>
                        {p.name}{p.id === player.id ? ' (вы)' : ''}
                      </div>
                    ))}
                    {teamPlayers.length < 3 && (
                      <button
                        type="button"
                        className="btn-seat"
                        onClick={() => handleClaimSeat(team, 'guesser')}
                        disabled={player.team === team && player.role === 'guesser'}
                      >
                        Сесть угадывающим
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {isSpectator && (
            <p className="lobby-note">Вы наблюдатель. Займите место, чтобы играть.</p>
          )}

          <button
            className="btn-start-game"
            onClick={handleStartGame}
            disabled={!canStartGame || starting}
          >
            {starting ? 'Запускаю...' : canStartGame ? 'Начать игру' : `Ждём игроков (${activePlayers.length}/3+)`}
          </button>

          {error && <div className="error">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      {notification && <div className="toast-notification">{notification}</div>}

      <div className="game-header">
        <button className="btn-back" onClick={handleLeave}>
          ← Выйти из игры
        </button>

        <div className="player-info">
          <span className="theme-chip">{themeTitle(gameState.theme)}</span>
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

          {!isSpymaster && isCurrentTeam && gameState.status === 'playing' && (
            <button className="btn-skip" onClick={handleSkipTurn}>
              Пропустить ход
            </button>
          )}
        </>
      )}

      {clueHistory.length > 0 && (
        <div className="clue-history">
          <h4>Журнал подсказок</h4>
          <ol>
            {clueHistory.map((entry, index) => (
              <li key={`${entry.team}-${entry.word}-${index}`} className={`clue-history-item team-${entry.team}`}>
                <span>{entry.team === 'red' ? '🔴' : '🔵'}</span>
                <strong>{entry.word}</strong>
                <span>×{entry.count}</span>
              </li>
            ))}
          </ol>
        </div>
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
              <span className="player-role">
                {p.role === 'spymaster' ? '🕵️' : p.role === 'spectator' ? '👀' : '👆'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GamePage;
