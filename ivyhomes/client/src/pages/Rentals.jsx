import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCollection, useInfiniteScroll } from '../hooks/useCollection';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { api } from '../lib/apiClient';
import { ListingCard } from '../components/ListingCard';
import { FilterBar } from '../components/FilterBar';
import { CardSkeleton, EmptyState, ErrorState, Spinner } from '../components/ui';

const SORTS = [
  { value: 'price', label: 'Monthly rent' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'carpet_area', label: 'Carpet area' },
  { value: 'bedroom', label: 'Bedrooms' },
  { value: 'posted_at', label: 'Date posted' },
];
const FILTER_KEYS = ['q', 'locality', 'bedroom', 'furnishing', 'min_price', 'max_price', 'sort_by', 'order'];

export default function Rentals() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [facets, setFacets] = useState(null);
  const values = useMemo(
    () => Object.fromEntries(FILTER_KEYS.map((k) => [k, searchParams.get(k) ?? ''])),
    [searchParams],
  );
  const [draftQ, setDraftQ] = useState(values.q);
  const debouncedQ = useDebouncedValue(draftQ, 350);

  useEffect(() => { api.get('/facets').then(setFacets).catch(() => {}); }, []);
  useEffect(() => {
    if (debouncedQ === values.q) return;
    const next = new URLSearchParams(searchParams);
    debouncedQ ? next.set('q', debouncedQ) : next.delete('q');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const query = useMemo(() => ({ ...values, q: debouncedQ }), [values, debouncedQ]);
  const { items, meta, loading, loadingMore, error, loadMore } = useCollection('/rentals', query);
  const sentinel = useInfiniteScroll(loadMore, meta.has_more && !loading);

  const onChange = useCallback((next) => {
    if (next.q !== values.q) setDraftQ(next.q);
    const params = new URLSearchParams();
    for (const key of FILTER_KEYS) { const v = key === 'q' ? next.q : next[key]; if (v) params.set(key, v); }
    setSearchParams(params, { replace: true });
  }, [setSearchParams, values.q]);

  const onReset = useCallback(() => { setDraftQ(''); setSearchParams(new URLSearchParams(), { replace: true }); }, [setSearchParams]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl text-ink">Homes to rent in Pune</h1>
        <p className="text-sm text-ink-muted">
          Rents are the monthly figure in rupees. Deposits are shown as the API reports them, which for some records is
          a number of lakhs rather than rupees — those are flagged on the detail page.
        </p>
      </header>

      <FilterBar
        facets={facets} values={{ ...values, q: draftQ }} onChange={onChange} onReset={onReset}
        sortOptions={SORTS} total={meta.total} loading={loading} variant="rent"
      />

      {error && <ErrorState message={error} />}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : items.length === 0 && !error ? (
        <EmptyState title="No rentals match those filters" hint="Try a wider rent range." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((r) => <ListingCard key={r.listing_id} listing={r} kind="rental" />)}
          </div>
          <div ref={sentinel} className="flex justify-center py-6 text-sm text-ink-soft">
            {loadingMore && <Spinner className="h-5 w-5" />}
            {!meta.has_more && items.length > 0 && <span>All {meta.total.toLocaleString('en-IN')} rentals shown.</span>}
          </div>
        </>
      )}
    </div>
  );
}
