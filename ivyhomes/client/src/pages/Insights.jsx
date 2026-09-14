import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { ErrorState, Spinner, Deferred } from '../components/ui';
import { inr, titleCase } from '../lib/format';

const Stat = ({ label, value, sub, tone = 'ink' }) => (
  <div className="card p-4">
    <p className="text-[11px] uppercase tracking-wide text-ink-soft">{label}</p>
    <p className={`mt-1 font-display text-2xl ${tone === 'clay' ? 'text-clay-600' : tone === 'moss' ? 'text-moss-700' : 'text-ink'}`}>{value}</p>
    {sub && <p className="mt-0.5 text-xs text-ink-muted">{sub}</p>}
  </div>
);

/** A horizontal bar row - deliberately plain, no chart library for six numbers. */
const Bar = ({ label, value, max, caption, tone = 'moss' }) => (
  <div className="grid grid-cols-[120px_1fr_auto] items-center gap-3 py-1.5">
    <span className="truncate text-sm text-ink-muted" title={label}>{label}</span>
    <span className="h-2 rounded-full bg-paper-sunk">
      <span
        className={`block h-2 rounded-full ${tone === 'clay' ? 'bg-clay-500' : 'bg-moss-500'}`}
        style={{ width: `${max ? Math.max((value / max) * 100, 1.5) : 0}%` }}
      />
    </span>
    <span className="w-24 text-right font-mono text-xs text-ink">{caption}</span>
  </div>
);

const Finding = ({ title, children }) => (
  <div className="border-b border-line py-3 last:border-0">
    <h3 className="text-sm font-medium text-ink">{title}</h3>
    <p className="mt-1 text-sm leading-relaxed text-ink-muted">{children}</p>
  </div>
);

