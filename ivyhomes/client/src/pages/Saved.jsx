import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { useSaved } from '../context/SavedContext';
import { useAuth } from '../context/AuthContext';
import { ListingCard } from '../components/ListingCard';
import { CardSkeleton, EmptyState, ErrorState } from '../components/ui';

export default function Saved() {
  const { ids } = useSaved();
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, results: [], error: null });

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    api.request('/saved')
      .then((d) => setState({ loading: false, results: d.results, error: null }))
      .catch((e) => setState({ loading: false, results: [], error: e.message }));
  }, []);

  // Reload when the saved set changes, so removing a card here updates the list.
  useEffect(load, [load, ids.size]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl text-ink">Saved listings</h1>
        <p className="text-sm text-ink-muted">
          Kept against {user?.email} and stored on our side, so they survive a reload and a sign-out.
        </p>
      </header>

      {state.error && <ErrorState message={state.error} onRetry={load} />}

      {state.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : state.results.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          hint="Tap the heart on any listing to keep it here."
          action={<Link to="/listings" className="btn-primary mt-3">Browse listings</Link>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {state.results.map((s) => (
            <ListingCard key={s.listing_id} listing={s.record} kind={s.kind} />
          ))}
        </div>
      )}
    </div>
  );
}
