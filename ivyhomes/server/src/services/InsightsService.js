import { datasetService } from './DatasetService.js';

const REFERENCE = Date.parse('2026-09-10T00:00:00+05:30');

const median = (values) => {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

/**
 * Everything /v1/analytics/summary promised (it 404s), plus the things we
 * learned about this dataset that a buyer would actually want to be told.
 */
export class InsightsService {
  #cache = null;

  build() {
    if (this.#cache) return this.#cache;

    const all = datasetService.listings;
    const clean = datasetService.trustworthyListings;
    const projects = datasetService.projects;
    const rentals = datasetService.rentals;
    const meta = datasetService.meta;

    const prices = clean.map((l) => l.price);
    const ppsf = clean.map((l) => l.price_per_sqft).filter(Boolean);

    const byLocality = new Map();
    for (const l of clean) {
      if (!byLocality.has(l.locality)) byLocality.set(l.locality, []);
      byLocality.get(l.locality).push(l);
    }
    const rentByLocality = new Map();
    for (const r of rentals) {
      if (!rentByLocality.has(r.locality)) rentByLocality.set(r.locality, []);
      rentByLocality.get(r.locality).push(r);
    }

    const byBhk = new Map();
    for (const l of clean) byBhk.set(l.bedroom, (byBhk.get(l.bedroom) ?? 0) + 1);

    // The summary the docs promised, rebuilt from the corrected snapshot.
    const summary = {
      city: meta.city,
      total_listings: clean.length,
      median_price: median(prices),
      median_price_per_sqft: median(ppsf),
      by_locality: [...byLocality.entries()]
        .map(([locality, rows]) => ({
          locality,
          count: rows.length,
          median_price: median(rows.map((r) => r.price)),
          median_price_per_sqft: median(rows.map((r) => r.price_per_sqft).filter(Boolean)),
          median_rent: median((rentByLocality.get(locality) ?? []).map((r) => r.price)),
          rental_count: (rentByLocality.get(locality) ?? []).length,
        }))
        .sort((a, b) => b.count - a.count),
      by_bhk: [...byBhk.entries()].map(([bedroom, count]) => ({ bedroom, count })).sort((a, b) => a.bedroom - b.bedroom),
    };

    // What we found wrong, expressed so a human can see why it matters.
    const corrupt = all.filter((l) => l.is_corrupt);
    const fake = all.filter((l) => l.is_suspected_fake);
    const metricArea = all.filter((l) => l.area_unit_corrected);
    const notLive = all.filter((l) => !l.is_live);
    const dupKeys = new Map();
    for (const l of all) dupKeys.set(l.duplicate_key, (dupKeys.get(l.duplicate_key) ?? 0) + 1);
    const duplicateExtras = all.length - dupKeys.size;
    const mismatchedProjects = projects.filter((p) => p.listing_count_mismatch);

    const corruptionBreakdown = new Map();
    for (const l of corrupt) for (const flag of l.quality_flags) corruptionBreakdown.set(flag, (corruptionBreakdown.get(flag) ?? 0) + 1);

    const naiveMeanPpsf = all.filter((l) => l.price > 0 && l.raw_carpet_area)
      .reduce((s, l, _, arr) => s + (l.price / l.raw_carpet_area) / arr.length, 0);
    const correctedMeanPpsf = clean.reduce((s, l, _, arr) => s + l.price_per_sqft / arr.length, 0);

    const dataQuality = {
      records_retrieved: all.length,
      server_reported_total: 3661,
      records_the_documented_recipe_would_miss: all.length - 3661,
      not_live: notLive.length,
      corrupt: corrupt.length,
      corruption_breakdown: [...corruptionBreakdown.entries()].map(([flag, count]) => ({ flag, count })).sort((a, b) => b.count - a.count),
      suspected_fake: fake.length,
      fake_phone_numbers: meta.fake_phones?.length ?? 0,
      duplicate_records: duplicateExtras,
      unique_properties: dupKeys.size,
      area_unit_corrected: metricArea.length,
      projects_with_wrong_listing_count: mismatchedProjects.length,
      trustworthy: clean.length,
      naive_mean_price_per_sqft: Math.round(naiveMeanPpsf),
      corrected_mean_price_per_sqft: Math.round(correctedMeanPpsf),
      market_median_price_per_sqft: meta.market_median_ppsf,
    };

    // Posting volume for the eight weeks up to the reference moment.
    const weeks = [];
    for (let i = 7; i >= 0; i -= 1) {
      const end = REFERENCE - i * 7 * 864e5;
      const start = end - 7 * 864e5;
      weeks.push({
        week_ending: new Date(end).toISOString().slice(0, 10),
        count: all.filter((l) => { const t = Date.parse(l.posted_at); return t >= start && t < end; }).length,
      });
    }

    const fakeVsMarket = {
      ring_median_price_per_sqft: median(fake.map((l) => l.price_per_sqft).filter(Boolean)),
      market_median_price_per_sqft: meta.market_median_ppsf,
      busiest_honest_agent: (() => {
        const counts = new Map();
        for (const l of all) counts.set(l.posted_by_contact, (counts.get(l.posted_by_contact) ?? 0) + 1);
        const [phone, count] = [...counts.entries()]
          .filter(([p]) => !(meta.fake_phones ?? []).includes(p))
          .sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
        const rows = all.filter((l) => l.posted_by_contact === phone);
        return { phone, count, median_price_per_sqft: median(rows.map((l) => l.price_per_sqft).filter(Boolean)) };
      })(),
    };

    this.#cache = {
      generated_at: meta.generated_at,
      assigned_locality: meta.assigned_locality,
      summary,
      data_quality: dataQuality,
      posting_volume: weeks,
      fraud: fakeVsMarket,
      costliest_projects: projects.slice().sort((a, b) => b.price_max_inr - a.price_max_inr).slice(0, 5)
        .map((p) => ({ project_id: p.project_id, apartment_name: p.apartment_name, developer_name: p.developer_name, locality: p.locality, price_max_inr: p.price_max_inr, price_min_inr: p.price_min_inr })),
    };
    return this.#cache;
  }
}

export const insightsService = new InsightsService();
