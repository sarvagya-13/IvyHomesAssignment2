import { memo } from 'react';
import { titleCase, inr } from '../lib/format';

const Select = ({ label, value, onChange, options, allLabel = 'Any' }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-soft">{label}</span>
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? titleCase(String(o))}</option>
      ))}
    </select>
  </label>
);

/**
 * The filters the upstream API pretends to support. locality and bhk are the
 * only two it honours; furnishing and the price range are applied by our own
 * backend, which is why they work here at all.
 */
export const FilterBar = memo(function FilterBar({
  facets, values, onChange, onReset, priceField = 'price', variant = 'sale', sortOptions, total, loading,
}) {
  const set = (key) => (value) => onChange({ ...values, [key]: value });
  const bounds = variant === 'rent' ? facets?.rent_bounds : facets?.price_bounds;

  const priceSteps = variant === 'rent'
    ? [10000, 20000, 30000, 40000, 60000, 80000]
    : [3000000, 6000000, 10000000, 15000000, 20000000, 30000000];

  return (
    <div className="card sticky top-[57px] z-20 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="block lg:col-span-2">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-soft">Search</span>
          <input
            className="field"
            type="search"
            placeholder="Project, locality or id"
            value={values.q ?? ''}
            onChange={(e) => set('q')(e.target.value)}
          />
        </label>

        <Select
          label="Locality"
          value={values.locality ?? ''}
          onChange={set('locality')}
          options={(facets?.localities ?? []).map((l) => ({ value: l.locality, label: `${titleCase(l.locality)} (${l.count})` }))}
        />

        <Select
          label="Bedrooms"
          value={values.bedroom ?? ''}
          onChange={set('bedroom')}
          options={[1, 2, 3].map((n) => ({ value: n, label: `${n} BHK` })).concat([{ value: 4, label: '4+ BHK' }])}
        />

        <Select
          label="Furnishing"
          value={values.furnishing ?? ''}
          onChange={set('furnishing')}
          options={facets?.furnishings ?? []}
        />

        {variant === 'sale' && (
          <Select
            label="Property type"
            value={values.property_type ?? ''}
            onChange={set('property_type')}
            options={facets?.property_types ?? []}
          />
        )}

        <Select
          label="Min price"
          value={values.min_price ?? ''}
          onChange={set('min_price')}
          options={priceSteps.map((v) => ({ value: v, label: variant === 'rent' ? `₹${(v / 1000)}k` : inr(v) }))}
        />

        <Select
          label="Max price"
          value={values.max_price ?? ''}
          onChange={set('max_price')}
          options={priceSteps.map((v) => ({ value: v, label: variant === 'rent' ? `₹${(v / 1000)}k` : inr(v) }))}
        />

        <Select
          label="Sort by"
          value={values.sort_by ?? ''}
          onChange={set('sort_by')}
          options={sortOptions}
          allLabel="Newest first"
        />

        <Select
          label="Order"
          value={values.order ?? ''}
          onChange={set('order')}
          options={[{ value: 'asc', label: 'Low to high' }, { value: 'desc', label: 'High to low' }]}
          allLabel="Default"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <p className="text-sm text-ink-muted" aria-live="polite">
          {loading ? 'Searching…' : `${total.toLocaleString('en-IN')} ${total === 1 ? 'result' : 'results'}`}
          {bounds && <span className="ml-2 text-ink-soft">· {variant === 'rent' ? 'rents' : 'prices'} {inr(bounds.min)}–{inr(bounds.max)}</span>}
        </p>
        <button type="button" className="btn-ghost py-1 text-xs" onClick={onReset}>Clear filters</button>
      </div>
    </div>
  );
});
