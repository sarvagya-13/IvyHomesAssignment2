import { useEffect, useRef, useState } from 'react';

export const Spinner = ({ className = 'h-4 w-4' }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
    <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const HeartIcon = ({ filled }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M12 20.5 4.2 12.9a4.8 4.8 0 0 1 6.8-6.8l1 1 1-1a4.8 4.8 0 1 1 6.8 6.8Z" strokeLinejoin="round" />
  </svg>
);

/** Every listing gets a stable, quiet monogram - the dataset ships no photos. */
export function PropertyMark({ name = '', seed = '', className = '' }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'IV';
  const hue = [...String(seed)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <div
      className={`flex items-center justify-center font-display text-2xl tracking-wide text-white/90 ${className}`}
      style={{ background: `linear-gradient(140deg, hsl(${hue} 18% 38%), hsl(${(hue + 40) % 360} 16% 26%))` }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

/** Defers rendering of heavy children until they are near the viewport. */
export function Deferred({ children, minHeight = 180 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || shown) return undefined;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) setShown(true); }, { rootMargin: '300px' });
    io.observe(node);
    return () => io.disconnect();
  }, [shown]);
  return <div ref={ref} style={shown ? undefined : { minHeight }}>{shown ? children : null}</div>;
}

export const CardSkeleton = () => (
  <div className="card overflow-hidden">
    <div className="shimmer h-36 w-full" />
    <div className="space-y-2 p-4">
      <div className="shimmer h-4 w-2/3 rounded" />
      <div className="shimmer h-3 w-1/3 rounded" />
      <div className="shimmer h-3 w-1/2 rounded" />
    </div>
  </div>
);

export const EmptyState = ({ title, hint, action }) => (
  <div className="card flex flex-col items-center gap-2 px-6 py-16 text-center">
    <h3 className="font-display text-lg text-ink">{title}</h3>
    {hint && <p className="max-w-md text-sm text-ink-muted">{hint}</p>}
    {action}
  </div>
);

export const ErrorState = ({ message, onRetry }) => (
  <div className="card border-clay-500/30 bg-clay-50 px-6 py-10 text-center">
    <p className="text-sm text-clay-600">{message}</p>
    {onRetry && <button type="button" onClick={onRetry} className="btn-ghost mt-3">Try again</button>}
  </div>
);

/**
 * A short, honest note attached to a record we know something about. This is
 * where the data findings surface to an actual user.
 */
export function DataNote({ listing, compact = false }) {
  const notes = [];
  if (listing.is_suspected_fake) notes.push({ tone: 'clay', text: 'Likely bait listing' });
  if (listing.is_corrupt) notes.push({ tone: 'clay', text: 'Impossible values' });
  if (listing.area_unit_corrected) notes.push({ tone: 'flag', text: 'Area corrected from m²' });
  if (listing.is_live === false) notes.push({ tone: 'flag', text: 'No longer live' });
  if (!notes.length) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? '' : 'mt-2'}`}>
      {notes.map((n) => (
        <span
          key={n.text}
          className={`chip ${n.tone === 'clay' ? 'border-clay-500/30 bg-clay-50 text-clay-600' : 'border-flag-500/30 bg-flag-50 text-flag-500'}`}
        >
          {n.text}
        </span>
      ))}
    </div>
  );
}
