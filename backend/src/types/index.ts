export type ThemeId = 'it' | 'football' | 'yoga' | 'movies';
export type TeamColor = 'red' | 'blue';
export type CardColor = TeamColor | 'civilian' | 'assassin';
export type GameStatus = 'waiting' | 'spymaster-ready' | 'playing' | 'finished';
export type PlayerRole = 'spymaster' | 'guesser' | 'spectator';

export interface Player {
  id: string;
  name: string;
  team: TeamColor;
  role: PlayerRole;
}

export interface Card {
  word: string;
  /** Glyph that illustrates the word. It does not reveal the card color. */
  picture: string;
  color: CardColor;
  x: number;
  y: number;
  revealed: boolean;
}

export interface ClueEntry {
  word: string;
  count: number;
  team: TeamColor;
}

export interface GameState {
  roomId: string;
  theme: ThemeId;
  status: GameStatus;
  players: Player[];
  cards: Card[];
  currentTurn: TeamColor;
  clues: {
    word: string;
    count: number;
  } | null;
  /** Every clue given this match, newest last. Survives turn changes. */
  clueHistory: ClueEntry[];
  scores: {
    red: number;
    blue: number;
  };
  remainingCards: {
    red: number;
    blue: number;
    civilian: number;
    assassin: number;
  };
  /** Epoch ms when the current turn expires; null while the round has not started. */
  turnDeadline: number | null;
  /** Set when status becomes 'finished'; null/undefined while the game is running. */
  winner: TeamColor | null;
}

export interface Room {
  id: string;
  gameState: GameState;
  maxPlayers: number;
  createdAt: number;
}

// WebSocket message types
export interface WsMessage {
  type: string;
  payload: unknown;
}

export interface JoinRoomMessage extends WsMessage {
  type: 'join_room';
  payload: { playerId: string; playerName: string };
}

export interface TeamAssignmentMessage extends WsMessage {
  type: 'team_assigned';
  payload: { playerId: string; team: TeamColor; role: PlayerRole };
}

export interface GameUpdateMessage extends WsMessage {
  type: 'game_update';
  payload: GameState;
}

export interface GuessResultMessage extends WsMessage {
  type: 'guess_result';
  payload: {
    card: Card;
    correct: boolean;
    gameOver: boolean;
    winner?: TeamColor;
  };
}

export interface ReadyMessage extends WsMessage {
  type: 'spymaster_ready';
  payload: { playerId: string };
}

export interface StartRoundMessage extends WsMessage {
  type: 'start_round';
  payload: { clue: { word: string; count: number }; currentTurn: TeamColor };
}

export interface RevealClueMessage extends WsMessage {
  type: 'reveal_clue';
  payload: { clue: { word: string; count: number } };
}

export interface PlayerListMessage extends WsMessage {
  type: 'player_list';
  payload: Player[];
}

export interface TurnExpiredMessage extends WsMessage {
  type: 'turn_expired';
  payload: { currentTurn: TeamColor };
}

export type ServerMessageType =
  | JoinRoomMessage
  | TeamAssignmentMessage
  | GameUpdateMessage
  | GuessResultMessage
  | ReadyMessage
  | StartRoundMessage
  | RevealClueMessage
  | PlayerListMessage
  | TurnExpiredMessage;
