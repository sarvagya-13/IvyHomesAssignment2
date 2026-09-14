import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { ListingCard } from '../components/ListingCard';
import { ErrorState, PropertyMark, Spinner } from '../components/ui';
import { inr, titleCase, postedOn } from '../lib/format';

const Row = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
    <dt className="text-sm text-ink-muted">{label}</dt>
    <dd className="text-right text-sm font-medium text-ink">{value ?? '--'}</dd>
  </div>
);

export default function ProjectDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null); setError(null); window.scrollTo(0, 0);
    api.request(`/projects/${encodeURIComponent(id)}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <div className="flex min-h-[50vh] items-center justify-center text-ink-soft"><Spinner className="h-6 w-6" /></div>;

  const { project, listings } = data;

  return (
    <div className="space-y-6">
      <nav className="text-xs text-ink-soft">
        <Link to="/projects" className="hover:text-ink">Projects</Link>
        <span className="mx-1">/</span>
        <span className="font-mono">{project.project_id}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <PropertyMark name={project.apartment_name} seed={project.project_id} className="h-44 w-full rounded-card" />
          <div>
            <h1 className="font-display text-3xl text-ink">{project.apartment_name}</h1>
            <p className="text-ink-muted">{project.developer_name} · {titleCase(project.locality)}, Pune</p>
            <p className="mt-2 font-display text-xl text-ink">{inr(project.price_min_inr)} – {inr(project.price_max_inr)}</p>
            <p className="text-xs text-ink-soft">
              Converted from the API values of {project.price_min} (lakhs) and {project.price_max} (crores).
            </p>
          </div>

          <section>
            <h2 className="font-display text-lg text-ink">Project details</h2>
            <dl className="mt-2 grid gap-x-8 sm:grid-cols-2">
              <Row label="Status" value={titleCase(project.project_status)} />
              <Row label="Launch" value={postedOn(project.launch_date)} />
              <Row label="Possession" value={postedOn(project.possession_date)} />
              <Row label="Units" value={project.total_units} />
              <Row label="Towers" value={project.total_towers} />
              <Row label="Floors" value={project.total_floors} />
              <Row label="Area range" value={`${project.min_area_sqft}–${project.max_area_sqft} sq ft`} />
              <Row label="RERA" value={<span className="font-mono text-xs">{project.rera_number}</span>} />
            </dl>
          </section>

          {project.amenities?.length > 0 && (
            <section>
              <h2 className="font-display text-lg text-ink">Amenities</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {project.amenities.map((a) => <span key={a} className="chip">{titleCase(a)}</span>)}
              </div>
            </section>
          )}

          <section>
            <h2 className="font-display text-lg text-ink">Available in this project</h2>
            {listings.length === 0 ? (
              <p className="mt-1 text-sm text-ink-muted">No live listings in this project right now.</p>
            ) : (
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {listings.map((l) => <ListingCard key={l.listing_id} listing={l} />)}
              </div>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="card p-4">
            <p className="text-[11px] uppercase tracking-wide text-ink-soft">Listing count</p>
            <p className="mt-1 font-display text-2xl text-ink">{project.actual_live_listings}</p>
            <p className="text-sm text-ink-muted">live listings found</p>
            {project.listing_count_mismatch ? (
              <p className="mt-3 rounded-card border border-flag-500/30 bg-flag-50 px-3 py-2 text-xs text-flag-500">
                The API reports <strong>{project.total_listings}</strong> for this project. The documentation says that
                number is recomputed on every change, but it disagrees with the listings we can retrieve.
              </p>
            ) : (
              <p className="mt-3 text-xs text-ink-soft">Matches the {project.total_listings} the API reports.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
