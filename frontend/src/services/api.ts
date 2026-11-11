import axios from 'axios';
import type { Player, GameState, ThemeId, TeamColor, PlayerRole } from '../types';

function resolveApiBase(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL as string;
  }
  const backend = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (backend) {
    return `${backend.replace(/\/$/, '')}/api`;
  }
  // Same-origin (Docker/nginx or Vite proxy)
  return '/api';
}

const API_BASE = resolveApiBase();

const client = axios.create({
  baseURL: API_BASE,
  // Render free tier can take ~30–50s to wake; keep a single long attempt.
  timeout: 45000,
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'Ошибка сети';
    return Promise.reject(new Error(typeof message === 'string' ? message : 'Ошибка сети'));
  }
);

/** Fires onSlow if the request is still pending after delayMs (cold-start UX). */
export async function withWarmupHint<T>(
  work: () => Promise<T>,
  onSlow?: () => void,
  delayMs = 2500
): Promise<T> {
  const timer = window.setTimeout(() => onSlow?.(), delayMs);
  try {
    return await work();
  } finally {
    window.clearTimeout(timer);
  }
}

export interface CreateRoomResponse {
  roomId: string;
  token: string;
  playerId: string;
  player: Player;
  gameState: GameState;
}

export interface JoinRoomResponse {
  playerId: string;
  token: string;
  player: Player;
  gameState: GameState;
}

export const api = {
  async createRoom(
    playerName: string,
    theme: ThemeId = 'it',
    turnSeconds?: number
  ): Promise<CreateRoomResponse> {
    const response = await client.post('/rooms', {
      playerName,
      theme,
      ...(turnSeconds === undefined ? {} : { turnSeconds }),
    });
    return response.data;
  },

  async dealTheme(theme: ThemeId): Promise<Array<{ word: string; picture: string }>> {
    const response = await client.get(`/themes/${theme}/deal`);
    return response.data.cards;
  },

  async joinRoom(roomId: string, playerName: string, spectate = false): Promise<JoinRoomResponse> {
    const response = await client.post(`/rooms/${roomId}/join`, { playerName, spectate });
    return response.data;
  },

  async getRoom(
    roomId: string,
    auth?: { playerId: string; token: string }
  ): Promise<{ gameState: GameState }> {
    const response = await client.get(`/rooms/${roomId}`, {
      params: auth ? { playerId: auth.playerId, token: auth.token } : undefined,
      headers: auth ? { 'X-Room-Token': auth.token } : undefined,
    });
    return response.data;
  },

  async claimSeat(
    roomId: string,
    playerId: string,
    token: string,
    team: TeamColor,
    role: Exclude<PlayerRole, 'spectator'>
  ): Promise<{ gameState: GameState }> {
    const response = await client.post(`/rooms/${roomId}/claim-seat`, {
      playerId,
      token,
      team,
      role,
    });
    return response.data;
  },

  async startRoom(
    roomId: string,
    playerId: string,
    token: string
  ): Promise<{ gameState: GameState }> {
    const response = await client.post(`/rooms/${roomId}/start`, { playerId, token });
    return response.data;
  },

  async deleteRoom(roomId: string, playerId: string, token: string): Promise<void> {
    await client.delete(`/rooms/${roomId}`, { data: { playerId, token } });
  },

  async listRooms() {
    const response = await client.get('/rooms');
    return response.data;
  },
};

export { API_BASE };
