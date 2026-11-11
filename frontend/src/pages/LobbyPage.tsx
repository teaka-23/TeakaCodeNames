import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, withWarmupHint } from '../services/api';
import { THEMES, type ThemeId } from '../data/themes';
import './LobbyPage.css';

const SESSION_KEY = 'codenames_session';

function LobbyPage() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState<'create' | 'join' | 'spectate' | null>(null);
  const [theme, setTheme] = useState<ThemeId>('it');
  const [turnSeconds, setTurnSeconds] = useState(60);
  const [error, setError] = useState('');
  const [warmup, setWarmup] = useState(false);

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      setError('Введите ваше имя');
      return;
    }

    setLoading('create');
    setError('');
    setWarmup(false);

    try {
      const response = await withWarmupHint(
        () => api.createRoom(playerName.trim(), theme, turnSeconds),
        () => setWarmup(true)
      );
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        roomId: response.roomId,
        playerId: response.playerId,
        token: response.token,
        player: response.player,
      }));
      navigate(`/room/${response.roomId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось создать комнату');
      setLoading(null);
      setWarmup(false);
    }
  };

  const handleJoinRoom = async (spectate = false) => {
    if (!playerName.trim()) {
      setError('Введите ваше имя');
      return;
    }

    if (!roomId.trim()) {
      setError('Введите код комнаты');
      return;
    }

    setLoading(spectate ? 'spectate' : 'join');
    setError('');
    setWarmup(false);

    try {
      const code = roomId.trim().toUpperCase();
      const response = await withWarmupHint(
        () => api.joinRoom(code, playerName.trim(), spectate),
        () => setWarmup(true)
      );
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        roomId: code,
        playerId: response.playerId,
        token: response.token,
        player: response.player,
      }));
      navigate(`/room/${code}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось присоединиться');
      setLoading(null);
      setWarmup(false);
    }
  };

  const busy = loading !== null;
  const canJoin = Boolean(playerName.trim() && roomId.trim());

  return (
    <div className="lobby-container">
      <button type="button" className="btn-back" onClick={() => navigate('/')}>
        ← На главную
      </button>
      <div className="app-header">
        <h1>Codenames</h1>
        <p>Оперативный стол. Тему колоды выбирает создатель комнаты.</p>
      </div>

      <div className="lobby-card">
        <div className="form-group">
          <label htmlFor="lobby-name">Ваше имя</label>
          <input
            id="lobby-name"
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Введите имя..."
            maxLength={20}
            autoComplete="nickname"
          />
        </div>

        <div className="lobby-sections">
          <section className="lobby-section create-section">
            <h2>Создать игру</h2>
            <p className="section-blurb">Выберите тему и откройте комнату — код появится сразу внутри.</p>

            <div className="form-group">
              <label>Тема колоды</label>
              <div className="theme-grid" role="radiogroup" aria-label="Тема колоды">
                {THEMES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={theme === item.id}
                    className={`theme-option ${theme === item.id ? 'selected' : ''}`}
                    onClick={() => setTheme(item.id)}
                  >
                    <span className="theme-title">{item.title}</span>
                    <span className="theme-blurb">{item.blurb}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="lobby-timer">Таймер хода</label>
              <select
                id="lobby-timer"
                className="room-input"
                value={turnSeconds}
                onChange={(e) => setTurnSeconds(Number(e.target.value))}
              >
                <option value={60}>60 секунд</option>
                <option value={90}>90 секунд</option>
                <option value={30}>30 секунд</option>
                <option value={0}>Без таймера</option>
              </select>
            </div>

            <button
              className="btn-create"
              onClick={handleCreateRoom}
              disabled={busy || !playerName.trim()}
            >
              {loading === 'create' ? 'Создаю...' : 'Создать комнату'}
            </button>
          </section>

          <section className="lobby-section join-section">
            <h2>Войти в комнату</h2>
            <p className="section-blurb">Код от друга или ссылка вида /room/ABC123.</p>

            <div className="form-group">
              <label htmlFor="lobby-code">Код комнаты</label>
              <input
                id="lobby-code"
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder="Напр., ABC123"
                maxLength={6}
                className="room-input"
                onKeyDown={(e) => e.key === 'Enter' && canJoin && handleJoinRoom(false)}
              />
            </div>

            <div className="join-actions">
              <button
                className="btn-join"
                onClick={() => handleJoinRoom(false)}
                disabled={busy || !canJoin}
              >
                {loading === 'join' ? 'Вхожу...' : 'Присоединиться'}
              </button>
              <button
                className="btn-spectate"
                onClick={() => handleJoinRoom(true)}
                disabled={busy || !canJoin}
                title="Смотреть игру без участия"
              >
                {loading === 'spectate' ? 'Вхожу...' : 'Наблюдать'}
              </button>
            </div>
          </section>
        </div>

        {warmup && busy && (
          <p className="warmup-hint" role="status">
            Сервер просыпается… на бесплатном тарифе это может занять до минуты.
          </p>
        )}
        {error && <div className="error-message" role="alert">{error}</div>}

        <div className="how-to-play">
          <h4>Как играть</h4>
          <ul>
            <li><strong>Красные</strong> против <strong>синих</strong></li>
            <li>У каждой команды есть <strong>шпион</strong> с подсказками</li>
            <li>Полевые открывают карточки своего цвета</li>
            <li>Ассасин — мгновенное поражение</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default LobbyPage;
