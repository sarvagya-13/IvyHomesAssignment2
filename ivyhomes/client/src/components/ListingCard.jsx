import { memo } from 'react';
import { Link } from 'react-router-dom';
import { useSaved } from '../context/SavedContext';
import { inr, inrExact, sqft, titleCase, bhkLabel, relativeDays } from '../lib/format';
import { HeartIcon, PropertyMark, DataNote } from './ui';

function SaveButton({ id, kind }) {
  const { isSaved, toggle } = useSaved();
  const saved = isSaved(id);
  return (
    <button
      type="button"
      aria-label={saved ? 'Remove from saved' : 'Save this listing'}
      aria-pressed={saved}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(id, kind); }}
      className={`absolute right-2 top-2 rounded-full border p-1.5 backdrop-blur transition-colors ${
        saved ? 'border-clay-500/40 bg-white/95 text-clay-500' : 'border-white/40 bg-black/25 text-white hover:bg-black/40'
      }`}
    >
      <HeartIcon filled={saved} />
    </button>
  );
}

export const ListingCard = memo(function ListingCard({ listing, kind = 'listing' }) {
  const isRental = kind === 'rental';
  const href = isRental ? `/rentals/${encodeURIComponent(listing.listing_id)}` : `/listings/${encodeURIComponent(listing.listing_id)}`;
  const area = listing.carpet_area;

  return (
    <article className="card group overflow-hidden transition-shadow hover:shadow-lift">
      <Link to={href} className="block">
        <div className="relative">
          <PropertyMark name={listing.apartment_name} seed={listing.listing_id} className="h-32 w-full" />
          <SaveButton id={listing.listing_id} kind={kind} />
          <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            {titleCase(listing.website)}
          </span>
        </div>

        <div className="p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-display text-lg leading-tight text-ink">
              {isRental ? `${inrExact(listing.price)}` : inr(listing.price)}
              {isRental && <span className="text-sm font-normal text-ink-muted">/mo</span>}
            </p>
            {listing.price_per_sqft ? (
              <span className="shrink-0 font-mono text-[11px] text-ink-soft">₹{listing.price_per_sqft.toLocaleString('en-IN')}/sqft</span>
            ) : null}
          </div>

          <h3 className="mt-1 truncate text-sm font-medium text-ink" title={listing.apartment_name}>
            {listing.apartment_name}
          </h3>
          <p className="truncate text-sm text-ink-muted">{titleCase(listing.locality)}</p>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
            <span>{bhkLabel(listing.bedroom, listing.property_type)}</span>
            <span aria-hidden="true" className="text-line-strong">·</span>
            <span>{sqft(area)}</span>
            <span aria-hidden="true" className="text-line-strong">·</span>
            <span>{titleCase(listing.furnishing)}</span>
          </div>

          <DataNote listing={listing} />

          <p className="mt-3 border-t border-line pt-2 text-[11px] text-ink-soft">
            {titleCase(listing.posted_by)} · {relativeDays(listing.posted_at)}
          </p>
        </div>
      </Link>
    </article>
  );
});
