# Specification: Codenames IT Game

## Overview

This document specifies the requirements for the Codenames IT Edition — a multiplayer word-guessing game with IT-themed vocabulary.

---

## Feature: Room Management

### FR-001: Create Room
**As a** player, **I want to** create a new game room **so that** I can invite friends to join.

**Acceptance Criteria:**
- Player enters their name and clicks "Create Room"
- System generates a unique 6-character alphanumeric room code
- System creates a new room with the player as the first member
- Room code is displayed and can be copied to clipboard
- Player is directed to the waiting room view

**API Contract:**
```
POST /api/rooms
Body: { playerName: string }
Response: { roomId: string, playerId: string, player: Player, gameState: GameState }
```

### FR-002: Join Room
**As a** player, **I want to** join an existing room using a room code **so that** I can participate in an ongoing lobby.

**Acceptance Criteria:**
- Player enters their name and a 6-character room code
- System validates the room exists and has capacity (< 6 players)
- System assigns the player to the appropriate team (balances teams)
- Player appears in the player list immediately

**API Contract:**
```
POST /api/rooms/:roomId/join
Body: { playerName: string }
Response: { playerId: string, player: Player, gameState: GameState }
```

**Error Cases:**
- Room not found → 404
- Room full → 400
- Duplicate name → 400

### FR-003: View Active Rooms
**As a** user, **I want to** see a list of active rooms **so that** I can join one.

**Acceptance Criteria:**
- GET /api/rooms returns list of active rooms with:
  - Room ID
  - Current player count
  - Maximum player count
  - Room status

---

## Feature: Game Setup

### FR-004: Start Game
**As a** seated player with 3+ active players and both teams, **I want to** start the game **so that** gameplay begins.

**Acceptance Criteria:**
- Any authenticated seated player can click "Start Game" (visible when 3+ active players and both teams)
- Missing spymasters are auto-assigned from the first player of each team if seats left empty
- System generates and shuffles 25 cards
- Only the room host (creator) can start
- Cards use classic 9/8: starting team 9, other 8, 7 civilian, 1 assassin
- Game state transitions to "spymaster-ready"
- Guesser clients receive card colors as null until reveal (server-side view filter)

**Card Distribution:**
| Color | Count | Description |
|-------|-------|-------------|
| Starting team | 9 | Team that moves first |
| Other team | 8 | Second team |
| Civilian | 7 | Neutral cards |
| Assassin | 1 | Instant loss |

### FR-005: Delete Room
**As a** player, **I want to** delete a room **so that** I can clean up unused rooms.

**Acceptance Criteria:**
- DELETE /api/rooms/:roomId removes the room
- All connected players receive disconnect notification

---

## Feature: Gameplay

### FR-006: Give Clue
**As a** spymaster of the current team, **I want to** mark target cards and enter a clue word + count **so that** I can direct my team.

**Acceptance Criteria:**
- Spymaster marks ≥1 unrevealed target on the board (`mark_targets`)
- Spymaster submits a human-entered clue (`word` + `count` 1..8) via `start_round`
- Clue must not equal a board word
- Team may guess up to `count + 1` times (classic bonus); miss or exhaustion ends the turn
- Clue and targets are recorded in the match event log

### FR-007: Make a Guess
**As a** team member, **I want to** click a card to guess its color **so that** we can reveal cards.

**Acceptance Criteria:**
- Player clicks an unrevealed card
- Server processes the guess and updates state:

| Card Color | Result |
|------------|--------|
| Team's color | Card revealed, score +1, turn continues. The team wins when all 8 of its cards are revealed |
| Opponent's color | Card revealed, opponent score +1, turn passes. If it was their last card, they win |
| Civilian | Card revealed, turn passes |
| Assassin | Game ends, opponent team wins, every card is flipped |

- All clients receive the update via WebSocket
- If the guess was correct, card shows team emoji
- If the guess was wrong, card shows appropriate emoji

### FR-008: Skip Turn
**As a** guesser, **I want to** skip the current turn **so that** we can pass if no matching cards are found.

**Acceptance Criteria:**
- Guesser clicks "Skip Turn" button
- Turn passes to the opposing team
- All clients are notified

**Constraints:**
- Only guessers on the current team can skip
- Spymasters cannot skip (they give clues)

### FR-009: Track Score
**As a** player, **I want to** see the current score and remaining cards **so that** I can track progress.

**Acceptance Criteria:**
- Scoreboard displays:
  - Team name + icon
  - Current score (number of revealed cards)
  - Remaining cards count
  - Active turn indicator (arrow)
- Score updates in real-time after each guess

---

## Feature: Game End

### FR-010: Detect Game Over
**As a** system, **I want to** detect when the game ends **so that** I can announce the winner.