export default function Insights() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { api.get('/insights').then(setData).catch((e) => setError(e.message)); }, []);

  if (error) return <ErrorState message={error} />;
  if (!data) return <div className="flex min-h-[50vh] items-center justify-center text-ink-soft"><Spinner className="h-6 w-6" /></div>;

  const { summary, data_quality: dq, posting_volume: volume, fraud, costliest_projects: costliest } = data;
  const maxLocality = Math.max(...summary.by_locality.map((l) => l.count));
  const maxWeek = Math.max(...volume.map((w) => w.count));
  const maxBhk = Math.max(...summary.by_bhk.map((b) => b.count));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl text-ink">Pune market insights</h1>
        <p className="max-w-3xl text-sm text-ink-muted">
          The documentation promised these aggregates from <code className="font-mono text-xs">/v1/analytics/summary</code>.
          That endpoint returns 404, so everything here is computed from the full dataset — and corrected first.
        </p>
      </header>

      <section>
        <h2 className="mb-3 font-display text-lg text-ink">The market</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Listings shown" value={summary.total_listings.toLocaleString('en-IN')} sub="live, genuine, possible" tone="moss" />
          <Stat label="Median price" value={inr(summary.median_price)} />
          <Stat label="Median rate" value={`₹${summary.median_price_per_sqft.toLocaleString('en-IN')}`} sub="per sq ft" />
          <Stat label="Localities" value={summary.by_locality.length} sub={`assigned: ${titleCase(data.assigned_locality)}`} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-display text-lg text-ink">Where the listings are</h2>
          <div className="mt-3">
            {summary.by_locality.map((l) => (
              <Bar key={l.locality} label={titleCase(l.locality)} value={l.count} max={maxLocality} caption={`${l.count}`} />
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-display text-lg text-ink">What it costs, by locality</h2>
          <p className="text-xs text-ink-soft">Median rate per square foot, and median rent.</p>
          <div className="mt-3 max-h-[320px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-paper-raised text-left text-[11px] uppercase tracking-wide text-ink-soft">
                <tr><th className="py-1">Locality</th><th className="py-1 text-right">₹/sqft</th><th className="py-1 text-right">Median rent</th></tr>
              </thead>
              <tbody>
                {summary.by_locality.map((l) => (
                  <tr key={l.locality} className="border-t border-line">
                    <td className="py-1.5 text-ink">{titleCase(l.locality)}</td>
                    <td className="py-1.5 text-right font-mono text-xs">{l.median_price_per_sqft.toLocaleString('en-IN')}</td>
                    <td className="py-1.5 text-right font-mono text-xs">{l.median_rent ? `₹${l.median_rent.toLocaleString('en-IN')}` : '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-display text-lg text-ink">Configuration mix</h2>
          <div className="mt-3">
            {summary.by_bhk.map((b) => (
              <Bar key={b.bedroom} label={b.bedroom === 0 ? 'Plot' : `${b.bedroom} BHK`} value={b.count} max={maxBhk} caption={`${b.count}`} />
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-display text-lg text-ink">Posting volume</h2>
          <p className="text-xs text-ink-soft">Listings posted per week, to 10 September 2026.</p>
          <div className="mt-3">
            {volume.map((w) => <Bar key={w.week_ending} label={w.week_ending} value={w.count} max={maxWeek} caption={`${w.count}`} />)}
          </div>
        </div>
      </section>

      <Deferred minHeight={320}>
        <section>
          <h2 className="mb-1 font-display text-lg text-ink">What is wrong with this data</h2>
          <p className="mb-3 max-w-3xl text-sm text-ink-muted">
            Everything below was found by testing a hypothesis against the whole dataset, not by reading one response.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Records retrieved" value={dq.records_retrieved.toLocaleString('en-IN')} sub={`the API reports ${dq.server_reported_total.toLocaleString('en-IN')}`} tone="clay" />
            <Stat label="Would be missed" value={dq.records_the_documented_recipe_would_miss} sub="by paging the documented way" tone="clay" />
            <Stat label="Not actually live" value={dq.not_live} sub="on an endpoint that promises only active" tone="clay" />
            <Stat label="Bait listings" value={dq.suspected_fake} sub={`across ${dq.fake_phone_numbers} phone numbers`} tone="clay" />
            <Stat label="Impossible records" value={dq.corrupt} sub="six classes, seven each" tone="clay" />
            <Stat label="Duplicate re-posts" value={dq.duplicate_records} sub={`${dq.unique_properties.toLocaleString('en-IN')} distinct properties`} tone="clay" />
            <Stat label="Areas in m², not sq ft" value={dq.area_unit_corrected} sub="converted here" tone="clay" />
            <Stat label="Projects miscounting" value={dq.projects_with_wrong_listing_count} sub="of 440" tone="clay" />
          </div>

          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <h3 className="font-display text-base text-ink">The bait ring</h3>
              <p className="mt-1 text-sm text-ink-muted">
                Seven numbers hold {dq.suspected_fake} listings between them — around thirty each, every one marked verified,
                every one priced at roughly half the going rate.
              </p>
              <div className="mt-3 space-y-1">
                <Bar label="Ring median" value={fraud.ring_median_price_per_sqft} max={fraud.market_median_price_per_sqft} caption={`₹${fraud.ring_median_price_per_sqft.toLocaleString('en-IN')}`} tone="clay" />
                <Bar label="Market median" value={fraud.market_median_price_per_sqft} max={fraud.market_median_price_per_sqft} caption={`₹${fraud.market_median_price_per_sqft.toLocaleString('en-IN')}`} />
                <Bar label="Busiest agent" value={fraud.busiest_honest_agent.median_price_per_sqft} max={fraud.market_median_price_per_sqft} caption={`₹${fraud.busiest_honest_agent.median_price_per_sqft.toLocaleString('en-IN')}`} />
              </div>
              <p className="mt-3 rounded-card bg-paper-sunk px-3 py-2 text-xs text-ink-muted">
                Volume alone would have been the wrong rule. The single busiest number,{' '}
                <span className="font-mono">{fraud.busiest_honest_agent.phone}</span> with {fraud.busiest_honest_agent.count} listings,
                prices at the market and is a genuine agent. The ring sits just below it on volume and far below on price.
              </p>
            </div>

            <div className="card p-5">
              <h3 className="font-display text-base text-ink">What the corrections change</h3>
              <p className="mt-1 text-sm text-ink-muted">
                Taking the API at its word puts the average rate here:
              </p>
              <div className="mt-3 space-y-1">
                <Bar label="Uncorrected" value={dq.naive_mean_price_per_sqft} max={dq.naive_mean_price_per_sqft} caption={`₹${dq.naive_mean_price_per_sqft.toLocaleString('en-IN')}`} tone="clay" />
                <Bar label="Corrected" value={dq.corrected_mean_price_per_sqft} max={dq.naive_mean_price_per_sqft} caption={`₹${dq.corrected_mean_price_per_sqft.toLocaleString('en-IN')}`} />
              </div>
              <div className="mt-3">
                {dq.corruption_breakdown.map((c) => (
                  <Bar key={c.flag} label={titleCase(c.flag.replace(/_/g, ' '))} value={c.count} max={7} caption={`${c.count}`} tone="clay" />
                ))}
              </div>
            </div>
          </div>

          <div className="card mt-4 p-5">
            <h3 className="font-display text-base text-ink">How each of these was found</h3>
            <Finding title="The collection is bigger than the API says it is">
              <code className="font-mono text-xs">total</code> reports 3,661 listings. Advancing by <code className="font-mono text-xs">offset</code>{' '}
              until the server stops producing new records yields 3,800 — and <code className="font-mono text-xs">has_more</code> stays
              true past the reported total. The documented recipe of dividing <code className="font-mono text-xs">total</code> by your
              limit drops {dq.records_the_documented_recipe_would_miss} listings. The documented{' '}
              <code className="font-mono text-xs">page</code> parameter never advances at all.
            </Finding>
            <Finding title="Some areas are in square metres">
              Price divided by carpet area is tight up to the 92nd percentile, then jumps by an order of magnitude with
              nothing in between. Every record above the jump has a carpet area under 217. Multiplying those by 10.7639
              drops them exactly onto the main distribution, and the carpet-to-built-up ratio stays at the usual 0.74,
              so both area fields were converted together.
            </Finding>
            <Finding title="Project prices are in two different units">
              Read as rupees, the minimum price exceeds the maximum for 321 of 440 projects, which cannot be. The
              minimum is in lakhs and the maximum in crores; scaling by 10⁵ and 10⁷ restores the ordering everywhere and
              reconciles project rates with listing rates.
            </Finding>
            <Finding title="Forty-two records describe something impossible">
              Six independent physical invariants each fail on exactly seven records, with no overlap: negative price,
              carpet area above built-up area, a floor above the building's height, a posting date in the future,
              coordinates outside Pune, and a non-plot home with no bedrooms. Equal groups of seven is not what natural
              data corruption looks like.
            </Finding>
            <Finding title="Projects miscount their own listings">
              <code className="font-mono text-xs">total_listings</code> matches the live listing count for 345 projects but
              the all-records count for only 123 — so it is meant to track live listings, and the{' '}
              {dq.projects_with_wrong_listing_count} that still disagree are genuinely stale. The documentation says
              you can verify this with <code className="font-mono text-xs">/v1/listings?project_id=</code>, but that
              parameter is ignored.
            </Finding>
          </div>
        </section>
      </Deferred>

      <section className="card p-5">
        <h2 className="font-display text-lg text-ink">Most expensive projects</h2>
        <p className="text-xs text-ink-soft">After converting the maximum price out of crores.</p>
        <div className="mt-3 divide-y divide-line">
          {costliest.map((p) => (
            <Link key={p.project_id} to={`/projects/${p.project_id}`} className="flex items-baseline justify-between gap-4 py-2 hover:text-moss-700">
              <span className="truncate text-sm">{p.apartment_name} <span className="text-ink-soft">· {titleCase(p.locality)}</span></span>
              <span className="shrink-0 font-mono text-xs">{inr(p.price_max_inr)}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
