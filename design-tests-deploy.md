# Design: Tests & Deployment

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CI/CD Pipeline                            │
│  GitHub Actions                                              │
│  ┌──────────┬──────────┬──────────┬──────────┐             │
│  │ Install  │  Lint    │  Test    │  Build   │             │
│  │ deps     │ + Type   │ Unit     │ Prod     │             │
│  └──────────┴──────────┴──────────┴──────────┘             │
└──────────────────────────────┬──────────────────────────────┘
                               │ (on merge)
┌──────────────────────────────▼──────────────────────────────┐
│                    Docker Deployment                         │
│  docker-compose up                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Nginx      │  │   Frontend   │  │     Backend      │  │
│  │  :80/443     │→ │  Static File │→ │  Express+WS      │  │
│  │  Reverse     │  │  (Vite dist) │  │  :3001           │  │
│  │  Proxy       │  │              │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Test Strategy

### Test Pyramid

```
         ┌─── E2E ───┐         ← Future (Playwright)
       ┌───── Integration ─────┐  ← API + WebSocket tests
     ┌─────────── Unit ───────────┐  ← 90% of tests
```

### Backend Tests

#### Structure
```
backend/
├── jest.config.js
├── src/
├── tests/
│   ├── gameLogic.test.ts    ← Unit tests (pure functions)
│   ├── wordDatabase.test.ts ← Unit tests (word retrieval)
│   └── rooms.test.ts        ← Integration tests (HTTP)
```

#### Testing Approach
- **Unit tests**: Test pure functions in isolation
  ```typescript
  describe('handleGuess', () => {
    it('increments score for correct team', () => { ... });
    it('passes turn for wrong color', () => { ... });
    it('ends game on assassin', () => { ... });
  });
  ```

- **Integration tests**: HTTP layer with supertest
  ```typescript
  describe('POST /api/rooms', () => {
    it('creates room and returns roomId', async () => {
      const res = await request(app).post('/api/rooms')
        .send({ playerName: 'Test' });
      expect(res.status).toBe(200);
      expect(res.body.roomId).toBeDefined();
    });
  });
  ```

- **WebSocket tests**: Using `jest-websocket-mock`
  ```typescript
  describe('WebSocket', () => {
    it('connects with valid parameters', async () => { ... });
    it('routes guess message correctly', async () => { ... });
  });
  ```

#### Mock Strategy
- Mock `fs` — not needed (no file operations)
- Mock `Date.now()` — for consistent timestamps
- WebSocket mock — for connection testing
- No database mocks — in-memory state

### Frontend Tests

#### Structure
```
frontend/
├── vitest.config.ts
├── src/
├── src/__tests__/
│   ├── GameBoard.test.tsx
│   ├── Scoreboard.test.tsx
│   └── ClueDisplay.test.tsx
```

#### Testing Approach
- **Component tests**: @testing-library/react
  ```typescript
  describe('GameBoard', () => {
    it('renders 25 cards', () => {
      render(<GameBoard cards={mockCards} onGuess={() => {}} disabled={false} />);
      expect(screen.getAllByRole('button')).toHaveLength(25);
    });

    it('calls onGuess when card clicked', () => {
      const onGuess = vi.fn();
      render(<GameBoard cards={mockCards} onGuess={onGuess} disabled={false} />);
      fireEvent.click(screen.getByText('React'));
      expect(onGuess).toHaveBeenCalledWith(0);
    });
  });
  ```

- **Vitest config**: jsdom environment for DOM
  ```typescript
  export default defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      coverage: {
        provider: 'istanbul',
        thresholds: { 70 },
      },
    },
  });
  ```

### Test Data

#### Mock Game State
```typescript
const mockGameState: GameState = {
  roomId: 'TEST01',
  status: 'playing',
  players: [
    { id: 'p1', name: 'Red1', team: 'red', role: 'spymaster' },
    { id: 'p2', name: 'Blue1', team: 'blue', role: 'spymaster' },
  ],
  cards: generateMockCards(),
  currentTurn: 'red',
  clues: { word: 'React', count: 2 },
  scores: { red: 0, blue: 0 },
  remainingCards: { red: 8, blue: 8, civilian: 8, assassin: 1 },
};
```

## Docker Architecture

### Multi-Stage Builds

#### Backend Dockerfile
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/package.json ./
USER app
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

#### Frontend Dockerfile
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:3001/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      backend:
        condition: service_healthy
    environment:
      - VITE_API_URL=http://backend:3001/api
```

### Nginx Configuration

```nginx
upstream backend {
    server backend:3001;
}

server {
    listen 80;
    server_name localhost;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Gzip
    gzip on;
    gzip_types text/plain application/json text/css application/javascript;

    # Static files
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://backend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        run: |
          cd backend && npm ci
          cd ../frontend && npm ci

      - name: Lint & Type check
        run: |
          cd backend && npx tsc --noEmit
          cd ../frontend && npx tsc --noEmit

      - name: Run backend tests
        run: |
          cd backend && npm test -- --coverage

      - name: Run frontend tests
        run: |
          cd frontend && npm test -- --coverage

      - name: Build backend
        run: |
          cd backend && npm run build

      - name: Build frontend
        run: |
          cd frontend && npm run build
```

### Pipeline Stages

```
Checkout → Install → Lint → Test → Build → (on merge) Docker Push
   │          │         │       │        │
   ├─ git   ├─ npm    ├─ tsc   ├─ jest  ├─ npm run build
   │         │         │       ├─ vitest│
   └─────────┴─────────┴───────┴────────┴
```

### Artifacts
- Test coverage reports (HTML)
- Build output (dist/)
- Docker images (pushed to GitHub Container Registry on tag)

## Deployment Options

### Option 1: Docker Compose (Recommended)
```bash
git clone ...
cd Codenames
docker-compose up -d
# App available at http://your-server
```

### Option 2: Manual (VPS with Node.js)
```bash
# Install Node.js 20+
# Clone repo
cd backend && npm ci && npm run build
cd ../frontend && npm ci && npm run build

# PM2 for process management
pm2 start backend/dist/server.js --name codenames-backend
pm2 serve frontend/dist 80 --name codenames-frontend

# Enable SSL with certbot
sudo certbot --nginx -d your-domain.com
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `NODE_ENV` | `development` | Environment (development/production) |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |

## Testing Coverage Targets

| Module | Target | Reason |
|--------|--------|--------|
| `gameLogic.ts` | 80%+ | Core business logic |
| `wordDatabase.ts` | 90%+ | Simple data, easy to cover |
| `webSocketHandler.ts` | 70%+ | Async, harder to test |
| `rooms.ts` | 80%+ | HTTP layer critical |
| Frontend components | 70%+ | UI regression prevention |

## Error Handling Strategy

### Tests
- Assert on specific error codes (400, 404)
- Mock failures for edge cases
- No real database errors (in-memory)

### Docker
- Healthcheck for backend
- Restart policy: always
- Graceful shutdown via SIGTERM

### CI
- Fail fast: stop on first failure
- Caching for npm packages
- Parallel builds per Node version