**Acceptance Criteria:**
- Game ends when:
  1. All 8 cards of a team are revealed → that team wins, including when the opponent reveals the last one
  2. A player reveals the Assassin card → opposing team wins
- Game Over screen shows:
  - Trophy icon
  - Winning team name and color
  - The board with every card face up
  - "Play Again" button (returns to lobby)

### FR-011: Reveal All Cards
**As a** player, **I want to** see all card colors at game end **so that** I can understand what happened.

**Acceptance Criteria:**
- At game over, all unrevealed cards flip to show their color
- Legend shows final distribution:
  - 🔴 Red: X revealed
  - 🔵 Blue: X revealed
  - ⚪ Civilian: X revealed
  - 💀 Assassin: revealed if applicable

---

## Feature: Word Database

### FR-012: IT-Themed Words
**As a** game designer, **I want** a database of 150+ IT-themed words **so that** players encounter relevant vocabulary.

**Acceptance Criteria:**
- Database contains ≥150 unique words
- Words organized into ≥10 categories
- Categories include at minimum:
  - Languages (JavaScript, Python, Rust, etc.)
  - Frameworks (React, Angular, Django, etc.)
  - Databases (PostgreSQL, MongoDB, Redis, etc.)
  - DevOps (Docker, Kubernetes, AWS, etc.)
  - AI/ML (Neural, Tensor, PyTorch, etc.)
  - Security (OAuth, JWT, SSL, etc.)
  - Concepts (API, REST, Microservices, etc.)
  - VCS (Git, Commit, Branch, etc.)
  - OS (Linux, Nginx, Apache, etc.)
  - Mobile (iOS, Android, Flutter, etc.)
  - Testing (Jest, Cypress, Selenium, etc.)
  - Patterns (MVC, Singleton, Factory, etc.)
  - Misc (Binary, Kernel, Socket, etc.)

### FR-013: Random Word Selection
**As a** game engine, **I want to** randomly select 25 words from the database **so that** each game is unique.

**Acceptance Criteria:**
- `getRandomWords(25)` returns 25 unique words
- Selection is uniformly random (Fisher-Yates shuffle)
- Words can repeat across different games (no cross-game deduplication)

---

## Feature: Real-Time Sync

### FR-014: WebSocket Connection
**As a** player, **I want** the game to update in real-time **so that** all players see the same state.

**Acceptance Criteria:**
- WebSocket connects on game page load
- Connection includes roomId and playerId parameters
- Disconnected clients attempt reconnection with exponential backoff (max 5 attempts)
- Reconnected clients receive full current state

### FR-015: State Broadcasting
**As a** system, **I want to** broadcast state changes to all connected players **so that** everyone stays in sync.

**Acceptance Criteria:**
- Every state change triggers a `game_update` message
- Messages include full game state (not diffs)
- All players receive the update within one tick
- Client re-renders React components automatically

### FR-016: Player Disconnect Handling
**As a** system, **I want to** handle player disconnections gracefully **so that** the game remains stable.

**Acceptance Criteria:**
- On disconnect, player is removed from player list
- If room becomes empty, room is deleted
- Ongoing games continue with remaining players
- Reconnect restores player to room

---

## Feature: User Interface

### FR-017: Game Board
**As a** player, **I want to** see a 5×5 grid of card words **so that** I can select cards.

**Acceptance Criteria:**
- Grid displays exactly 25 cards in 5 rows × 5 columns
- Each card shows its word in uppercase
- Cards are shuffled randomly each game
- Hover effect on unselected cards
- Click handler on each card (disabled if not your turn or game over)

### FR-018: Team Colors
**As a** player, **I want to** visually distinguish team colors **so that** I know which cards to guess.

**Acceptance Criteria:**
- Red team cards use red gradient: `#dc3545` → `#c82333`
- Blue team cards use blue gradient: `#0d6efd` → `#0b5ed5`
- Revealed cards darken to their respective color
- Civilian revealed: dark gray-green
- Assassin revealed: near-black

### FR-019: Responsive Design
**As a** player on any device, **I want** the game to look good **so that** I can play comfortably.

**Acceptance Criteria:**
- Layout adapts at breakpoints: ≥1000px, 600-999px, <600px
- Card text scales down on smaller screens
- Touch targets ≥ 44px on mobile
- No horizontal scrolling on any screen size

---

## Non-Functional Requirements

### NFR-001: Build Time
- Frontend production build completes in < 3 seconds
- TypeScript compilation succeeds with zero errors

### NFR-002: Code Quality
- Both frontend and backend use TypeScript
- No runtime errors during normal gameplay
- Clean builds with no warnings

### NFR-003: Browser Support
- Chrome 100+
- Firefox 100+
- Safari 15+
- Edge 100+

### NFR-004: Performance
- WebSocket message latency < 100ms (local network)
- React re-render < 16ms per frame
- Initial page load < 2 seconds
