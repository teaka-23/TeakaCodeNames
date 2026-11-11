# Tasks: Codenames IT Edition

## Phase 1: Project Setup

### Task 1.1: Initialize Backend
- [x] Create backend directory structure
- [x] Initialize npm project with dependencies
- [x] Install: express, ws, cors, dotenv, uuid
- [x] Install dev deps: typescript, tsx, @types/*
- [x] Configure tsconfig.json

### Task 1.2: Initialize Frontend
- [x] Create frontend with Vite + React + TypeScript
- [x] Install: react-router-dom, axios, bootstrap
- [x] Configure vite.config.ts with API proxy
- [x] Set up directory structure (components, pages, services, types)

### Task 1.3: Configure Root
- [x] Create root package.json with concurrent scripts
- [x] Create .gitignore
- [x] Create README.md

---

## Phase 2: Backend Core

### Task 2.1: Define Types
- [x] Create `backend/src/types/index.ts`
- [x] Define: Player, Card, GameState, Room
- [x] Define: WsMessage types (guess, skip, update, etc.)
- [x] Define: TeamColor, CardColor, GameStatus, PlayerRole

### Task 2.2: Word Database
- [x] Create `backend/src/utils/wordDatabase.ts`
- [x] Add 150+ IT words across 13 categories
- [x] Implement `getRandomWords(count)` function
- [x] Implement `getWordsByCategory(category)` function

### Task 2.3: Game Logic Engine
- [x] Create `backend/src/utils/gameLogic.ts`
- [x] Implement `createGameState()` — initialize empty state
- [x] Implement `generateCards()` — shuffle words + colors into 5×5
- [x] Implement `handleGuess()` — process card click, update state
- [x] Implement `generateClue()` — heuristic clue from category frequency
- [x] Implement `getSimpleClue()` — word mapping for clues
- [x] Implement Fisher-Yates shuffle

### Task 2.4: REST API Routes
- [x] Create `backend/src/routes/rooms.ts`
- [x] POST /api/rooms — create room, return roomId + playerId
- [x] POST /api/rooms/:id/join — join room, balance teams
- [x] GET /api/rooms/:id — get current game state
- [x] POST /api/rooms/:id/start — deal cards, assign spymasters
- [x] DELETE /api/rooms/:id — remove room
- [x] GET /api/rooms — list active rooms
- [x] Implement room ID generation (6-char alphanumeric)

### Task 2.5: WebSocket Server
- [x] Create `backend/src/utils/webSocketHandler.ts`
- [x] Implement `setupWebSocket(server)` — attach to HTTP server
- [x] Handle connection lifecycle (connect, message, close, error)
- [x] Track player connections per room
- [x] Implement `handleGuessMessage()` — process guesses
- [x] Implement `handleSkipTurn()` — pass turn to opponent
- [x] Implement `handleStartRound()` — generate clue for spymaster
- [x] Implement `sendToPlayer()` — targeted messages
- [x] Implement `broadcastToRoom()` — fan-out to all
- [x] Implement reconnection tracking

### Task 2.6: Server Entry
- [x] Create `backend/src/server.ts`
- [x] Initialize Express + HTTP server
- [x] Mount CORS + JSON middleware
- [x] Register REST routes under /api
- [x] Attach WebSocket server
- [x] Add health check endpoint
- [x] Export app for testing

---

## Phase 3: Frontend UI

### Task 3.1: App Shell
- [x] Create `frontend/src/App.tsx` — Router setup
- [x] Create `frontend/src/main.tsx` — React root
- [x] Create `frontend/src/index.css` — Dark theme base
- [x] Create `frontend/src/App.css` — Global styles

### Task 3.2: Frontend Types
- [x] Create `frontend/src/types/index.ts`
- [x] Mirror server types (Player, Card, GameState, etc.)
- [x] Define WS message types

### Task 3.3: API Client
- [x] Create `frontend/src/services/api.ts`
- [x] Implement `createRoom(playerName)`
- [x] Implement `joinRoom(roomId, playerName)`
- [x] Implement `getRoom(roomId)`
- [x] Implement `startRoom(roomId)`
- [x] Implement `deleteRoom(roomId)`
- [x] Implement `listRooms()`
- [x] Configure Axios with API base URL

### Task 3.4: WebSocket Client
- [x] Create `frontend/src/services/webSocket.ts`
- [x] Implement `connect(roomId, playerId)` — establish WS connection
- [x] Implement `send(message)` — send to server
- [x] Implement `on(type, handler)` — subscribe to events
- [x] Implement `off(type, handler)` — unsubscribe
- [x] Implement reconnection with exponential backoff (max 5 attempts)
- [x] Implement notification dispatch

### Task 3.5: Lobby Page
- [x] Create `frontend/src/pages/LobbyPage.tsx`
- [x] Input: player name field
- [x] Input: room code field
- [x] Button: Create Room → API call → show code
- [x] Button: Join Room → API call → navigate to game
- [x] Copy room code to clipboard
- [x] Display "How to Play" instructions
- [x] Error handling + validation
- [x] Create `frontend/src/pages/LobbyPage.css`

### Task 3.6: Game Page
- [x] Create `frontend/src/pages/GamePage.tsx`
- [x] Phase 1: Join screen (enter name, connect WS)
- [x] Phase 2: Game screen
  - Scoreboard component
  - ClueDisplay component
  - GameBoard component
  - Player list
- [x] Phase 3: Game Over overlay
- [x] WebSocket message handlers:
  - `game_update` → update state
  - `guess_result` → show result, detect game over
  - `start_round` → reveal clue
  - `player_list` → update roster
- [x] Action handlers:
  - `handleGuess(cardIndex)` → send WS guess
  - `handleSkipTurn()` → send WS skip
  - `handleStartRound()` → send WS start
- [x] Navigate back to lobby on game over
- [x] Create `frontend/src/pages/GamePage.css`

### Task 3.7: GameBoard Component
- [x] Create `frontend/src/components/GameBoard.tsx`
- [x] Props: cards[], onGuess(cardIndex), disabled
- [x] Render 5×5 CSS grid
- [x] Card states: unrevealed (gradient), revealed (darkened)
- [x] Hover effect on unrevealed cards
- [x] Reveal legend showing counts per color
- [x] Responsive card sizing
- [x] Create `frontend/src/components/GameBoard.css`

### Task 3.8: Scoreboard Component
- [x] Create `frontend/src/components/Scoreboard.tsx`
- [x] Props: scores, remaining, currentTurn
- [x] Display: team names, icons, scores, remaining counts
- [x] Highlight active turn with border + arrow
- [x] Create `frontend/src/components/Scoreboard.css`

### Task 3.9: ClueDisplay Component
- [x] Create `frontend/src/components/ClueDisplay.tsx`
- [x] Props: clue, currentTurn, canStartRound, onStartRound, isSpymaster
- [x] State 1: Prompt for spymaster (Give Clue button)
- [x] State 2: Show clue word + count
- [x] Conditional display based on role
- [x] Create `frontend/src/components/ClueDisplay.css`

---

## Phase 4: Integration & Testing

### Task 4.1: Type Checking
- [x] Backend: `tsc --noEmit` passes with zero errors
- [x] Frontend: `tsc --noEmit` passes with zero errors

### Task 4.2: Build Verification
- [x] Frontend: `npm run build` succeeds
- [x] Production assets generated in dist/
- [x] CSS bundles correctly

### Task 4.3: End-to-End Flow
- [x] Start backend server
- [x] Start frontend dev server
- [x] Create room from browser tab 1
- [x] Join room from browser tab 2
- [x] Add third player
- [x] Start game
- [x] Spymaster gets clue
- [x] Guess a correct card → score updates
- [x] Guess a wrong card → turn passes
- [x] Guess civilian → turn passes
- [x] Game over → winner displayed
- Покрыто автоматизированным прогоном `backend/scripts/e2e-smoke.mjs` (23 проверки) против production-сборки

### Task 4.4: WebSocket Testing
- [x] Connect two clients simultaneously
- [x] Verify state sync across tabs
- [x] Test disconnect/reconnect scenario
- [x] Verify broadcast to all players
- Многоклиентный сценарий с 4 WS-подключениями в e2e-smoke; unit-тесты в `tests/webSocketHandler.test.ts`

### Task 4.5: Edge Cases
- [x] Room at max capacity (6 players) — в `tests/rooms.test.ts`
- [x] Duplicate player names — e2e-smoke + `tests/rooms.test.ts`
- [x] Invalid room codes — e2e-smoke (404 / WS close 4001)
- [x] Game over conditions (all cards, assassin) — `tests/gameLogic.test.ts` + e2e-smoke
- [x] Turn management (skip, wrong color, civilian) — e2e-smoke

---

## Phase 5: Polish & Documentation

### Task 5.1: README
- [x] Project overview
- [x] Features list
- [x] Installation instructions
- [x] Running instructions (dev + prod)
- [x] API documentation
- [x] WebSocket protocol reference
- [x] Game rules explanation

### Task 5.2: Code Comments
- [x] Add JSDoc to public functions
- [x] Document complex game logic
- [x] Add inline comments for non-obvious code
JSDoc на `handleGuess`, `passTurn` и контракте WebSocket в `setupWebSocket`

### Task 5.3: Error Handling
- [ ] Graceful error messages in UI
- [ ] Retry logic for failed API calls
- [ ] Empty state handling

### Task 5.4: Performance
- [x] Разобрать, какие обновления перерисовывают доску
- [x] Optimize unnecessary re-renders
- [x] Lazy-load components if needed
Профилировщик React DevTools не запускался: путь рендера виден по коду. Таймер тикает внутри `TurnTimer` и не трогает доску. `GameBoard`, `Scoreboard`, `ClueDisplay` обёрнуты в `memo`, обработчики хода стабильны. Страницы грузятся через `React.lazy`

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| 1. Project Setup | 3 | ✅ Done |
| 2. Backend Core | 6 | ✅ Done |
| 3. Frontend UI | 9 | ✅ Done |
| 4. Integration & Testing | 5 | ✅ Done (включая e2e-smoke) |
| 5. Polish & Documentation | 4 | ⚠️ 3/4, открыт пункт 5.3 |

**Total: 27 tasks | 26 complete | 1 pending (5.3: retry неуспешных API-вызовов и пустые состояния)**
