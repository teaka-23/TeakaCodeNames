# Proposal: Codenames IT Edition

## Problem

Codenames is a popular party word-guessing game that requires players to think creatively and work together. The original game uses a generic word deck, which limits thematic engagement for tech-savvy audiences. There is no widely available implementation that:

1. Uses IT/technology-themed words
2. Provides a modern web-based multiplayer experience
3. Supports real-time gameplay between multiple players
4. Is easy to set up and play in a group setting

## Solution

Build **Codenames IT Edition** — a fully functional, web-based multiplayer word-guessing game with an IT technology theme. The game will feature:

- A curated database of 150+ IT-themed words across categories (programming languages, frameworks, DevOps, AI, databases, security, etc.)
- Real-time multiplayer gameplay via WebSockets
- A modern, responsive dark-themed UI
- Full game mechanics: room creation, team assignment, spymaster clues, scoring, win detection

## Goals

| Goal | Metric |
|------|--------|
| Support multiplayer gameplay | 3-6 players per room, real-time sync |
| Cover IT domain knowledge | 150+ words across 13 categories |
| Provide instant feedback | WebSocket-based updates < 100ms |
| Be easy to use | No installation required, browser-based |
| Support the full game loop | From room creation to game over |

## Non-Goals

- Mobile-native apps (PWA-ready but not app-store distributed)
- AI-powered Spymaster (clues generated heuristically, not via LLM)
- Tournament mode or ranked matchmaking
- Voice/chat communication features
- Mobile-optimized touch interactions (v1)

## Users

| User | Description |
|------|-------------|
| **Team Lead / Scrum Master** | Organizes team-building activities and icebreakers |
| **IT Students** | Study groups looking for fun educational activities |
| **Conference Attendees** | Networking events and breaks at tech conferences |
| **Remote Teams** | Virtual team bonding during online meetings |

## Success Criteria

1. ✅ Backend API handles room CRUD and WebSocket connections
2. ✅ Frontend renders the game board with all 25 cards
3. ✅ Real-time updates work across 2+ browser tabs
4. ✅ All game rules implemented (correct guess, wrong guess, civilian, assassin)
5. ✅ IT word database contains 150+ words organized by category
6. ✅ TypeScript code compiles with zero errors (both frontend and backend)
7. ✅ Production builds succeed for both frontend and backend

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| WebSocket reconnects drop game state | Game breaks | Server stores full state, re-sends on reconnect |
| In-memory storage loses data on restart | Rooms lost | Acceptable for v1; future: persist to Redis/DB |
| Clue generation too simple | Less fun | v1 uses heuristic; future: LLM-powered clues |
| No mobile optimization | Poor UX on phones | Acceptable for v1; future: responsive redesign |

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Architecture & Setup | 1 day | ✅ Done |
| Backend API + WebSocket | 2 days | ✅ Done |
| Frontend UI Components | 2 days | ✅ Done |
| Integration & Testing | 1 day | ✅ Done |
| **Total** | **~6 days** | **Complete** |

## Current Status

**Architecture defined. All planning artifacts created. Implementation complete.**

The codebase has been scaffolded, built, and type-checked with zero errors. This proposal documents the design decisions and specifications for the project.
