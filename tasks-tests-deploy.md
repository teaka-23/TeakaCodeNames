# Tasks: Tests & Deployment

## Phase 1: Backend Tests

### Task 1.1: Install Test Dependencies
- [x] Install Jest, ts-jest, @types/jest, supertest, jest-websocket-mock
- [x] Create `backend/jest.config.js`
- [x] Configure coverage threshold 80%
- [x] Add `"test": "jest --coverage"` to package.json

### Task 1.2: Game Logic Unit Tests
- [x] Create `tests/gameLogic.test.ts`
- [x] Test `createGameState()` → correct initial state
- [x] Test `generateCards()` → 25 cards, 9+9+7+1 distribution
- [x] Test `handleGuess()` → correct color: score++, turn continues
- [x] Test `handleGuess()` → wrong color: turn passes
- [x] Test `handleGuess()` → civilian: turn passes
- [x] Test `handleGuess()` → assassin: game over, opponent wins
- [x] Test `handleGuess()` → card.revealed = true
- [x] Verify coverage ≥ 80%

### Task 1.3: Word Database Unit Tests
- [x] Create `tests/wordDatabase.test.ts`
- [x] Test `getRandomWords(25)` → returns 25 unique words
- [x] Test `getWordsByCategory()` → returns correct category
- [x] Test total word count ≥ 150
- [x] Test empty category returns []

### Task 1.4: Shuffle Correctness Tests
- [x] In gameLogic.test.ts
- [x] Test shuffle produces different results (≥ 90%)
- [x] Test all elements preserved (no additions/removals)

### Task 1.5: API Integration Tests
- [x] Create `tests/rooms.test.ts`
- [x] Test POST /api/rooms → 200, returns roomId
- [x] Test POST /api/rooms/:id/join → 200
- [x] Test join when full → 400
- [x] Test join with duplicate name → 400
- [x] Test GET /api/rooms/:id → 200
- [x] Test POST /api/rooms/:id/start → 200
- [x] Test start with <3 players → 400
- [x] Test DELETE /api/rooms/:id → 200
- [x] Use supertest, isolate tests

### Task 1.6: WebSocket Tests
- [x] Create `tests/webSocket.test.ts`
- [x] Test connection with valid params
- [x] Test connection rejects without params
- [x] Test message routing (guess → broadcast)
- [x] Test disconnect removes player

---

## Phase 2: Frontend Tests

### Task 2.1: Install Test Dependencies
- [x] Install vitest, @testing-library/react, @testing-library/jest-dom, jsdom
- [x] Create `frontend/vitest.config.ts`
- [x] Configure jsdom environment, coverage 70%
- [x] Add `"test": "vitest run"` to package.json

### Task 2.2: GameBoard Component Tests
- [x] Create `src/__tests__/GameBoard.test.tsx`
- [x] Test renders 25 cards in grid
- [x] Test unrevealed cards show word text
- [x] Test clicking card calls onGuess(index)
- [x] Test revealed cards not clickable
- [x] Test disabled state blocks interaction

### Task 2.3: Scoreboard Component Tests
- [x] Create `src/__tests__/Scoreboard.test.tsx`
- [x] Test displays correct scores
- [x] Test shows remaining cards count
- [x] Test highlights current turn

### Task 2.4: ClueDisplay Component Tests
- [x] Create `src/__tests__/ClueDisplay.test.tsx`
- [x] Test shows "Give Clue" button when canStartRound
- [x] Test shows clue word and count
- [x] Test hides when no clue and can't start

---

## Phase 3: Docker

### Task 3.1: Backend Dockerfile
- [x] Create `backend/Dockerfile`
- [x] Multi-stage build (builder → production)
- [x] Use node:20-alpine base
- [x] Non-root user
- [x] Expose port 3001
- [x] Test: `docker build -t codenames-backend .`

### Task 3.2: Frontend Dockerfile
- [x] Create `frontend/Dockerfile`
- [x] Multi-stage build (builder → nginx)
- [x] Use nginx:alpine for serve
- [x] COPY dist to /usr/share/nginx/html
- [x] EXPOSE 80
- [x] Test: `docker build -t codenames-frontend .`

### Task 3.3: Nginx Configuration
- [x] Create `nginx/nginx.conf`
- [x] Reverse proxy /api → backend:3001
- [x] WebSocket upgrade /ws → backend:3001
- [x] Security headers
- [x] Gzip compression
- [x] Static files serving

### Task 3.4: Docker Compose
- [x] Create `docker-compose.yml`
- [x] Define backend service (port 3001)
- [x] Define frontend service (port 80)
- [x] Healthcheck for backend
- [x] depends_on frontend → backend
- [x] Test: `docker compose up` — backend healthy, nginx отдаёт `/` и проксирует `/api/health`

### Task 3.5: Docker .dockerignore
- [x] Create `backend/.dockerignore`
- [x] Create `frontend/.dockerignore`
- [x] Exclude node_modules, dist, .env

---

## Phase 4: CI/CD

### Task 4.1: GitHub Actions Workflow
- [x] Create `.github/workflows/ci.yml`
- [x] Configure on: push main, pull_request main
- [x] Matrix: Node.js 18, 20
- [x] Steps: checkout → install → lint → test → build
- [x] Verify pipeline runs in < 5 min

### Task 4.2: Package Scripts
- [x] Add `"test"` script to backend package.json
- [x] Add `"test"` script to frontend package.json
- [x] Add `"test"` root script (runs both)
- [x] Add `"docker:up"` script for docker-compose

### Task 4.3: Code Coverage Thresholds
- [x] Set backend coverage ≥ 80% in jest.config.js
- [x] Set frontend coverage ≥ 70% in vitest.config.ts
- [x] Configure --coverage flag in scripts

---

## Phase 5: Deploy Guide

### Task 5.1: DEPLOY.md Documentation
- [x] Write DEPLOY.md
- [x] Prerequisites section (VPS, Docker, domain)
- [x] Docker deploy method (one command)
- [x] Manual deploy method (VPS + Node.js)
- [x] SSL/HTTPS setup (certbot)
- [x] Nginx reverse proxy config
- [x] Environment variables reference
- [x] Troubleshooting section

### Task 5.2: Environment Templates
- [x] Create `.env.example` in root
- [x] Document all environment variables
- [x] Add CORS_ORIGINS to backend config
- [x] Add VITE_API_URL to frontend config

### Task 5.3: Health Check Endpoint
- [x] Verify GET /api/health works
- [x] Add to docker-compose healthcheck
- [x] Document in DEPLOY.md

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| 1. Backend Tests | 6 | ✅ 88 тестов, покрытие ~88% |
| 2. Frontend Tests | 4 | ✅ 28 тестов, покрытие ~91% |
| 3. Docker | 5 | ✅ Образы собираются, `docker compose up` поднимает оба сервиса |
| 4. CI/CD | 3 | ✅ ci.yml, скрипты, пороги покрытия |
| 5. Deploy Guide | 3 | ✅ DEPLOY.md, .env.example, /api/health |

**Total: 21 tasks | 21 done**

Дополнительно: `backend/scripts/e2e-smoke.mjs` (`npm run test:e2e`) — 23 автоматические E2E-проверки полного игрового цикла против production-сборки.

## Prerequisites
- ✅ Base game implemented and working
- ✅ TypeScript compiles with zero errors
- ✅ Frontend builds successfully
- ✅ All manual flows tested

## Deliverables
- 30+ automated tests
- Backend test coverage ≥ 80%
- Frontend test coverage ≥ 70%
- Docker + docker-compose working
- GitHub Actions CI pipeline
- Production deployment guide
