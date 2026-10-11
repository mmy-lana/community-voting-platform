import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, useRouter } from '../app/router';
import { NotFoundPage } from '../app/NotFoundPage';
import { App } from '../App';

function NavProbe() {
  const { path, navigate } = useRouter();
  return (
    <div>
      <span data-testid="current-path">{path}</span>
      <button onClick={() => navigate('/polls/3')}>go-detail</button>
      <button onClick={() => navigate('/polls/3/results')}>go-results</button>
      <button onClick={() => navigate('/')}>go-home</button>
      <button onClick={() => navigate('/polls/3')}>go-same</button>
    </div>
  );
}

describe('RouterProvider', () => {
  beforeEach(() => {
    window.history.pushState(null, '', '/');
    vi.stubGlobal('scrollTo', vi.fn());
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('navigate updates path, pushes history and scrolls to top', async () => {
    const user = userEvent.setup();
    render(
      <RouterProvider>
        <NavProbe />
      </RouterProvider>,
    );
    expect(screen.getByTestId('current-path')).toHaveTextContent('/');
    await user.click(screen.getByRole('button', { name: 'go-detail' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('/polls/3');
    expect(window.location.pathname).toBe('/polls/3');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(window.history.length).toBeGreaterThan(1);
  });

  it('popstate syncs the path (back navigation)', async () => {
    const user = userEvent.setup();
    render(
      <RouterProvider>
        <NavProbe />
      </RouterProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'go-results' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('/polls/3/results');
    window.history.back();
    // popstate fires asynchronously in jsdom via the history stack.
    await waitFor(() => {
      expect(screen.getByTestId('current-path')).toHaveTextContent('/polls/3');
    });
  });

  it('navigating to the same path is a no-op (no duplicate history entry)', async () => {
    const user = userEvent.setup();
    render(
      <RouterProvider>
        <NavProbe />
      </RouterProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'go-home' }));
    const historyLength = window.history.length;
    await user.click(screen.getByRole('button', { name: 'go-home' }));
    expect(window.history.length).toBe(historyLength);
  });
});

describe('RouteView fallback', () => {
  it('renders NotFoundPage with a working link home for unknown routes', async () => {
    const user = userEvent.setup();
    window.history.pushState(null, '', '/definitely/not/a/route');
    render(<App />);
    expect(await screen.findByRole('heading', { name: /404/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /return home/i }));
    expect(await screen.findByRole('heading', { name: /community polls/i })).toBeInTheDocument();
  });
});

describe('NotFoundPage', () => {
  it('links back to the home route', async () => {
    const user = userEvent.setup();
    window.history.pushState(null, '', '/nowhere');
    render(
      <RouterProvider>
        <NotFoundPage />
      </RouterProvider>,
    );
    await user.click(screen.getByRole('button', { name: /return home/i }));
    expect(window.location.pathname).toBe('/');
  });
});
