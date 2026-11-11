# Развёртывание

## Подготовка проекта

Перед деплоем убедитесь, что всё собрано:

```bash
# Собрать бэкенд
cd backend
npm run build

# Собрать фронтенд
cd ../frontend
npm run build
```

## Способ 1: Render (рекомендуется для быстрого деплоя)

В репозитории есть Blueprint: [`render.yaml`](./render.yaml).

### Что создаётся

| Сервис | Тип | URL |
|--------|-----|-----|
| `codenames-api` | Web Service (Node) | `https://codenames-api.onrender.com` |
| `codenames-web` | Static Site | `https://codenames-web.onrender.com` |

Актуальные URL этого деплоя:

| Сервис | URL |
|--------|-----|
| Игра (открывать это) | https://codenames-web-erca.onrender.com |
| API | https://codenames-api-agv9.onrender.com |

В Blueprint зашиты:
- `VITE_BACKEND_URL=https://codenames-api-agv9.onrender.com`
- `CORS_ORIGINS=https://codenames-web-erca.onrender.com`

После смены env у Static Site нужен **Manual Deploy**, чтобы Vite
пересобрал бандл.

### Шаги

1. Запушьте репозиторий на GitHub / GitLab / Bitbucket.
2. Откройте [dashboard.render.com](https://dashboard.render.com/) → **New** → **Blueprint**.
3. Подключите репозиторий (Render подхватит `render.yaml`).
4. Подтвердите создание сервисов и дождитесь обоих деплоев.
5. Играйте по URL **codenames-web**.

### Free plan: ограничения

- После ~15 минут без трафика API засыпает (~1 мин на подъём).
- Нет persistent disk → комнаты только в памяти, теряются при sleep/redeploy.
- Один инстанс — ок для текущего дизайна.

### Платный план + сохранение комнат

1. В Dashboard у `codenames-api` смените plan (например Starter).
2. Добавьте Disk: mount `/data`, size 1 GB.
3. Env:
   - `PERSISTENCE_DRIVER=file`
   - `PERSISTENCE_FILE=/data/rooms.json`

### Ручной деплой без Blueprint

Если создаёте сервисы вручную:

**API** — Web Service, root `backend`, build `npm ci && npm run build`, start `npm start`, health `/api/health`.

**Web** — Static Site, root `frontend`, build `npm ci && npm run build`, publish `dist`, rewrite `/*` → `/index.html`.

Env:

| Сервис | Переменная | Значение |
|--------|------------|----------|
| API | `CORS_ORIGINS` | `https://<frontend>.onrender.com` |
| Web | `VITE_BACKEND_URL` | `https://<api>.onrender.com` |

После смены env у Static Site нужен **Manual Deploy**, чтобы Vite пересобрал бандл.

---

## Способ 2: Docker Compose (VPS)

### Требования
- Сервер Ubuntu 20+ с 2GB RAM
- Docker 20+
- Доменное имя (опционально)

### Установка Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### Запуск

```bash
# Загрузите проект на сервер
git clone https://github.com/your-org/codenames-it.git
cd codenames-it

# Соберите и запустите
docker compose up -d --build
```

Готово! Игра доступна по:
- `http://your-server-ip` — фронтенд
- `http://your-server-ip:3001` — API бэкенда

### Сохранение игр между перезапусками

По умолчанию комнаты живут в памяти и теряются при рестарте. Включить
персистентность можно переменными окружения бэкенда:

| Переменная | Значение | Смысл |
|-----------|----------|-------|
| `PERSISTENCE_DRIVER` | `file` | Хранить снимок комнат в файле |
| `PERSISTENCE_FILE` | `./data/rooms.json` | Путь к файлу снимка |

В `docker-compose.yml` эти переменные уже заданы, а каталог `/app/data`
вынесен в именованный volume `codenames-data` — игры переживают
`docker compose restart`.

Активный режим печатается при старте:
```
Persistence: file (/app/data/rooms.json)
```

#### Ограничение: один инстанс

Файловое хранилище рассчитано на **единственный инстанс бэкенда**. Каждый процесс
держит комнаты в памяти и пишет полный снимок в свой файл, поэтому при запуске
нескольких экземпляров за балансировщиком комнаты не будут видны друг другу.

Если понадобится горизонтальное масштабирование, нужен общий store: интерфейс
`PersistenceStore` (`backend/src/utils/persistence.ts`) уже вынесен отдельно,
достаточно реализовать `RedisStore` и вернуть его из `createPersistenceStore()` —
`RoomManager` менять не требуется.

---

## Способ 3: Без Docker (Node.js + Nginx)

### Требования
- Сервер Ubuntu 20+
- Node.js 20+
- Nginx

### Установка Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Сборка и запуск

```bash
git clone https://github.com/your-org/codenames-it.git
cd codenames-it

# Бэкенд
cd backend && npm ci && npm run build
cd ..

# Фронтенд
cd frontend && npm ci && npm run build
cd ..

# Запуск через PM2
npm install -g pm2
cd backend && pm2 start dist/server.js --name codenames-backend
cd ../frontend && pm2 serve dist 80 --name codenames-frontend
pm2 save && pm2 startup
```

### SSL с Let's Encrypt (опционально)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Проверка

```bash
# Проверка бэкенда
curl http://localhost:3001/api/health

# Проверка фронтенда
curl http://localhost
```

Ожидаемый ответ бэкенда:
```json
{
  "status": "ok",
  "timestamp": "2024-..."
}
```

---

## Подключение игроков

После развёртывания все игроки подключаются к:
- `http://your-server-ip` (или доменное имя)

Никаких дополнительных настроек не нужно — бэкенд и фронтенд на одном сервере.

---

## Мониторинг

```bash
# Docker
docker compose ps
docker compose logs -f

# PM2
pm2 list
pm2 logs
```
