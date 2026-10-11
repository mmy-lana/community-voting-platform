import { Button } from '../components/Button';
import { useRouter } from './router';

/** Route-level fallback for unknown paths. */
export function NotFoundPage() {
  const { navigate } = useRouter();
  return (
    <section className="text-center py-12 space-y-4" aria-labelledby="notfound-title">
      <h2 id="notfound-title" className="text-3xl font-bold">404 - Page Not Found</h2>
      <p className="text-slate-600">The requested route does not exist.</p>
      <Button variant="primary" onClick={() => navigate('/')}>
        Return Home
      </Button>
    </section>
  );
}
