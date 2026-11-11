# Specification: Tests & Deployment

## Feature: Backend Unit Tests

### TDT-001: Game Logic Tests
**As a** developer, **I want** automated tests for game logic **so that** I can refactor with confidence.

**Acceptance Criteria:**
- `gameLogic.test.ts` covers:
  - `createGameState()` → returns correct initial state
  - `generateCards()` → returns 25 cards, correct color distribution (9+9+7+1)
  - `handleGuess()` correct card → score increments, turn continues
  - `handleGuess()` wrong color → turn passes, score unchanged
  - `handleGuess()` civilian → turn passes
  - `handleGuess()` assassin → game over, opponent wins
  - `handleGuess()` → card marked as revealed
- Test coverage ≥ 80% for `gameLogic.ts`

### TDT-002: Word Database Tests
**As a** developer, **I want** tests for word database **so that** I can trust word count and categories.

**Acceptance Criteria:**
- `wordDatabase.test.ts` covers:
  - `getRandomWords(25)` returns exactly 25 words
  - All returned words are unique
  - `getWordsByCategory('languages')` returns ≥ 15 words
  - `getWordsByCategory('unknown')` returns empty array
  - Total word count ≥ 150

### TDT-003: Shuffle Correctness
**As a** tester, **I want** to verify shuffle algorithm **so that** I can ensure randomness.

**Acceptance Criteria:**
- Fisher-Yates implementation tested
- Multiple calls produce different orderings (≥ 90% different)
- All elements preserved after shuffle (no additions/removals)

---

## Feature: Backend Integration Tests

### TDT-004: API Endpoint Tests
**As a** developer, **I want** integration tests for REST API **so that** I can verify end-to-end room operations.

**Acceptance Criteria:**
- `rooms.test.ts` covers:
  - POST /api/rooms → 200, returns roomId and playerId
  - POST /api/rooms/:id/join → 200, adds player
  - POST /api/rooms/:id/join when full → 400
  - POST /api/rooms/:id/join with duplicate name → 400
  - GET /api/rooms/:id → 200, returns gameState
  - POST /api/rooms/:id/start → 200, generates cards
  - POST /api/rooms/:id/start with <3 players → 400
  - DELETE /api/rooms/:id → 200, removes room
- Use supertest for HTTP testing
- Each test isolated (no shared state)

### TDT-005: WebSocket Tests
**As a** developer, **I want** WebSocket connection tests **so that** I can verify real-time messaging.

**Acceptance Criteria:**
- `webSocket.test.ts` covers:
  - WebSocket connection succeeds with valid roomId + playerId
  - Connection rejects without parameters (close event)
  - Message routing works (guess → broadcast)
  - Client disconnect removes player from connections

---

## Feature: Frontend Tests

### TDT-006: Component Tests
**As a** developer, **I want** React component tests **so that** I can verify UI renders correctly.

**Acceptance Criteria:**
- `GameBoard.test.tsx`:
  - Renders 25 cards in 5×5 grid
  - Unrevealed cards show word text
  - Clicking unrevealed card calls onGuess with correct index
  - Clicking revealed card does nothing
  - Disabled state prevents interaction
- `Scoreboard.test.tsx`:
  - Displays correct scores
  - Shows remaining cards count
  - Highlights current turn team
- `ClueDisplay.test.tsx`:
  - Shows "Give Clue" button when spymaster can start
  - Shows clue word and count when available
  - Hides component when no clue and can't start
- Testing library: @testing-library/react + Vitest

---

## Feature: Test Infrastructure

### TDT-007: Jest Configuration
**As a** developer, **I want** Jest configured for backend **so that** tests run consistently.

**Acceptance Criteria:**
- `backend/jest.config.js` configured
- Runs on `npm test` in backend directory
- Coverage threshold: 80%
- Test files: `*.test.ts` pattern
- Mock file system not needed

### TDT-008: Vitest Configuration
**As a** developer, **I want** Vitest configured for frontend **so that** tests match Vite ecosystem.

**Acceptance Criteria:**
- `frontend/vitest.config.ts` configured
- Runs on `npm test` in frontend directory
- Test files: `*.test.tsx` pattern
- jsdom environment for DOM testing
- Coverage threshold: 70%

