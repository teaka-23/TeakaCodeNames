# Codenames IT Edition 🕵️‍♂️💻

A technology-themed multiplayer word guessing game built with React, TypeScript, and Node.js.

## Features

- **IT-Themed Words**: 150+ technology-related words across categories (languages, frameworks, DevOps, AI, databases, etc.)
- **Real-time Multiplayer**: WebSocket-based live gameplay
- **Two Teams**: Red vs Blue with Spymasters
- **Full Game Logic**: Card generation, scoring, turn management, win detection
- **Beautiful Dark UI**: Modern responsive design

## Tech Stack

### Backend
- Node.js + Express + TypeScript
- WebSocket (ws) for real-time communication
- In-memory game state management

### Frontend
- React 18 + TypeScript
- Vite for fast development
- React Router for navigation
- Bootstrap CSS
- Axios for HTTP requests

## Project Structure

```
CodeNames/
├── backend/               # Node.js API server
│   ├── src/
│   │   ├── routes/        # REST API routes
│   │   ├── types/         # TypeScript types
│   │   ├── utils/         # Game logic & helpers
│   │   └── server.ts      # Main server entry
│   └── package.json
├── frontend/              # React web app
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API & WebSocket clients
│   │   └── types/         # TypeScript types
│   └── package.json
├── render.yaml            # Render Blueprint (API + static site)
├── DEPLOY.md              # Render / Docker / VPS deploy guide
└── README.md
```

## Deployment

Fastest path: push the repo and create a **Blueprint** from [`render.yaml`](./render.yaml) in the [Render Dashboard](https://dashboard.render.com/). Details and Free-plan caveats are in [`DEPLOY.md`](./DEPLOY.md).

## Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Setup

1. **Install backend dependencies:**
```bash
cd backend
npm install
```

2. **Install frontend dependencies:**
```bash
cd frontend
npm install
```

## Running the Application

### Development Mode

1. **Start the backend server:**
```bash
cd backend
npm run dev
```
Server runs on `http://localhost:3001`

2. **Start the frontend (in a new terminal):**
```bash
cd frontend
npm run dev
```
Frontend runs on `http://localhost:3000`

### Production Build

```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
```

## How to Play

1. **Create a Room**: One player creates a room and shares the code
2. **Join**: Other players join using the room code
3. **Start**: Once enough players join (3+), the host starts the game
4. **Roles**: Each team gets a Spymaster (sees clues) and Guessers
5. **Gameplay**:
   - Spymaster gives a word clue + number
   - Team guesses cards matching their color
   - Correct guess = continue turn
   - Wrong color = turn passes
   - Civilian = skip turn
   - Assassin = instant loss!

## Game Board

```
┌──────┬──────┬──────┬──────┬──────┐
│ Card │ Card │ Card │ Card │ Card │
├──────┼──────┼──────┼──────┼──────┤
│ Card │ Card │ Card │ Card │ Card │
├──────┼──────┼──────┼──────┼──────┤
│ Card │ Card │ Card │ Card │ Card │
├──────┼──────┼──────┼──────┼──────┤
│ Card │ Card │ Card │ Card │ Card │
├──────┼──────┼──────┼──────┼──────┤
│ Card │ Card │ Card │ Card │ Card │
└──────┴──────┴──────┴──────┴──────┘
```

- 8 Red cards 🔴
- 8 Blue cards 🔵
- 8 Civilian cards ⚪
- 1 Assassin card 💀

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rooms` | Create new room |
| POST | `/api/rooms/:id/join` | Join existing room |
| GET | `/api/rooms/:id` | Get room state |
| POST | `/api/rooms/:id/start` | Start the game |
| DELETE | `/api/rooms/:id` | Delete room |
| GET | `/api/rooms` | List active rooms |

## WebSocket Events

| Type | Direction | Description |
|------|-----------|-------------|
| `game_update` | Server→Client | Full game state update |
| `guess_result` | Server→Client | Result of a card guess |
| `start_round` | Server→Client | Clue for spymaster |
| `player_list` | Server→Client | Updated player list |
| `guess` | Client→Server | Player guesses a card |
| `skip_turn` | Client→Server | Skip current turn |
| `start_round` | Client→Server | Request new clue |

## License

MIT
