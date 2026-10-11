import { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { apiClient } from './lib/apiClient';
import { RouterProvider, useRouter } from './app/router';
import { ToastProvider } from './components/Toast';
import { Spinner } from './components/Spinner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotFoundPage } from './app/NotFoundPage';

// Feature chunks are code-split per route; the shell stays in the entry bundle.
const PollListPage = lazy(() =>
  import('./features/polls/PollListPage').then((m) => ({ default: m.PollListPage })),
);
const PollDetailPage = lazy(() =>
  import('./features/polls/PollDetailPage').then((m) => ({ default: m.PollDetailPage })),
);
const ResultsPage = lazy(() =>
  import('./features/results/ResultsPage').then((m) => ({ default: m.ResultsPage })),
);
const ModerationPage = lazy(() =>
  import('./features/moderation/ModerationPage').then((m) => ({ default: m.ModerationPage })),
);
const ComponentShowcasePage = lazy(() =>
  import('./features/components/ComponentShowcasePage').then((m) => ({
    default: m.ComponentShowcasePage,
  })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: 1,
    },
  },
});

function HealthCheck() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.get<{ status: string; service: string }>('/polls/health/'),
  });

  if (isLoading) return <p className="text-sm text-gray-500">Checking API health…</p>;
  if (isError) return <p className="text-sm text-red-600">API health check failed.</p>;
  return (
    <p className="text-sm font-medium text-emerald-700" data-testid="api-health">
      API healthy: {data?.service} ({data?.status})
    </p>
  );
}

function RouteView() {
  const { path } = useRouter();

  // `/polls/:id/results` must be matched before `/polls/:id`.
  const resultsMatch = path.match(/^\/polls\/(\d+)\/results$/);
  if (resultsMatch) {
    return <ResultsPage pollId={Number(resultsMatch[1])} />;
  }

  const pollDetailMatch = path.match(/^\/polls\/(\d+)$/);
  if (pollDetailMatch) {
    return <PollDetailPage pollId={Number(pollDetailMatch[1])} />;
  }

  if (path === '/') {
    return (
      <div className="space-y-6">
        <div className="p-4 border border-border rounded-xl bg-white shadow-sm">
          <HealthCheck />
        </div>
        <PollListPage />
      </div>
    );
  }

  if (path === '/components') {
    return <ComponentShowcasePage />;
  }

  if (path === '/moderation') {
    return <ModerationPage />;
  }

  return <NotFoundPage />;
}

function SiteHeader() {
  const { path, navigate } = useRouter();

  const linkProps = (target: string) => ({
    href: target,
    'aria-current': path === target ? ('page' as const) : undefined,
    className: `text-sm p-3 min-h-[44px] min-w-[44px] inline-flex items-center border-b-2 ${
      path === target
        ? 'text-accent font-semibold border-accent'
        : 'font-medium border-transparent hover:text-accent'
    }`,
    onClick: (e: { preventDefault: () => void }) => {
      e.preventDefault();
      navigate(target);
    },
  });

  return (
    <header className="border-b border-border bg-white px-4 py-4 md:px-6 pt-[calc(1rem+env(safe-area-inset-top))] pb-4">
      <div className="mx-auto flex flex-wrap items-center justify-between gap-2 max-w-[1200px]">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
          className="text-xl font-bold tracking-tight hover:text-accent p-3 min-h-[44px] inline-flex items-center"
        >
          Community Voting Platform
        </a>
        <nav aria-label="Primary" className="flex space-x-2 md:space-x-4">
          <a {...linkProps('/')}>Polls</a>
          <a {...linkProps('/components')}>Components</a>
          <a {...linkProps('/moderation')}>Moderation</a>
        </nav>
      </div>
    </header>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider>
          <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
            <SiteHeader />
            <main className="flex-1 w-full mx-auto max-w-[1200px] px-4 py-6 md:px-6 md:py-8">
              {/* Route-level boundary catches render errors inside any lazy chunk. */}
              <ErrorBoundary>
                <Suspense fallback={<div className="flex justify-center py-12"><Spinner size={32} label="Loading…" /></div>}>
                  <RouteView />
                </Suspense>
              </ErrorBoundary>
            </main>
            <footer className="border-t border-border bg-white px-4 py-4 md:px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center text-xs text-gray-500">
              High-contrast voting platform shell. Port 5102.
            </footer>
          </div>
        </RouterProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
