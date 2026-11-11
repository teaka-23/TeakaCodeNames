import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { THEMES, type ThemeId } from '../data/themes';
import './LobbyPage.css';

const SESSION_KEY = 'codenames_session';

function LobbyPage() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<ThemeId>('it');
  const [error, setError] = useState('');
  const [createdRoom, setCreatedRoom] = useState<{ roomId: string; playerId: string } | null>(null);

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      setError('Введите ваше имя');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.createRoom(playerName.trim(), theme);
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        roomId: response.roomId,
        playerId: response.playerId,
        token: response.token,
        player: response.player,
      }));
      setCreatedRoom({ roomId: response.roomId, playerId: response.playerId });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось создать комнату');
    } finally {
      setLoading(false);
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

    setLoading(true);
    setError('');

    try {
      const code = roomId.trim().toUpperCase();
      const response = await api.joinRoom(code, playerName.trim(), spectate);
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        roomId: code,
        playerId: response.playerId,
        token: response.token,
        player: response.player,
      }));
      navigate(`/room/${code}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось присоединиться');
    } finally {
      setLoading(false);
    }
  };

  const roomLink = createdRoom
    ? `${window.location.origin}/room/${createdRoom.roomId}`
    : '';

  const copyRoomCode = () => {
    if (createdRoom) {
      navigator.clipboard.writeText(createdRoom.roomId);
    }
  };

  const copyRoomLink = () => {
    if (roomLink) {
      navigator.clipboard.writeText(roomLink);
    }
  };

  return (
    <div className="lobby-container">
      <div className="app-header">
        <h1>🕵️ Codenames</h1>
        <p>Командная игра на ассоциации. Тему выбирает создатель комнаты.</p>
      </div>

      <div className="lobby-card">
        <div className="input-section">
          <div className="form-group">
            <label>Ваше имя</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Введите имя..."
              maxLength={20}
            />
          </div>

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

          <div className="actions">
            <button
              className="btn-create"
              onClick={handleCreateRoom}
              disabled={loading || !playerName.trim()}
            >
              {loading ? 'Создаю...' : 'Создать комнату'}
            </button>

            <button
              className="btn-join"
              onClick={() => handleJoinRoom(false)}
              disabled={loading || !roomId.trim()}
            >
              {loading ? 'Вхожу...' : 'Присоединиться'}
            </button>
          </div>

          <div className="join-input">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="Код комнаты (напр., ABC123)"
              maxLength={6}
              className="room-input"
            />
            <button
              className="btn-spectate"
              onClick={() => handleJoinRoom(true)}
              disabled={loading || !roomId.trim() || !playerName.trim()}
              title="Смотреть игру без участия"
            >
              👀 Наблюдать
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>

        {createdRoom && (
          <div className="room-created">
            <h3>Комната создана!</h3>
            <p>Тема: {THEMES.find((item) => item.id === theme)?.title}. Поделитесь кодом или ссылкой:</p>
            <div className="room-code" onClick={copyRoomCode}>
              <span>{createdRoom.roomId}</span>
              <button type="button" className="copy-btn">Копировать код</button>
            </div>
            <div className="room-link" onClick={copyRoomLink}>
              <span>{roomLink}</span>
              <button type="button" className="copy-btn">Копировать ссылку</button>
            </div>
            <p className="hint">Друзья откроют ссылку или введут код в лобби</p>
            <button
              className="btn-wait"
              onClick={() => navigate(`/room/${createdRoom.roomId}`)}
            >
              Войти в комнату
            </button>
          </div>
        )}

        <div className="how-to-play">
          <h4>Как играть</h4>
          <ul>
            <li>🔴 <strong>Красная команда</strong> vs <strong>🔵 Синяя команда</strong></li>
            <li>🕵️ У каждой команды есть <strong>Шпион</strong>, который даёт подсказки</li>
            <li>👆 Угадывайте карточки, подходящие вашему цвету</li>
            <li>⚠️ Избегайте <strong>Ассасина</strong> — мгновенное поражение!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default LobbyPage;
