# Design: Codenames IT Edition

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Frontend)                      │
│  ┌───────────┐  ┌────────────┐  ┌──────────────┐           │
│  │  Lobby     │  │  Game      │  │  Scoreboard  │           │
│  │  Page      │  │  Page      │  │  /ClueDisp.  │           │
│  │           │  │            │  │              │           │
│  │ • Create  │  │ • Card     │  │ • Teams      │           │
│  │ • Join    │  │   Grid     │  │ • Current    │           │
│  │ • Code    │  │            │  │   Turn       │           │
│  └─────┬─────┘  └──────┬─────┘  └──────────────┘           │
│        │                │                                   │
│        │   HTTP (axios) │   WebSocket                       │
│        └────────────────┴──────────────────────────────────┘
│                              │
├──────────────────────────────┼──────────────────────────────┤
│                    Backend (Node.js)                         │
│                              │                               │
│  ┌───────────────────────────┼───────────────────────────┐  │
│  │     Express REST API      │     WebSocket Server       │  │
│  │                           │                            │  │
│  │ POST /api/rooms           │  Connection mgmt           │  │
│  │ POST /api/rooms/:id/join  │  Message routing           │  │
│  │ GET  /api/rooms/:id       │  State broadcasting        │  │
│  │ POST /api/rooms/:id/start │                            │  │
│  └───────────────────────────┼───────────────────────────┘  │
│                              │                               │
│              ┌───────────────┼───────────────┐              │
│              │   Game Room   │   Game Logic   │              │
│              │   Manager     │   Engine       │              │
│              │               │                │              │
│              │ • Room store  │ • Card gen     │              │
│              │ • Player mgmt │ • Guess logic  │              │
│              │ • State sync  │ • Win detect   │              │
│              └───────────────┴────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## Technology Choices

### Backend

| Technology | Version | Justification |
|------------|---------|---------------|
| **Node.js** | 18+ | Runtime for real-time I/O-bound workloads |
| **Express** | 5.x | Lightweight HTTP framework, mature ecosystem |
| **TypeScript** | 5.x | Type safety across API boundaries |
| **ws** | 8.x | Most popular WebSocket library for Node.js |
| **uuid** | 14.x | Unique ID generation for rooms/players |

### Frontend

| Technology | Version | Justification |
|------------|---------|---------------|
| **React** | 18.x | Component-based UI, large ecosystem |
| **TypeScript** | 5.x | Type safety, better DX |
| **Vite** | 8.x | Fast HMR, modern build tool |
| **React Router** | 6.x | Client-side routing |
| **Axios** | 1.x | HTTP client with interceptors |
| **Bootstrap 5** | 5.x | CSS base, customized with dark theme |

### Data Flow

```
Player Action (click/skip)
        │
        ▼
   Client Event
        │
        ├─ HTTP ─► REST API ─► Update Server State
        │
        └─ WS ───► WebSocket Handler ─► Validate ─► Update State
                                        │
                                        ▼
                                 Broadcast to All
                                        │
                                        ▼
                                 Client Receives Update
                                        │
                                        ▼
                                 React Re-renders
```

## Component Design

### Backend Components

#### `server.ts` — Entry Point
- Initializes Express + HTTP server
- Mounts middleware (CORS, JSON parsing)
- Registers REST routes
- Spawns WebSocket server

#### `routes/rooms.ts` — REST API
```
POST   /api/rooms              → Create room, return {roomId, playerId}
POST   /api/rooms/:id/join     → Join room, validate capacity
GET    /api/rooms/:id           → Get current game state
POST   /api/rooms/:id/start     → Start game, deal cards
DELETE /api/rooms/:id           → Delete room
GET    /api/rooms               → List active rooms
```

#### `utils/gameLogic.ts` — Core Game Engine
```
createGameState()    → Initialize empty game state
generateCards()      → Shuffle words + colors into 5×5 grid
handleGuess()        → Process card guess, update state
generateClue()       → Heuristic clue generation
```

#### `utils/webSocketHandler.ts` — Real-time Layer
```
setupWebSocket()     → Initialize WSS, handle connections
handleWebSocket()    → Route messages by type
broadcastToRoom()    → Fan-out to all connected players
```

#### `utils/wordDatabase.ts` — Content Layer
```
IT_WORD_CATEGORIES: 13 categories
getRandomWords(n)    → Shuffle and pick n words
getWordsByCategory() → Filter by category
```

### Frontend Components

#### Page Components

```
App (Router)
 ├── LobbyPage
 │    ├── Input: playerName, roomId
 │    ├── Actions: createRoom, joinRoom
 │    └── Display: room code, how-to-play
 │
 └── GamePage
      ├── Join phase (enter name)
      ├── Game phase
      │    ├── Scoreboard
      │    ├── ClueDisplay
      │    ├── GameBoard (5×5 grid)
      │    └── PlayerList
      └── GameOver overlay
```

#### Reusable Components

