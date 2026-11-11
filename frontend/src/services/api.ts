import axios from 'axios';
import type { Player, GameState } from '../types';

// In dev, VITE_API_URL can point to backend; otherwise use same-origin
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'Ошибка сети';
    return Promise.reject(new Error(typeof message === 'string' ? message : 'Ошибка сети'));
  }
);

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
  async createRoom(playerName: string): Promise<CreateRoomResponse> {
    const response = await client.post('/rooms', { playerName });
    return response.data;
  },

  async joinRoom(roomId: string, playerName: string, spectate = false): Promise<JoinRoomResponse> {
    const response = await client.post(`/rooms/${roomId}/join`, { playerName, spectate });
    return response.data;
  },

  async getRoom(roomId: string): Promise<{ gameState: GameState }> {
    const response = await client.get(`/rooms/${roomId}`);
    return response.data;
  },

  async startRoom(roomId: string): Promise<{ gameState: GameState }> {
    const response = await client.post(`/rooms/${roomId}/start`);
    return response.data;
  },

  async deleteRoom(roomId: string): Promise<void> {
    await client.delete(`/rooms/${roomId}`);
  },

  async listRooms() {
    const response = await client.get('/rooms');
    return response.data;
  },
};

export { API_BASE };
