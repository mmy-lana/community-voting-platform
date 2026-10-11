import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { apiClient } from './lib/apiClient';
import { RouterProvider, useRouter } from './app/router';
import { ToastProvider } from './components/Toast';
import { PollListPage } from './features/polls/PollListPage';
import { PollDetailPage } from './features/polls/PollDetailPage';
import { ComponentShowcasePage } from './features/components/ComponentShowcasePage';
import { ResultsPage } from './features/results/ResultsPage';
import { ModerationPage } from './features/moderation/ModerationPage';

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
  const { path, navigate } = useRouter();

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

  const pollDetailMatch = path.match(/^\/polls\/(\d+)\/?$/);
  if (pollDetailMatch) {
    return <PollDetailPage pollId={Number(pollDetailMatch[1])} />;
  }

  const resultsMatch = path.match(/^\/polls\/(\d+)\/results\/?$/);
  if (resultsMatch) {
    return <ResultsPage pollId={Number(resultsMatch[1])} />;
  }

  if (path === '/components') {
    return <ComponentShowcasePage />;
  }

  if (path === '/moderation') {
    return <ModerationPage />;
  }

  return (
    <section className="text-center py-12 space-y-4">
      <h2 className="text-3xl font-bold">404 - Page Not Found</h2>
      <p className="text-gray-600">The requested route does not exist.</p>
      <button
        onClick={() => navigate('/')}
        className="px-4 py-2 bg-accent text-white font-medium rounded-lg hover:bg-accent-strong transition-colors min-h-[44px] min-w-[44px]"
      >
        Return Home
      </button>
    </section>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider>
          <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
            <header className="border-b border-border bg-white px-6 py-4">
              <div className="max-w-6xl mx-auto flex items-center justify-between">
                <h1 className="text-xl font-bold tracking-tight">Community Voting Platform</h1>
                <nav className="flex space-x-4">
                  <a href="/" className="text-sm font-medium hover:text-accent p-3 min-h-[44px] min-w-[44px] inline-flex items-center">Polls</a>
                  <a href="/components" className="text-sm font-medium hover:text-accent p-3 min-h-[44px] min-w-[44px] inline-flex items-center">Components</a>
                  <a href="/moderation" className="text-sm font-medium hover:text-accent p-3 min-h-[44px] min-w-[44px] inline-flex items-center">Moderation</a>
                </nav>
              </div>
            </header>
            <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
              <RouteView />
            </main>
            <footer className="border-t border-border bg-white px-6 py-4 text-center text-xs text-gray-500">
              High-contrast voting platform shell. Port 5102.
            </footer>
          </div>
        </RouterProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
