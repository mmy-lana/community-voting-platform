import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { apiClient } from './lib/apiClient';
import { RouterProvider, useRouter } from './app/router';
import { ComponentShowcasePage } from './features/components/ComponentShowcasePage';

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
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Open Community Polls</h2>
        <p className="text-gray-600">Select a poll to cast your vote or view current tallies.</p>
        <div className="p-6 border border-border rounded-xl bg-white shadow-sm">
          <HealthCheck />
        </div>
      </section>
    );
  }

  if (path.startsWith('/polls/') && path.endsWith('/results')) {
    const pollId = path.split('/')[2];
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Results for Poll #{pollId}</h2>
        <div className="p-6 border border-border rounded-xl bg-white shadow-sm">
          <p className="text-sm font-medium text-gray-500">Live tally bar charts view shell.</p>
        </div>
      </section>
    );
  }

  if (path.startsWith('/polls/')) {
    const pollId = path.split('/')[2];
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Cast Vote - Poll #{pollId}</h2>
        <div className="p-6 border border-border rounded-xl bg-white shadow-sm">
          <p className="text-sm font-medium text-gray-500">VoteCard component shell.</p>
        </div>
      </section>
    );
  }

  if (path === '/components') {
    return <ComponentShowcasePage />;
  }

  if (path === '/moderation') {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Staff Moderation Console</h2>
        <div className="p-6 border border-border rounded-xl bg-white shadow-sm">
          <p className="text-sm font-medium text-gray-500">Audit logs and poll controls shell.</p>
        </div>
      </section>
    );
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
    </QueryClientProvider>
  );
}
