import {
  createGameState,
  generateCards,
  handleGuess,
} from '../src/utils/gameLogic';
import type { GameState } from '../src/types';

describe('createGameState', () => {
  it('should create game state with correct initial values', () => {
    const gameState = createGameState('ROOM1', []);

    expect(gameState.roomId).toBe('ROOM1');
    expect(gameState.status).toBe('waiting');
    expect(gameState.players).toEqual([]);
    expect(gameState.cards).toEqual([]);
    expect(gameState.clues).toBeNull();
    expect(gameState.scores).toEqual({ red: 0, blue: 0 });
    expect(gameState.remainingCards).toEqual({
      red: 8,
      blue: 8,
      civilian: 8,
      assassin: 1,
    });
  });

  it('should set currentTurn to either red or blue', () => {
    const gameState = createGameState('ROOM1', []);
    expect(['red', 'blue']).toContain(gameState.currentTurn);
  });
});

describe('generateCards', () => {
  it('should generate exactly 25 cards', () => {
    const cards = generateCards();
    expect(cards).toHaveLength(25);
  });

  it('should have correct color distribution', () => {
    const cards = generateCards();
    const colors = cards.map(c => c.color);

    const redCount = colors.filter(c => c === 'red').length;
    const blueCount = colors.filter(c => c === 'blue').length;
    const civilianCount = colors.filter(c => c === 'civilian').length;
    const assassinCount = colors.filter(c => c === 'assassin').length;

    expect(redCount).toBe(8);
    expect(blueCount).toBe(8);
    expect(civilianCount).toBe(8);
    expect(assassinCount).toBe(1);
  });

  it('should have unique words', () => {
    const cards = generateCards();
    const words = cards.map(c => c.word);
    const uniqueWords = new Set(words);
    expect(uniqueWords.size).toBe(25);
  });

  it('should have correct grid positions', () => {
    const cards = generateCards();
    cards.forEach((card, index) => {
      expect(card.x).toBe(index % 5);
      expect(card.y).toBe(Math.floor(index / 5));
    });
  });

  it('should mark all cards as unrevealed initially', () => {
    const cards = generateCards();
    cards.forEach(card => {
      expect(card.revealed).toBe(false);
    });
  });
});