### TDT-009: Test Scripts
**As a** developer, **I want** test scripts in package.json **so that** tests run automatically.

**Acceptance Criteria:**
- Backend: `"test": "jest --coverage --silent"`
- Frontend: `"test": "vitest run --coverage"`
- Root: `"test": "npm run test --workspace=backend && npm run test --workspace=frontend"`

---

## Feature: Docker

### TDT-010: Docker Backend Image
**As a** developer, **I want** Dockerfile for backend **so that** I can containerize the server.

**Acceptance Criteria:**
- `backend/Dockerfile` uses node:20-alpine base image
- Multi-stage build: build stage → production stage
- Exposes port 3001
- Runs with non-root user
- COPY package.json first (layer caching)
- npm ci --only=production for dependencies

### TDT-011: Docker Frontend Image
**As a** developer, **I want** Dockerfile for frontend **so that** I can containerize the client.

**Acceptance Criteria:**
- `frontend/Dockerfile` uses node:20-alpine build stage, nginx:alpine serve stage
- Multi-stage build: build → nginx serve
- COPY dist/ to nginx html directory
- EXPOSE 80
- Production nginx configuration

### TDT-012: Docker Compose
**As a** developer, **I want** docker-compose.yml **so that** I can run the full app with one command.

**Acceptance Criteria:**
- `docker-compose.yml` defines:
  - `backend` service (port 3001)
  - `frontend` service (port 80, nginx)
  - `frontend` depends_on `backend`
  - Healthcheck for backend
  - Networks for inter-service communication
- `docker-compose up` starts full application
- `docker-compose down` stops and cleans

### TDT-013: Nginx Configuration
**As a** operator, **I want** nginx config for reverse proxy **so that** frontend and backend share a domain.

**Acceptance Criteria:**
- `nginx/nginx.conf` configured:
  - Frontend serves static files on /
  - /api routes proxied to backend:3001
  - /ws routes proxied to backend:3001 (WebSocket upgrade)
  - Security headers (X-Frame-Options, X-Content-Type-Options)
  - Gzip compression enabled

---

## Feature: CI/CD Pipeline

### TDT-014: GitHub Actions Workflow
**As a** developer, **I want** CI pipeline **so that** PRs are automatically tested.

**Acceptance Criteria:**
- `.github/workflows/ci.yml` configured:
  - Triggers on: push to main, pull_request to main
  - Matrix: Node.js 18, 20
  - Steps: checkout → install → lint → test → build
  - Fails if any step fails
  - Runs in < 5 minutes

### TDT-015: Lint Check
**As a** reviewer, **I want** lint check in CI **so that** code quality is enforced.

**Acceptance Criteria:**
- TypeScript strict mode enforced
- No ESLint rules added (TypeScript strictness sufficient for v1)
- Build must pass (tsc --noEmit)

---

## Feature: Deployment Guide

### TDT-016: Deploy Documentation
**As a** developer, **I want** deployment guide **so that** I can deploy the app independently.

**Acceptance Criteria:**
- `DEPLOY.md` documents:
  - Prerequisites (VPS, Docker, domain)
  - Docker deploy method (one command)
  - Manual deploy method (npm/pm2)
  - SSL/HTTPS setup with Let's Encrypt
  - Nginx reverse proxy config
  - Environment variables
  - Troubleshooting section

### TDT-017: Environment Variables
**As a** operator, **I want** .env template **so that** I can configure the app.

**Acceptance Criteria:**
- `.env.example` provided with all variables:
  - PORT=3001
  - NODE_ENV=production
  - CORS_ORIGINS=allowed domains
- Variables documented in DEPLOY.md

---

## Non-Functional Requirements

### NFR-001: Test Execution Time
- Backend tests < 3 seconds total
- Frontend tests < 5 seconds total
- CI pipeline < 5 minutes total

### NFR-002: Test Reliability
- Tests are deterministic (no flaky tests)
- Random operations use seed where possible
- No tests depend on network (except WebSocket)

### NFR-003: Docker Image Size
- Backend image < 200MB
- Frontend image < 50MB (nginx)
- Total docker-compose images < 300MB
