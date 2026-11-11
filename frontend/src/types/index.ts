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
  picture?: string;
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
  theme?: ThemeId;
  status: GameStatus;
  players: Player[];
  cards: Card[];
  currentTurn: TeamColor;
  clues: {
    word: string;
    count: number;
  } | null;
  clueHistory?: ClueEntry[];
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
  turnDeadline: number | null;
  winner?: TeamColor | null;
}

export interface WSMessage {
  type: string;
  payload: unknown;
}

export interface GameUpdateMessage extends WSMessage {
  type: 'game_update';
  payload: GameState;
}

export interface GuessResultMessage extends WSMessage {
  type: 'guess_result';
  payload: {
    card: Card;
    correct: boolean;
    gameOver: boolean;
    winner?: TeamColor;
  };
}

export interface PlayerListMessage extends WSMessage {
  type: 'player_list';
  payload: Player[];
}

export interface StartRoundMessage extends WSMessage {
  type: 'start_round';
  payload: {
    clue: { word: string; count: number };
    currentTurn: TeamColor;
  };
}
