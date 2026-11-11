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
  /** Null when the server hides the layout from this viewer. */
  color: CardColor | null;
  x: number;
  y: number;
  revealed: boolean;
}

export interface ClueEntry {
  word: string;
  count: number;
  team: TeamColor;
}

export type GameEvent =
  | {
      id: string;
      at: number;
      kind: 'clue';
      team: TeamColor;
      word: string;
      count: number;
      targetWords: string[];
    }
  | {
      id: string;
      at: number;
      kind: 'guess';
      team: TeamColor;
      playerId: string;
      playerName: string;
      word: string;
      color: CardColor;
      correct: boolean;
    }
  | {
      id: string;
      at: number;
      kind: 'skip' | 'turn_expired';
      team: TeamColor;
    }
  | {
      id: string;
      at: number;
      kind: 'game_over';
      winner: TeamColor | null;
    };

export interface ChatMessage {
  id: string;
  at: number;
  playerId: string;
  playerName: string;
  text: string;
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
  eventLog?: GameEvent[];
  clueTargets?: string[];
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
  /** Guesses left for the active clue (count + 1). Null when no clue. */
  guessesRemaining?: number | null;
  /** 0 disables the turn timer. */
  turnDurationMs?: number;
  /** Room creator — only they can start. */
  hostId?: string;
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