```
GameBoard
 ├── Props: cards[], onGuess(cardIndex), disabled
 ├── Renders: 5×5 CSS grid
 └── Cards: revealed/unrevealed states

Scoreboard
 ├── Props: scores, remaining, currentTurn
 ├── Renders: team scores + remaining cards
 └── Highlights: active turn

ClueDisplay
 ├── Props: clue, currentTurn, canStartRound
 ├── Renders: spymaster clue or prompt
 └── States: waiting, showing clue, game over
```

## State Management

### Server-Side State
```typescript
interface GameState {
  roomId: string;
  status: 'waiting' | 'spymaster-ready' | 'playing' | 'finished';
  players: Player[];           // 2-6 players
  cards: Card[];               // 25 cards, 5×5 grid
  currentTurn: 'red' | 'blue';
  clues: { word: string; count: number } | null;
  scores: { red: number; blue: number };
  remainingCards: { red: number; blue: number; civilian: number; assassin: number };
}
```

### Client-Side State
```typescript
// GamePage
gameData: { roomId, playerId, player, gameState } | null
playerName: string
loading: boolean
error: string

// GameBoard (local only for animation)
No local state — all derived from props
```

### WebSocket Protocol

#### Client → Server
| Message | Payload | Description |
|---------|---------|-------------|
| `guess` | `{ cardIndex: number }` | Player selects a card |
| `skip_turn` | `{}` | Player skips their turn |
| `start_round` | `{}` | Spymaster requests new clue |

#### Server → Client
| Message | Payload | Description |
|---------|---------|-------------|
| `game_update` | `GameState` | Full state sync |
| `guess_result` | `{ card, correct, gameOver, winner }` | Card reveal result |
| `start_round` | `{ clue, currentTurn }` | New clue for spymaster |
| `player_list` | `Player[]` | Updated player roster |

## Data Model

### Word Database Structure
```
IT Word Entry:
  word: string        // Display name (e.g., "React")
  category: string    // Group key (e.g., "frameworks")

Categories (13):
  languages, frameworks, databases, devops, concepts,
  vcs, ai, security, os, mobile, testing, patterns, misc
```

### Card Distribution
```
Total: 25 cards (5×5 grid)
  Red cards:     8 (team color)
  Blue cards:    8 (team color)
  Civilian:      8 (neutral)
  Assassin:      1 (instant loss)
```

## UI/UX Design

### Color Scheme
| Element | Color | Usage |
|---------|-------|-------|
| Background | `#1a1a2e` | Page background |
| Card (unrevealed) | Gradient per team | Card faces |
| Card (revealed red) | `#4a1520` | Revealed red cards |
| Card (revealed blue) | `#152545` | Revealed blue cards |
| Card (civilian) | `#2a3a2a` | Revealed civilian |
| Card (assassin) | `#1a1a1a` | Revealed assassin |
| Accent | `#533483` | Interactive elements |

### Responsive Breakpoints
| Screen | Layout |
|--------|--------|
| ≥1000px | Full grid, side-by-side scoreboard |
| 600-999px | Compact grid, smaller fonts |
| <600px | Stacked layout, minimal card text |

### Card States
```
Unrevealed:
  • Hover: translateY(-3px) + shadow
  • Cursor: pointer
  • Shows word in white text

Revealed:
  • Background changes to team color
  • Opacity: 0.7
  • Shows emoji icon (🔴🔵⚪💀)
  • Cursor: default
```

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Room enumeration | 6-char alphanumeric codes (16.7M combinations) |
| WebSocket injection | JSON.parse + type validation on all messages |
| Race conditions | Server-authoritative state (no client trust) |
| DoS | Rate limiting (future), max 6 players per room |

## Performance

| Metric | Target | Actual |
|--------|--------|--------|
| Frontend build time | < 3s | 1.06s ✅ |
| TypeScript compile | < 2s | Immediate ✅ |
| WebSocket latency | < 100ms | N/A (local) |
| Backend memory | < 50MB | N/A |

## Testing Strategy

### Unit Tests (future)
- `gameLogic.test.ts` — Card generation, guess handling, win detection
- `wordDatabase.test.ts` — Word count, category filtering, shuffle

### Integration Tests (future)
- `rooms.test.ts` — Room CRUD endpoints
- `webSocket.test.ts` — Connection lifecycle, message routing

### E2E (future)
- Playwright: Full game flow from lobby to game over

## Deployment

### Current (Development)
```bash
# Backend
cd backend && npm run dev    # Hot-reload via tsx

# Frontend
cd frontend && npm run dev   # Vite HMR
```

### Production (future)
```
Backend:  Node.js process manager (PM2) or container (Docker/K8s)
Frontend: Static files served via nginx or CDN
WebSocket: Same host, reverse proxy with upgrade headers
```

## Extensibility Points

1. **Persistent storage** — Replace in-memory rooms with Redis
2. **LLM clues** — Integrate OpenAI API for smarter clue generation
3. **Authentication** — Add JWT or OAuth for player accounts
4. **Chat** — Add text chat channel per room
5. **Themes** — Pluggable word databases (movies, music, science)
6. **PWA** — Add service worker for offline capability
