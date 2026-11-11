import { RoomManager } from '../src/utils/roomManager';

describe('guess cap (count + 1)', () => {
  function readyRoom() {
    const manager = new RoomManager();
    const room = manager.create('Алиса', 'p1');
    manager.join(room.id, 'Боб', 'p2');
    manager.join(room.id, 'Виктор', 'p3');
    manager.claimSeat(room.id, 'p1', 'red', 'spymaster');
    manager.claimSeat(room.id, 'p2', 'red', 'guesser');
    manager.claimSeat(room.id, 'p3', 'blue', 'guesser');
    manager.start(room.id);
    room.gameState.currentTurn = 'red';
    room.gameState.status = 'playing';
    room.gameState.clues = { word: 'тест', count: 1 };
    room.gameState.guessesRemaining = 2; // count + 1
    return { manager, room };
  }

  it('passes the turn after exhausting guesses on correct cards', () => {
    const { manager, room } = readyRoom();
    const redIndexes = room.gameState.cards
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.color === 'red' && !c.revealed)
      .map(({ i }) => i);

    expect(redIndexes.length).toBeGreaterThanOrEqual(2);

    manager.guess(room.id, redIndexes[0]);
    expect(room.gameState.guessesRemaining).toBe(1);
    expect(room.gameState.currentTurn).toBe('red');
    expect(room.gameState.status).toBe('playing');

    manager.guess(room.id, redIndexes[1]);
    expect(room.gameState.guessesRemaining).toBeNull();
    expect(room.gameState.currentTurn).toBe('blue');
    expect(room.gameState.status).toBe('spymaster-ready');
    expect(room.gameState.clues).toBeNull();
  });

  it('clears the guess budget when a miss ends the turn', () => {
    const { manager, room } = readyRoom();
    const blueIndex = room.gameState.cards.findIndex((c) => c.color === 'blue' && !c.revealed);
    expect(blueIndex).toBeGreaterThanOrEqual(0);

    manager.guess(room.id, blueIndex);
    expect(room.gameState.guessesRemaining).toBeNull();
    expect(room.gameState.currentTurn).toBe('blue');
  });
});
