import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';

vi.mock('../pages/LandingPage', () => ({
  default: () => <div>Landing mock</div>,
}));
vi.mock('../pages/DemoPage', () => ({
  default: () => <div>Demo mock</div>,
}));
vi.mock('../pages/LobbyPage', () => ({
  default: () => <div>Lobby mock</div>,
}));
vi.mock('../pages/GamePage', () => ({
  default: () => <div>Game mock</div>,
}));

describe('App', () => {
  it('renders the landing route', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(screen.getByText('Загрузка...')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Landing mock')).toBeInTheDocument());
  });

  it('redirects unknown paths to landing', async () => {
    window.history.pushState({}, '', '/nope');
    render(<App />);
    await waitFor(() => expect(screen.getByText('Landing mock')).toBeInTheDocument());
  });
});
