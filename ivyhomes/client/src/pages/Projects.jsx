import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCollection, useInfiniteScroll } from '../hooks/useCollection';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { api } from '../lib/apiClient';
import { CardSkeleton, EmptyState, ErrorState, Spinner, PropertyMark } from '../components/ui';
import { inr, titleCase } from '../lib/format';

const FILTER_KEYS = ['q', 'locality', 'project_status', 'sort_by', 'order'];

function ProjectCard({ project }) {
  return (
    <Link to={`/projects/${project.project_id}`} className="card group overflow-hidden transition-shadow hover:shadow-lift">
      <PropertyMark name={project.apartment_name} seed={project.project_id} className="h-28 w-full" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-display text-base text-ink" title={project.apartment_name}>{project.apartment_name}</h3>
          <span className="chip shrink-0">{titleCase(project.project_status)}</span>
        </div>
        <p className="text-sm text-ink-muted">{project.developer_name} · {titleCase(project.locality)}</p>
        <p className="mt-2 text-sm font-medium text-ink">{inr(project.price_min_inr)} – {inr(project.price_max_inr)}</p>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-2 text-xs text-ink-muted">
          <span>{project.total_units} units</span>
          <span className="text-line-strong">·</span>
          <span>{project.total_towers} towers</span>
          <span className="text-line-strong">·</span>
          <span>{project.min_area_sqft}–{project.max_area_sqft} sq ft</span>
        </div>
        {project.listing_count_mismatch && (
          <p className="mt-2 text-[11px] text-flag-500">
            Reports {project.total_listings} listings; {project.actual_live_listings} are actually live.
          </p>
        )}
      </div>
    </Link>
  );
}

export default function Projects() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [facets, setFacets] = useState(null);
  const values = useMemo(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, searchParams.get(k) ?? ''])), [searchParams]);
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
  const { items, meta, loading, loadingMore, error, loadMore } = useCollection('/projects', query);
  const sentinel = useInfiniteScroll(loadMore, meta.has_more && !loading);

  const update = useCallback((key, v) => {
    const params = new URLSearchParams(searchParams);
    v ? params.set(key, v) : params.delete(key);
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl text-ink">Builder projects in Pune</h1>
        <p className="text-sm text-ink-muted">
          Prices here are corrected: the API reports the minimum in lakhs and the maximum in crores, though it
          documents both as rupees.
        </p>
      </header>

      <div className="card sticky top-[57px] z-20 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block lg:col-span-2">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-soft">Search</span>
          <input className="field" type="search" placeholder="Project or developer" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-soft">Locality</span>
          <select className="field" value={values.locality} onChange={(e) => update('locality', e.target.value)}>
            <option value="">Any</option>
            {(facets?.localities ?? []).map((l) => <option key={l.locality} value={l.locality}>{titleCase(l.locality)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-soft">Status</span>
          <select className="field" value={values.project_status} onChange={(e) => update('project_status', e.target.value)}>
            <option value="">Any</option>
            {(facets?.project_statuses ?? []).map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-soft">Sort by</span>
          <select className="field" value={values.sort_by} onChange={(e) => update('sort_by', e.target.value)}>
            <option value="price_max_inr">Top price</option>
            <option value="price_min_inr">Entry price</option>
            <option value="launch_date">Launch date</option>
            <option value="total_units">Units</option>
          </select>
        </label>
        <p className="text-sm text-ink-muted sm:col-span-2 lg:col-span-5" aria-live="polite">
          {loading ? 'Searching…' : `${meta.total} projects`}
        </p>
      </div>

      {error && <ErrorState message={error} />}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)}</div>
      ) : items.length === 0 ? (
        <EmptyState title="No projects match" hint="Try clearing the status filter." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => <ProjectCard key={p.project_id} project={p} />)}
          </div>
          <div ref={sentinel} className="flex justify-center py-6 text-sm text-ink-soft">
            {loadingMore && <Spinner className="h-5 w-5" />}
            {!meta.has_more && items.length > 0 && <span>All {meta.total} projects shown.</span>}
          </div>
        </>
      )}
    </div>
  );
}
