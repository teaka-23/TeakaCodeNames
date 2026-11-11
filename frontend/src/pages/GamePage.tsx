import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { wsClient } from '../services/webSocket';
import type { Player, GameState, TeamColor, Card, WSMessage, PlayerRole, ChatMessage, GameEvent } from '../types';
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [sideTab, setSideTab] = useState<'log' | 'chat'>('log');
  const [sideSheetOpen, setSideSheetOpen] = useState(false);
  const [connection, setConnection] = useState<'online' | 'reconnecting' | 'offline'>('online');
  const [reconnectLabel, setReconnectLabel] = useState('');

  const showNotification = useCallback((text: string, ms = 4000) => {
    setNotification(text);
    window.setTimeout(() => setNotification(null), ms);
  }, []);

  const copyText = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification(`${label} скопирован`, 1600);
    } catch {
      showNotification('Не удалось скопировать', 2000);
    }
  }, [showNotification]);

  useEffect(() => {
    if (!roomId) return;
    const upperRoomId = roomId.toUpperCase();

    const session = loadSession(upperRoomId);
    if (session) {
      wsClient.connect(upperRoomId, session.playerId, session.token);
      api.getRoom(upperRoomId, { playerId: session.playerId, token: session.token })
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
          `Время вышло — ход: ${payload.currentTurn === 'red' ? 'красные' : 'синие'}`
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
          const winnerText = payload.winner === 'red' ? 'Красные' : 'Синие';
          showNotification(`${winnerText} победили`);
        }
        return;
      }

      if (message.type === 'chat_history') {
        const payload = message.payload as { messages: ChatMessage[] };
        setChatMessages(payload.messages ?? []);
        return;
      }

      if (message.type === 'chat') {
        const payload = message.payload as ChatMessage;
        setChatMessages((prev) => [...prev, payload].slice(-100));
        return;
      }

      if (message.type === 'ws_connected') {
        setConnection('online');
        setReconnectLabel('');
        return;
      }

      if (message.type === 'ws_reconnecting') {
        const payload = message.payload as { attempt?: number; max?: number };
        setConnection('reconnecting');
        setReconnectLabel(
          `Переподключение ${payload.attempt ?? '?'}/${payload.max ?? '?'}…`
        );
        return;
      }

      if (message.type === 'ws_disconnected') {
        const payload = message.payload as { code?: number };
        if (typeof payload.code === 'number' && payload.code < 4000) {
          setConnection('reconnecting');
        }
        return;
      }

      if (message.type === 'ws_send_failed') {
        showNotification('Нет связи — ход не отправлен', 2500);
        return;
      }

      if (message.type === 'error') {
        const payload = message.payload as { message?: string };
        showNotification(payload.message || 'Ошибка действия', 3000);
        return;
      }

      if (message.type === 'ws_reconnect_failed') {
        setConnection('offline');
        setReconnectLabel('Связь потеряна');
        showNotification('Потеряно соединение с сервером');
      }
    };

    const types = [
      'game_update',
      'player_list',
      'start_round',
      'turn_expired',
      'guess_result',
      'chat',
      'chat_history',
      'error',
      'ws_connected',
      'ws_disconnected',
      'ws_reconnecting',
      'ws_send_failed',
      'ws_reconnect_failed',
    ];
    types.forEach(t => wsClient.on(t, handleMessage));

    return () => {
      types.forEach(t => wsClient.off(t, handleMessage));
    };
  }, [gameData?.playerId, showNotification]);

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

  const handleMarkToggle = useCallback((cardIndex: number) => {
    const cards = gameData?.gameState?.cards;
    if (!cards?.[cardIndex] || cards[cardIndex].revealed) return;
    const word = cards[cardIndex].word;
    const current = gameData?.gameState?.clueTargets ?? [];
    const next = current.includes(word)
      ? current.filter((w) => w !== word)
      : [...current, word].slice(0, 8);
    wsClient.send({ type: 'mark_targets', payload: { words: next } });
  }, [gameData?.gameState?.cards, gameData?.gameState?.clueTargets]);

  const handleBoardClick = useCallback((cardIndex: number) => {
    if (gameData?.gameState?.status === 'spymaster-ready'
      && gameData.player?.role === 'spymaster'
      && gameData.player.team === gameData.gameState.currentTurn) {
      handleMarkToggle(cardIndex);
      return;
    }
    handleGuess(cardIndex);
  }, [gameData?.gameState?.status, gameData?.gameState?.currentTurn, gameData?.player, handleGuess, handleMarkToggle]);

  const handleSkipTurn = useCallback(() => {
    wsClient.send({ type: 'skip_turn', payload: {} });
  }, []);

  const handleStartRound = useCallback((clue?: { word: string; count: number }) => {
    if (!clue?.word.trim()) return;
    wsClient.send({ type: 'start_round', payload: { clue } });
  }, []);

  const handleSendChat = useCallback(() => {
    const text = chatDraft.trim();
    if (!text) return;
    wsClient.send({ type: 'chat', payload: { text } });
    setChatDraft('');
  }, [chatDraft]);

  const handleClaimSeat = useCallback(async (team: TeamColor, role: Exclude<PlayerRole, 'spectator'>) => {
    if (!gameData?.playerId || !gameData.roomId) return;
    setError('');
    try {
      wsClient.send({ type: 'claim_seat', payload: { team, role } });
      const response = await api.claimSeat(
        gameData.roomId,
        gameData.playerId,
        gameData.token,
        team,
        role
      );
      setGameData(prev => syncPlayer(prev, response.gameState));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось занять место');
    }
  }, [gameData?.playerId, gameData?.roomId, gameData?.token]);

  const handleStartGame = useCallback(async () => {
    if (!gameData?.roomId || !gameData.playerId || !gameData.token) return;
    setStarting(true);
    setError('');
    try {
      const response = await api.startRoom(gameData.roomId, gameData.playerId, gameData.token);
      setGameData(prev => syncPlayer(prev, response.gameState));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось начать игру');
    } finally {
      setStarting(false);
    }
  }, [gameData?.roomId, gameData?.playerId, gameData?.token]);

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
          <button type="button" className="btn-back join-back" onClick={() => navigate('/')}>
            ← На главную
          </button>
          <h2>Комната: {roomId?.toUpperCase()}</h2>
          <p>Введите ваше имя, чтобы присоединиться</p>

          <div className="join-input">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Ваше имя..."
              maxLength={20}
              autoComplete="nickname"
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
          </div>

          <button className="btn-join-game" onClick={handleJoin} disabled={!playerName.trim()}>
            Присоединиться
          </button>

          {error && <div className="error" role="alert">{error}</div>}
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
  if (!gameState) {
    return (
      <div className="game-loading">
        <div className="spinner"></div>
        <p>Синхронизация комнаты...</p>
      </div>
    );
  }

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
  const isHost = Boolean(gameState.hostId) && player.id === gameState.hostId;
  const canStartGame =
    waiting
    && isHost
    && activePlayers.length >= 3
    && redPlayers.length > 0
    && bluePlayers.length > 0;
  const roomLink = `${window.location.origin}/room/${gameData.roomId}`;
  const eventLog = gameState.eventLog ?? [];
  const clueTargets = gameState.clueTargets ?? [];
  const markMode = canStartRound;
  const winner: TeamColor | null =
    gameState.winner ??
    (gameState.scores.red === gameState.scores.blue
      ? null
      : gameState.scores.red > gameState.scores.blue
        ? 'red'
        : 'blue');

  const connectionBanner = connection !== 'online' ? (
    <div
      className={`connection-banner ${connection === 'offline' ? 'offline' : ''}`}
      role="status"
      aria-live="polite"
    >
      {reconnectLabel || (connection === 'offline' ? 'Нет связи' : 'Переподключение…')}
    </div>
  ) : null;

  if (waiting) {
    return (
      <div className="game-container">
        {notification && (
          <div className="toast-notification" role="status" aria-live="polite">
            {notification}
          </div>
        )}
        {connectionBanner}

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
          <p>
            Сядьте в команду полевым, затем один игрок может стать шпионом.
            Нужны минимум 3 игрока и обе команды.
          </p>

          <div className="invite-box">
            <div className="invite-row">
              <span className="invite-label">Код</span>
              <strong>{gameData.roomId}</strong>
              <button type="button" className="copy-btn" onClick={() => copyText(gameData.roomId, 'Код')}>
                Копировать
              </button>
            </div>
            <div className="invite-row">
              <span className="invite-label">Ссылка</span>
              <span className="invite-link">{roomLink}</span>
              <button type="button" className="copy-btn" onClick={() => copyText(roomLink, 'Ссылка')}>
                Копировать
              </button>
            </div>
          </div>

          <div className="seat-board">
            {(['red', 'blue'] as TeamColor[]).map((team) => {
              const teamPlayers = team === 'red' ? redPlayers : bluePlayers;
              const spy = teamPlayers.find((p) => p.role === 'spymaster');
              const onThisTeam = player.team === team && player.role !== 'spectator';
              const teamFull = teamPlayers.length >= 3;
              const canJoinAsGuesser =
                (!onThisTeam || player.role === 'spymaster' || isSpectator)
                && (!teamFull || onThisTeam);
              return (
                <div key={team} className={`seat-column team-${team}`}>
                  <h3>{team === 'red' ? 'Красные' : 'Синие'}</h3>

                  <div className="seat-roster">
                    {teamPlayers.length === 0 && (
                      <p className="seat-empty">Пока пусто</p>
                    )}
                    {teamPlayers.map((p) => (
                      <div key={p.id} className={`seat-player ${p.id === player.id ? 'me' : ''}`}>
                        <span>{p.name}{p.id === player.id ? ' (вы)' : ''}</span>
                        <span className="seat-role">
                          {p.role === 'spymaster' ? 'шпион' : 'полевой'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="seat-actions">
                    <button
                      type="button"
                      className="btn-seat"
                      onClick={() => handleClaimSeat(team, 'guesser')}
                      disabled={
                        (player.team === team && player.role === 'guesser')
                        || (!onThisTeam && teamFull)
                        || (isSpectator && activePlayers.length >= 6 && !canJoinAsGuesser)
                      }
                    >
                      {onThisTeam && player.role === 'guesser' ? 'Вы здесь' : 'Сесть полевым'}
                    </button>
                    <button
                      type="button"
                      className="btn-seat secondary"
                      onClick={() => handleClaimSeat(team, 'spymaster')}
                      disabled={spy?.id === player.id || (!onThisTeam && teamFull)}
                    >
                      {spy?.id === player.id ? 'Вы шпион' : spy ? 'Стать шпионом' : 'Сесть шпионом'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {isSpectator && (
            <p className="lobby-note">Вы наблюдатель. Сядьте в команду, чтобы играть.</p>
          )}

          {isHost ? (
            <button
              className="btn-start-game"
              onClick={handleStartGame}
              disabled={!canStartGame || starting}
            >
              {starting
                ? 'Запускаю...'
                : canStartGame
                  ? 'Начать игру'
                  : `Ждём игроков (${activePlayers.length}/3+)`}
            </button>
          ) : (
            <p className="lobby-note">
              Начать может только создатель комнаты
              {activePlayers.length < 3 ? ` · ждём игроков (${activePlayers.length}/3+)` : ''}.
            </p>
          )}

          {error && <div className="error">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      {notification && (
        <div className="toast-notification" role="status" aria-live="polite">
          {notification}
        </div>
      )}
      {connectionBanner}

      <div className="game-header">
        <button className="btn-back" onClick={handleLeave}>
          ← Выйти из игры
        </button>

        <div className="player-info">
          <span className="theme-chip">{themeTitle(gameState.theme)}</span>
          {isSpectator ? (
            <span className="spectator-badge">Наблюдатель</span>
          ) : (
            <span className={`team-badge team-${player.team}`}>
              {player.team === 'red' ? 'Красные' : 'Синие'}
            </span>
          )}
          <span className="player-name">{player.name}</span>
          {isSpymaster && <span className="spymaster-badge">Шпион</span>}
        </div>
      </div>

      {markMode && (
        <div className="mark-mode-banner" role="status" aria-live="polite">
          <strong>Режим отметки целей</strong>
          <span>Клик по карте на доске отмечает цель для подсказки.</span>
          <span className="mark-count">Отмечено: {clueTargets.length}</span>
        </div>
      )}

      {isSpymaster && !gameFinished && !markMode && (
        <div className="spymaster-panel">
          <span>Вы видите расклад. Когда ваш ход — отметьте цели на доске и дайте подсказку.</span>
        </div>
      )}

      {isSpectator && (
        <div className="spectator-panel">
          <span>Режим наблюдения: расклад виден, ходы недоступны.</span>
        </div>
      )}

      <Scoreboard
        scores={gameState.scores}
        remaining={gameState.remainingCards}
        currentTurn={gameState.currentTurn}
      />

      {!gameFinished && (gameState.turnDurationMs ?? 60_000) > 0 && (
        <TurnTimer
          deadline={gameState.turnDeadline}
          currentTurn={gameState.currentTurn}
          durationMs={gameState.turnDurationMs ?? 60_000}
        />
      )}

      {gameFinished ? (
        <div className="game-over">
          <h2>Игра окончена</h2>
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
            targetCount={clueTargets.length}
            guessesRemaining={gameState.guessesRemaining ?? null}
          />

          {!isSpymaster && isCurrentTeam && gameState.status === 'playing' && (
            <button className="btn-skip" onClick={handleSkipTurn}>
              Пропустить ход
            </button>
          )}
        </>
      )}

      <div className="game-main-row">
        <GameBoard
          cards={gameState.cards}
          onGuess={handleBoardClick}
          disabled={!isCurrentTeam || isSpymaster || gameFinished || gameState.status !== 'playing'}
          showAll={canSeeColors}
          markMode={markMode}
          markedWords={clueTargets}
        />

        <button
          type="button"
          className="side-sheet-fab"
          onClick={() => setSideSheetOpen(true)}
        >
          Журнал · Чат
        </button>

        {sideSheetOpen && (
          <button
            type="button"
            className="side-sheet-backdrop"
            aria-label="Закрыть панель"
            onClick={() => setSideSheetOpen(false)}
          />
        )}

        <aside className={`side-panel ${sideSheetOpen ? 'sheet-open' : ''}`}>
          <div className="side-sheet-header">
            <span>Журнал и чат</span>
            <button type="button" className="side-sheet-close" onClick={() => setSideSheetOpen(false)}>
              Закрыть
            </button>
          </div>

          <div className="side-tabs" role="tablist" aria-label="Журнал и чат">
            <button
              type="button"
              role="tab"
              aria-selected={sideTab === 'log'}
              className={sideTab === 'log' ? 'active' : ''}
              onClick={() => setSideTab('log')}
            >
              Журнал
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sideTab === 'chat'}
              className={sideTab === 'chat' ? 'active' : ''}
              onClick={() => setSideTab('chat')}
            >
              Чат
            </button>
          </div>

          <div
            className={`match-log ${sideTab === 'log' ? 'tab-active' : 'tab-hidden'}`}
            role="tabpanel"
            aria-label="Журнал партии"
          >
            <div className="side-panel-label">Журнал</div>
            {eventLog.length === 0 ? (
              <p className="side-empty">Пока пусто — события партии появятся здесь.</p>
            ) : (
              <ul>
                {eventLog.map((entry) => (
                  <li key={entry.id} className={`log-item kind-${entry.kind}`}>
                    {formatLogEntry(entry)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div
            className={`room-chat ${sideTab === 'chat' ? 'tab-active' : 'tab-hidden'}`}
            role="tabpanel"
            aria-label="Чат комнаты"
          >
            <div className="side-panel-label">Чат</div>
            <div className="chat-messages">
              {chatMessages.length === 0 ? (
                <p className="side-empty">Напишите что-нибудь комнате. Подсказки шпиона сюда не входят.</p>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} className="chat-line">
                    <strong>{msg.playerName}</strong>
                    <span>{msg.text}</span>
                  </div>
                ))
              )}
            </div>
            <div className="chat-compose">
              <input
                type="text"
                value={chatDraft}
                maxLength={200}
                placeholder="Сообщение…"
                onChange={(e) => setChatDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              />
              <button type="button" onClick={handleSendChat} disabled={!chatDraft.trim()}>
                →
              </button>
            </div>
          </div>
        </aside>
      </div>

      <div className="player-list">
        <h4>Игроки ({gameState.players.length})</h4>
        <div className="players-grid">
          {gameState.players.map(p => (
            <div key={p.id} className={`player-item team-${p.team}`}>
              <span>{p.name}</span>
              <span className="player-role">
                {p.role === 'spymaster' ? 'шпион' : p.role === 'spectator' ? 'наблюдатель' : 'полевой'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatLogEntry(entry: GameEvent): string {
  const team = 'team' in entry
    ? (entry.team === 'red' ? 'Кр' : 'Си')
    : '';
  switch (entry.kind) {
    case 'clue': {
      const targets = entry.targetWords.length ? ` → ${entry.targetWords.join(', ')}` : '';
      return `${team} · подсказка «${entry.word}» ×${entry.count}${targets}`;
    }
    case 'guess':
      return `${team} · ${entry.playerName}: «${entry.word}» (${entry.correct ? 'своё' : entry.color})`;
    case 'skip':
      return `${team} · пропуск хода`;
    case 'turn_expired':
      return `${team} · время вышло`;
    case 'game_over':
      return entry.winner
        ? `Победа: ${entry.winner === 'red' ? 'красные' : 'синие'}`
        : 'Игра окончена';
  }
}

export default GamePage;
