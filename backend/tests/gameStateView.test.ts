import { RoomManager } from '../src/utils/roomManager';
import { gameStateForViewer, canSeeCardColors } from '../src/utils/gameStateView';

describe('gameStateForViewer', () => {
  function started() {
    const manager = new RoomManager();
    const room = manager.create('Алиса', 'p1');
    manager.join(room.id, 'Боб', 'p2');
    manager.join(room.id, 'Виктор', 'p3');
    manager.claimSeat(room.id, 'p1', 'red', 'spymaster');
    manager.claimSeat(room.id, 'p2', 'red', 'guesser');
    manager.claimSeat(room.id, 'p3', 'blue', 'spymaster');
    manager.start(room.id);
    return room;
  }

  it('strips colors for guessers', () => {
    const room = started();
    const view = gameStateForViewer(room.gameState, 'p2');
    expect(view.cards.every((c) => c.color === null)).toBe(true);
    expect(canSeeCardColors(room.gameState.players.find((p) => p.id === 'p2'), room.gameState.status)).toBe(false);
  });

  it('keeps colors for spymasters', () => {
    const room = started();
    const view = gameStateForViewer(room.gameState, 'p1');
    expect(view.cards.every((c) => c.color !== null)).toBe(true);
  });

  it('strips colors for anonymous viewers', () => {
    const room = started();
    const view = gameStateForViewer(room.gameState, null);
    expect(view.cards.every((c) => c.color === null)).toBe(true);
    expect(view.clueTargets).toEqual([]);
  });

  it('hides clueTargets from non-marking players', () => {
    const room = started();
    room.gameState.clueTargets = [room.gameState.cards[0].word!];
    const spyView = gameStateForViewer(room.gameState, 'p1');
    const otherView = gameStateForViewer(room.gameState, 'p2');
    if (room.gameState.players.find((p) => p.id === 'p1')!.team === room.gameState.currentTurn) {
      expect(spyView.clueTargets.length).toBe(1);
    }
    expect(otherView.clueTargets).toEqual([]);
  });
});
