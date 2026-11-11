import { Card, GameState, Player, TeamColor, CardColor, ThemeId } from '../types';
import { categoryOf, dealEntries } from '../themes';

const GRID_SIZE = 5;
const CARDS_PER_TEAM = 8;
const CIVILIANS = 8;
const ASSASSINS = 1;
const TOTAL_CARDS = GRID_SIZE * GRID_SIZE; // 25

export function createGameState(
  roomId: string,
  players: Player[],
  theme: ThemeId = 'it'
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
    scores: { red: 0, blue: 0 },
    remainingCards: {
      red: CARDS_PER_TEAM,
      blue: CARDS_PER_TEAM,
      civilian: CIVILIANS,
      assassin: ASSASSINS,
    },
    turnDeadline: null,
    winner: null,
  };
}

export function generateCards(theme: ThemeId = 'it'): Card[] {
  const words = dealEntries(theme, TOTAL_CARDS);

  // Create color distribution
  const colors: CardColor[] = [];
  for (let i = 0; i < CARDS_PER_TEAM; i++) colors.push('red');
  for (let i = 0; i < CARDS_PER_TEAM; i++) colors.push('blue');
  for (let i = 0; i < CIVILIANS; i++) colors.push('civilian');
  colors.push('assassin');

  // Shuffle colors
  const shuffledColors = shuffleArray([...colors]);

  // Shuffle words
  const shuffledWords = shuffleArray([...words]);

  // Assign positions (row-major order in 5x5 grid)
  const cards: Card[] = shuffledWords.map((entry, index) => ({
    word: entry.word,
    picture: entry.picture,
    color: shuffledColors[index],
    x: index % GRID_SIZE,
    y: Math.floor(index / GRID_SIZE),
    revealed: false,
  }));

  return cards;
}

export function generateClue(
  cards: Card[],
  team?: TeamColor,
  theme: ThemeId = 'it'
): { word: string; count: number } {
  // Simple clue generation: find a word that relates to multiple cards of one team
  // This is a basic AI - in production you'd use a Spymaster (human)
  const teamCards = cards.filter(
    c => !c.revealed && (team ? c.color === team : c.color === 'red' || c.color === 'blue')
  );

  // Count category frequencies
  const categoryCounts = new Map<string, number>();

  for (const card of teamCards) {
    const category = categoryOf(theme, card.word);
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  }

  // Find the category with most unrevealed cards
  let bestCategory = '';
  let bestCount = 0;
  for (const [cat, count] of categoryCounts) {
    if (count > bestCount) {
      bestCategory = cat;
      bestCount = count;
    }
  }

  return {
    word: bestCategory || 'tech',
    count: bestCount || 1,
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
 * Own card: score +1, turn continues; the team wins when none of its 8 cards remain.
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
  } else {
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
