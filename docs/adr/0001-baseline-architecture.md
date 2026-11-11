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

### 3. Состояние комнат: in-memory + optional file, один инстанс

- [`RoomManager`](../../backend/src/utils/roomManager.ts) хранит комнаты в памяти процесса.
- Опциональная персистентность через [`PersistenceStore`](../../backend/src/utils/persistence.ts):
  - local / Docker: `PERSISTENCE_DRIVER=file` → JSON-снимок (без WS-соединений);
  - Render Free blueprint: file → `/tmp/...` (soft crash recovery; sleep всё ещё стирает).
- Горизонтальное масштабирование **не** поддерживается без общего store (Redis и т.п.) — это осознанный trade-off.

### 4. Правила партии на сервере

- Колода 5×5: 8 red / 8 blue / 8 civilian / 1 assassin.
- Роли: spymaster / guesser / spectator; команды red/blue; seats в waiting-lobby.
- Подсказка шпиона — **ручная** структурированная (`word` + `count` 1..8) через WS `start_round` после mark targets; лимит угадываний `count + 1`.
- Журнал: `eventLog` (+ legacy `clueHistory` для миграций). Чат комнаты — отдельный канал (ADR 0002).
- Таймер хода на сервере; при истечении — `turn_expired` + смена хода.
- Цвета карт на проводе: см. ADR 0003 (`gameStateForViewer`).

### 5. Темы колоды на сервере

Пакеты слов/картинок: `it` | `football` | `yoga` | `movies` в [`backend/src/themes/`](../../backend/src/themes/). Хост выбирает тему при создании комнаты; демо берёт колоду через `GET /api/themes/:theme/deal`.

### 6. Безопасность (текущий уровень)

- Helmet + rate limit на `/api`; soft rate limit на WS.
- CORS allowlist (`CORS_ORIGINS`); на Render дополнительно допускаются origin `*.onrender.com`.
- `crossOriginResourcePolicy: cross-origin` — чтобы static site мог читать API на другом хосте.
- Auth: **per-player token** (ADR 0003), не shared room secret.

### 7. Чего baseline намеренно не содержит

- Redis / multi-instance sync.
- Встроенный voice/video.
- Classic 9/8 asymmetric deck / host-only start (продуктовые P3).

Чат, event log и mark targets — **есть** (ADR 0002). Auth/visibility — ADR 0003.

## Consequences

### Positive

- Простая ментальная модель: один процесс API, один SPA.
- Легко деплоить (Docker Compose или Render Free).
- Игровые правила и видимость расклада централизованы на сервере.

### Negative / risks

- Split-host на Render требует синхронизации `VITE_BACKEND_URL` / CORS при смене hostname.
- Free sleep/redeploy всё ещё теряет комнаты (даже с `/tmp` snapshot).
- Один инстанс ограничивает рост без смены persistence.

## References

- [`design.md`](../../design.md) — исходный дизайн
- [`spec.md`](../../spec.md) — функциональные требования
- [`DEPLOY.md`](../../DEPLOY.md) — Render / Docker / VPS
- [ADR 0002](0002-room-chat-and-match-log.md), [ADR 0003](0003-auth-and-card-visibility.md)
