import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { useSaved } from '../context/SavedContext';
import { ListingCard } from '../components/ListingCard';
import { DataNote, ErrorState, HeartIcon, PropertyMark, Spinner } from '../components/ui';
import { inr, inrExact, sqft, titleCase, bhkLabel, postedOn } from '../lib/format';

const Row = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
    <dt className="text-sm text-ink-muted">{label}</dt>
    <dd className="text-right text-sm font-medium text-ink">{value ?? '--'}</dd>
  </div>
);

export default function ListingDetail({ kind = 'listing' }) {
  const { id } = useParams();
  const { isSaved, toggle } = useSaved();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    window.scrollTo(0, 0);
    const path = kind === 'rental' ? `/rentals/${encodeURIComponent(id)}` : `/listings/${encodeURIComponent(id)}`;
    api.request(path).then(setData).catch((e) => setError(e.message));
  }, [id, kind]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <div className="flex min-h-[50vh] items-center justify-center text-ink-soft"><Spinner className="h-6 w-6" /></div>;

  const record = kind === 'rental' ? data.rental : data.listing;
  const saved = isSaved(record.listing_id);
  const isRental = kind === 'rental';
  // Deposits below a plausible rupee figure are quoted in lakhs upstream.
  const depositLooksRescaled = isRental && record.deposit > 0 && record.deposit / record.price < 0.5;

  return (
    <div className="space-y-6">
      <nav className="text-xs text-ink-soft">
        <Link to={isRental ? '/rentals' : '/listings'} className="hover:text-ink">{isRental ? 'Rent' : 'Buy'}</Link>
        <span className="mx-1">/</span>
        <span>{titleCase(record.locality)}</span>
        <span className="mx-1">/</span>
        <span className="font-mono">{record.listing_id}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <PropertyMark name={record.apartment_name} seed={record.listing_id} className="h-48 w-full rounded-card" />

          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h1 className="font-display text-3xl text-ink">
                {isRental ? inrExact(record.price) : inr(record.price)}
                {isRental && <span className="text-lg font-normal text-ink-muted">/month</span>}
              </h1>
              {record.price_per_sqft && (
                <span className="font-mono text-sm text-ink-muted">₹{record.price_per_sqft.toLocaleString('en-IN')} per sq ft</span>
              )}
            </div>
            <p className="mt-1 text-lg text-ink">{record.apartment_name}</p>
            <p className="text-ink-muted">{titleCase(record.locality)}, Pune</p>
            <DataNote listing={record} />
          </div>

          {record.description && (
            <section>
              <h2 className="font-display text-lg text-ink">Description</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{record.description}</p>
              <p className="mt-2 text-xs text-ink-soft">Written by the seller and shown as submitted.</p>
            </section>
          )}

          <section>
            <h2 className="font-display text-lg text-ink">Specification</h2>
            <dl className="mt-2 grid gap-x-8 sm:grid-cols-2">
              <Row label="Configuration" value={bhkLabel(record.bedroom, record.property_type)} />
              <Row label="Property type" value={titleCase(record.property_type)} />
              <Row label="Carpet area" value={sqft(record.carpet_area)} />
              <Row label="Built-up area" value={sqft(record.super_built_up_area ?? record.super_builtup_area)} />
              <Row label="Bathrooms" value={record.bathroom} />
              <Row label="Balconies" value={record.balcony ?? '--'} />
              <Row label="Floor" value={`${record.floor} of ${record.total_floors}`} />
              <Row label="Facing" value={titleCase(record.facing_direction)} />
              <Row label="Furnishing" value={titleCase(record.furnishing)} />
              <Row label="Parking" value={record.covered_parking ?? '--'} />
              {isRental && <Row label="Deposit" value={depositLooksRescaled ? `${record.deposit} lakh (as reported)` : inrExact(record.deposit)} />}
              {isRental && <Row label="Maintenance" value={inrExact(record.maintenance)} />}
              <Row label="Posted" value={postedOn(record.posted_at)} />
              <Row label="Source" value={titleCase(record.website)} />
            </dl>
            {record.area_unit_corrected && (
              <p className="mt-2 rounded-card border border-flag-500/30 bg-flag-50 px-3 py-2 text-xs text-flag-500">
                The API reported this area as {record.raw_carpet_area} — in square metres, not the square feet it
                documents. The figures above are converted.
              </p>
            )}
          </section>

          {data.similar?.length > 0 && (
            <section>
              <h2 className="font-display text-lg text-ink">Comparable homes nearby</h2>
              <p className="text-xs text-ink-soft">
                Same locality and configuration, within 15% on price — computed here, because the documented
                /similar endpoint does not exist.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.similar.map((l) => <ListingCard key={l.listing_id} listing={l} />)}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="card p-4">
            <p className="text-[11px] uppercase tracking-wide text-ink-soft">Listed by</p>
            <p className="mt-1 font-medium text-ink">{record.posted_by_name}</p>
            <p className="text-sm text-ink-muted">{titleCase(record.posted_by)}</p>
            <p className="mt-2 font-mono text-sm text-ink">{record.posted_by_contact}</p>
            {record.is_suspected_fake && (
              <p className="mt-3 rounded-card border border-clay-500/30 bg-clay-50 px-3 py-2 text-xs text-clay-600">
                This number posts around thirty listings, all priced far below the market for their area. We think it
                exists to harvest enquiries rather than to sell these homes.
              </p>
            )}
            <button
              type="button"
              onClick={() => toggle(record.listing_id, kind)}
              className={`mt-4 w-full ${saved ? 'btn-ghost text-clay-600' : 'btn-primary'}`}
            >
              <HeartIcon filled={saved} />
              {saved ? 'Saved' : 'Save this listing'}
            </button>
            <a href={record.listing_url} target="_blank" rel="noreferrer" className="btn-ghost mt-2 w-full">
              View on {titleCase(record.website)}
            </a>
          </div>

          {data.project && (
            <div className="card p-4">
              <p className="text-[11px] uppercase tracking-wide text-ink-soft">Part of</p>
              <Link to={`/projects/${data.project.project_id}`} className="mt-1 block font-medium text-moss-700 hover:underline">
                {data.project.apartment_name}
              </Link>
              <p className="text-sm text-ink-muted">{data.project.developer_name}</p>
              <p className="mt-2 text-sm text-ink">
                {inr(data.project.price_min_inr)} – {inr(data.project.price_max_inr)}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