describe('handleGuess', () => {
  // Helper to create a test game state with cards
  function createTestGameState(): GameState {
    const gameState = createGameState('TEST', []);
    gameState.cards = generateCards();
    return gameState;
  }

  it('should increment score for correct team card', () => {
    const gameState = createTestGameState();
    gameState.currentTurn = 'red';

    // Find a red card
    const redCardIndex = gameState.cards.findIndex(c => c.color === 'red');

    const { newState, gameOver } = handleGuess(gameState, redCardIndex);

    expect(newState.scores.red).toBe(1);
    expect(newState.remainingCards.red).toBe(7);
    expect(newState.cards[redCardIndex].revealed).toBe(true);
    expect(gameOver).toBe(false);
  });

  it('should continue turn after correct guess', () => {
    const gameState = createTestGameState();
    gameState.currentTurn = 'red';

    const redCardIndex = gameState.cards.findIndex(c => c.color === 'red');
    const { newState } = handleGuess(gameState, redCardIndex);

    expect(newState.currentTurn).toBe('red');
  });

  it('should pass turn after guessing opponent color', () => {
    const gameState = createTestGameState();
    gameState.currentTurn = 'red';

    // Find a blue card
    const blueCardIndex = gameState.cards.findIndex(c => c.color === 'blue');

    const { newState, gameOver } = handleGuess(gameState, blueCardIndex);

    expect(newState.currentTurn).toBe('blue');
    expect(newState.scores.red).toBe(0);
    expect(newState.scores.blue).toBe(1);
    expect(newState.remainingCards.blue).toBe(7);
    expect(gameOver).toBe(false);
  });

  it('should award the win when the opponent reveals the last enemy card', () => {
    const gameState = createTestGameState();
    gameState.currentTurn = 'red';
    gameState.remainingCards.blue = 1;

    const blueCardIndex = gameState.cards.findIndex(c => c.color === 'blue');
    const { newState, gameOver, winner } = handleGuess(gameState, blueCardIndex);

    expect(gameOver).toBe(true);
    expect(winner).toBe('blue');
    expect(newState.status).toBe('finished');
    expect(newState.scores.blue).toBe(1);
    expect(newState.remainingCards.blue).toBe(0);
    expect(newState.cards.every(card => card.revealed)).toBe(true);
  });

  it('should mark guessed card as revealed', () => {
    const gameState = createTestGameState();
    const cardIndex = 0;

    const { newState } = handleGuess(gameState, cardIndex);

    expect(newState.cards[cardIndex].revealed).toBe(true);
  });

  it('should handle civilian card correctly', () => {
    const gameState = createTestGameState();
    gameState.currentTurn = 'red';

    const civilianIndex = gameState.cards.findIndex(c => c.color === 'civilian');

    const { newState } = handleGuess(gameState, civilianIndex);

    expect(newState.currentTurn).toBe('blue');
    expect(newState.scores.red).toBe(0);
    expect(newState.remainingCards.civilian).toBe(7);
  });

  it('should end game and give opponent win on assassin', () => {
    const gameState = createTestGameState();
    gameState.currentTurn = 'red';

    const assassinIndex = gameState.cards.findIndex(c => c.color === 'assassin');

    const { newState, gameOver } = handleGuess(gameState, assassinIndex);

    expect(gameOver).toBe(true);
    expect(newState.status).toBe('finished');
    expect(newState.winner).toBe('blue');
    expect(newState.remainingCards.assassin).toBe(0);
    expect(newState.scores.red).toBe(0);
    expect(newState.scores.blue).toBe(0);
    expect(newState.cards.every(card => card.revealed)).toBe(true);
  });

  it('should win when all red cards are revealed', () => {
    const gameState = createTestGameState();
    gameState.currentTurn = 'red';
    gameState.remainingCards.red = 1;

    const redCardIndex = gameState.cards.findIndex(c => c.color === 'red');

    const { newState, gameOver } = handleGuess(gameState, redCardIndex);

    expect(gameOver).toBe(true);
    expect(newState.status).toBe('finished');
    expect(newState.remainingCards.red).toBe(0);
  });

  it('should win when all blue cards are revealed', () => {
    const gameState = createTestGameState();
    gameState.currentTurn = 'blue';
    gameState.remainingCards.blue = 1;

    const blueCardIndex = gameState.cards.findIndex(c => c.color === 'blue');

    const { newState, gameOver } = handleGuess(gameState, blueCardIndex);

    expect(gameOver).toBe(true);
    expect(newState.status).toBe('finished');
    expect(newState.remainingCards.blue).toBe(0);
  });
});

describe('shuffle correctness', () => {
  it('should produce different orderings on multiple calls', () => {
    const wordSets: string[] = [];
    for (let i = 0; i < 20; i++) {
      const cards = generateCards();
      const wordOrder = cards.map(c => c.word).join(',');
      wordSets.push(wordOrder);
    }

    const uniqueSets = new Set(wordSets);
    // Should have at least 90% unique results
    const uniquenessRatio = uniqueSets.size / wordSets.length;
    expect(uniquenessRatio).toBeGreaterThanOrEqual(0.9);
  });

  it('should preserve all elements after shuffle', () => {
    const cards = generateCards();
    const colors = cards.map(c => c.color);

    const redCount = colors.filter(c => c === 'red').length;
    const blueCount = colors.filter(c => c === 'blue').length;
    const civilianCount = colors.filter(c => c === 'civilian').length;
    const assassinCount = colors.filter(c => c === 'assassin').length;

    // Verify distribution is correct (allowing for randomness in which cards)
    expect(redCount + blueCount + civilianCount + assassinCount).toBe(25);
    expect(assassinCount).toBe(1);
    expect(civilianCount).toBe(8);
    expect(redCount + blueCount).toBe(16);
  });
});
