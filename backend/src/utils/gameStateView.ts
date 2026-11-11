import type { Card, GameEvent, GameState, Player } from '../types';

/** Spymasters, spectators, and end-of-game see the full layout. */
export function canSeeCardColors(player: Player | undefined, status: GameState['status']): boolean {
  if (status === 'finished') return true;
  if (!player) return false;
  return player.role === 'spymaster' || player.role === 'spectator';
}

function sanitizeCard(card: Card, seeColors: boolean): Card {
  if (card.revealed || seeColors) return card;
  return { ...card, color: null };
}

function sanitizeEvent(event: GameEvent, seeColors: boolean): GameEvent {
  if (seeColors || event.kind !== 'clue') return event;
  return { ...event, targetWords: [] };
}

/**
 * Player-facing game state: hide unrevealed card colors and pending mark targets
 * from guessers / anonymous viewers.
 */
export function gameStateForViewer(state: GameState, playerId?: string | null): GameState {
  const player = playerId
    ? state.players.find((p) => p.id === playerId)
    : undefined;
  const seeColors = canSeeCardColors(player, state.status);

  const canSeeTargets =
    Boolean(player)
    && player!.role === 'spymaster'
    && player!.team === state.currentTurn
    && state.status === 'spymaster-ready';

  return {
    ...state,
    cards: state.cards.map((card) => sanitizeCard(card, seeColors)),
    clueTargets: canSeeTargets ? (state.clueTargets ?? []) : [],
    eventLog: (state.eventLog ?? []).map((event) => sanitizeEvent(event, seeColors)),
  };
}
