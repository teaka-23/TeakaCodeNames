import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from '../LandingPage';

describe('LandingPage', () => {
  it('renders brand and play / demo links', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Codenames' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Играть' })).toHaveAttribute('href', '/lobby');
    expect(screen.getByRole('link', { name: 'Демо' })).toHaveAttribute('href', '/demo');
  });

  it('scrolls to rules when Правила is clicked', async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    const original = document.getElementById.bind(document);
    vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
      if (id === 'rules') {
        return { scrollIntoView } as unknown as HTMLElement;
      }
      return original(id);
    });

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Правила' }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });
});
