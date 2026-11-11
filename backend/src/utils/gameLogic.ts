import { Card, GameState, Player, TeamColor, CardColor, ThemeId } from '../types';
import { dealEntries } from '../themes';

const GRID_SIZE = 5;
/** Classic Codenames: starting team has 9, other has 8, 7 civilians, 1 assassin. */
export const STARTING_TEAM_CARDS = 9;
export const SECOND_TEAM_CARDS = 8;
export const CIVILIANS = 7;
export const ASSASSINS = 1;
const TOTAL_CARDS = GRID_SIZE * GRID_SIZE; // 25

export function createGameState(
  roomId: string,
  players: Player[],
  theme: ThemeId = 'it',
  hostId = ''
): GameState {
  return {
    roomId,
    theme,
    status: 'waiting',
    players,
    cards: [],
    currentTurn: Math.random() < 0.5 ? 'red' : 'blue',
    clues: null,
    clueHistory: [],
    eventLog: [],
    clueTargets: [],
    scores: { red: 0, blue: 0 },
    remainingCards: {
      red: SECOND_TEAM_CARDS,
      blue: SECOND_TEAM_CARDS,
      civilian: CIVILIANS,
      assassin: ASSASSINS,
    },
    turnDeadline: null,
    guessesRemaining: null,
    turnDurationMs: resolveDefaultTurnDurationMs(),
    hostId,
    winner: null,
  };
}

/** Default turn clock from env; 0 disables the timer. */
export function resolveDefaultTurnDurationMs(): number {
  const raw = process.env.TURN_DURATION_MS;
  if (raw === undefined || raw === '') return 60_000;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 60_000;
  return Math.round(n);
}

/**
 * Deal a classic 9/8 board. `startingTeam` gets 9 agents; the other gets 8.
 */
export function generateCards(
  theme: ThemeId = 'it',
  startingTeam: TeamColor = Math.random() < 0.5 ? 'red' : 'blue'
): Card[] {
  const words = dealEntries(theme, TOTAL_CARDS);
  const other: TeamColor = startingTeam === 'red' ? 'blue' : 'red';

  const colors: CardColor[] = [];
  for (let i = 0; i < STARTING_TEAM_CARDS; i++) colors.push(startingTeam);
  for (let i = 0; i < SECOND_TEAM_CARDS; i++) colors.push(other);
  for (let i = 0; i < CIVILIANS; i++) colors.push('civilian');
  colors.push('assassin');

  const shuffledColors = shuffleArray([...colors]);
  const shuffledWords = shuffleArray([...words]);

  return shuffledWords.map((entry, index) => ({
    word: entry.word,
    picture: entry.picture,
    color: shuffledColors[index],
    x: index % GRID_SIZE,
    y: Math.floor(index / GRID_SIZE),
    revealed: false,
  }));
}

export function remainingForDeal(startingTeam: TeamColor): GameState['remainingCards'] {
  return {
    red: startingTeam === 'red' ? STARTING_TEAM_CARDS : SECOND_TEAM_CARDS,
    blue: startingTeam === 'blue' ? STARTING_TEAM_CARDS : SECOND_TEAM_CARDS,
    civilian: CIVILIANS,
    assassin: ASSASSINS,
  };
}

function oppositeTeam(team: TeamColor): TeamColor {
  return team === 'red' ? 'blue' : 'red';
}

/** Flip every card and record the winner. Called only when the game is over. */
function finishGame(state: GameState, winner: TeamColor): void {
  state.status = 'finished';
  state.winner = winner;
  state.turnDeadline = null;
  for (const card of state.cards) {
    card.revealed = true;
  }
}

/**
 * Apply one guess and return the next state.
 *
 * Own card: score +1, turn continues; the team wins when none of its cards remain.
 * Opponent card: that team scores it, then the turn passes. If it was their last
 * card, they win immediately.
 * Civilian: turn passes. Assassin: the guessing team loses and the board flips.
 */
export function handleGuess(
  gameState: GameState,
  cardIndex: number
): {
  newState: GameState;
  gameOver: boolean;
  winner?: TeamColor;
  cardRevealed: Card;
  previousTurn: TeamColor;
} {
  const newState = JSON.parse(JSON.stringify(gameState)) as GameState;
  const card = newState.cards[cardIndex];
  card.revealed = true;

  const currentTeam = newState.currentTurn;
  const previousTurn = currentTeam;
  let gameOver = false;
  let winner: TeamColor | undefined;

  if (card.color === 'assassin') {
    newState.remainingCards.assassin = 0;
    winner = oppositeTeam(currentTeam);
    gameOver = true;
    finishGame(newState, winner);
  } else if (card.color === currentTeam) {
    newState.scores[currentTeam]++;
    newState.remainingCards[currentTeam]--;

    if (newState.remainingCards[currentTeam] === 0) {
      winner = currentTeam;
      gameOver = true;
      finishGame(newState, winner);
    }
  } else if (card.color === 'civilian') {
    newState.remainingCards.civilian--;
    newState.currentTurn = oppositeTeam(currentTeam);
  } else if (card.color === 'red' || card.color === 'blue') {
    const owner = card.color;
    newState.scores[owner]++;
    newState.remainingCards[owner]--;

    if (newState.remainingCards[owner] === 0) {
      winner = owner;
      gameOver = true;
      finishGame(newState, winner);
    } else {
      newState.currentTurn = oppositeTeam(currentTeam);
    }
  }

  return {
    newState,
    gameOver,
    winner,
    cardRevealed: card,
    previousTurn,
  };
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
