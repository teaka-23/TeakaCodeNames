# ADR 0001: Baseline architecture (current implementation)

- Status: Accepted
- Date: 2026-11-11
- Deciders: project maintainers

## Context

Нужно зафиксировать уже работающую архитектуру CodeNames IT Edition как baseline, прежде чем добавлять новые каналы коммуникации (чат / расширенный лог). Источники истины в коде: `backend/`, `frontend/`, `docker-compose.yml`, `render.yaml`, `design.md`.

## Decision

### 1. Два процесса: REST + WebSocket API и SPA

- **Backend:** Node.js, Express 5, TypeScript, библиотека `ws` на том же HTTP-сервере (`/api/*` + `/ws`).
- **Frontend:** React + Vite + React Router + Axios; UI на русском.
- Локально/Docker: nginx проксирует `/api` и `/ws` same-origin ([`frontend/nginx.conf`](../../frontend/nginx.conf)).
- Render: Static Site + Web Service; фронт знает API через `VITE_BACKEND_URL` ([`frontend/.env.production`](../../frontend/.env.production), [`render.yaml`](../../render.yaml)).

### 2. Разделение транспорта по фазам

| Фаза | Транспорт | Примеры |
|------|-----------|---------|
| Лобби / setup | HTTP REST | create/join room, claim seat, start, themes |
| Живая партия | WebSocket | clue, guess, skip, turn timer, state sync |

Клиент после входа в комнату держит WS с query `roomId`, `playerId`, `token`. Сервер — источник истины; после мутаций шлёт `game_update` (и узкие события вроде `guess_result`, `start_round`).

### 3. Состояние комнат: in-memory, один инстанс

- [`RoomManager`](../../backend/src/utils/roomManager.ts) хранит комнаты в памяти процесса.
- Опциональная персистентность через [`PersistenceStore`](../../backend/src/utils/persistence.ts):
  - по умолчанию / Render Free: **in-memory** (комнаты теряются при restart/sleep);
  - Docker: `PERSISTENCE_DRIVER=file` → JSON-снимок (без WS-соединений).
- Горизонтальное масштабирование **не** поддерживается без общего store (Redis и т.п.) — это осознанный trade-off.

### 4. Правила партии на сервере

- Колода 5×5: 8 red / 8 blue / 8 civilian / 1 assassin.
- Роли: spymaster / guesser / spectator; команды red/blue.
- Подсказка шпиона — **структурированная** (`word` + `count` 1..8) через WS `start_round`, не свободный текст.
- История подсказок: `gameState.clueHistory` (команда, слово, число).
- Таймер хода на сервере; при истечении — `turn_expired` + смена хода.
- Цвета карт видит spymaster (и debug/demo); guesser — только после reveal.

### 5. Темы колоды на сервере

Пакеты слов/картинок: `it` | `football` | `yoga` | `movies` в [`backend/src/themes/`](../../backend/src/themes/). Хост выбирает тему при создании комнаты; демо берёт колоду через `GET /api/themes/:theme/deal`.

### 6. Безопасность (текущий уровень)

- Helmet + rate limit на `/api`.
- CORS allowlist (`CORS_ORIGINS`); на Render дополнительно допускаются origin `*.onrender.com`.
- `crossOriginResourcePolicy: cross-origin` — чтобы static site мог читать API на другом хосте.
- WS без cookie-сессий: доступ по room token в query string.

### 7. Чего baseline намеренно не содержит

- Свободный текстовый чат комнаты или команды.
- Отметки целевых карт шпионом под подсказку (mark targets).
- Общий event log ходов (только `clueHistory`).
- Redis / multi-instance sync.
- Встроенный voice/video.

Эти темы — отдельные ADR (следующий — коммуникация в партии: чат + лог + targets).

## Consequences

### Positive

- Простая ментальная модель: один процесс API, один SPA.
- Легко деплоить (Docker Compose или Render Free).
- Игровые правила централизованы на сервере — сложнее читерить с клиента.
- Подсказка отделена от «болтовни» — правила Codenames сохраняются.

### Negative / risks

- Split-host на Render требует синхронизации `VITE_BACKEND_URL` / CORS при смене hostname.
- In-memory на Free: sleep/redeploy = потеря комнат.
- Один инстанс ограничивает рост без смены persistence.
- `clueHistory` недостаточен для полного разбора партии (нет guess/skip в логе).

## References

- [`design.md`](../../design.md) — исходный дизайн
- [`spec.md`](../../spec.md) — функциональные требования
- [`DEPLOY.md`](../../DEPLOY.md) — Render / Docker / VPS
