/**
 * Turns the raw snapshot into (a) the ten answers, (b) a normalised dataset the
 * API server serves to the frontend. Every rule here is justified in README.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const raw = (n) => JSON.parse(readFileSync(new URL(`../data/raw/${n}.json`, import.meta.url), 'utf8'));
const listings = raw('listings').records;
const rentals = raw('rentals').records;
const projects = raw('projects').records;

const SQFT_PER_SQM = 10.7639;
const REFERENCE = Date.parse('2026-09-10T00:00:00+05:30');
const WINDOW_START = REFERENCE - 7 * 864e5;
const ASSIGNED_LOCALITY = 'baner';

/** Records whose area is in square METRES betray themselves by an impossible rate per unit area. */
export const isMetricArea = (l) => l.price > 0 && l.price / l.carpet_area > 30000;
export const carpetSqft = (l) => (isMetricArea(l) ? Math.round(l.carpet_area * SQFT_PER_SQM) : l.carpet_area);
export const superSqft = (l) => (isMetricArea(l) ? Math.round(l.super_built_up_area * SQFT_PER_SQM) : l.super_built_up_area);

/* Q4: six disjoint classes of physically impossible record. */
export const CORRUPTION_RULES = {
  negative_price: (l) => l.price <= 0,
  carpet_exceeds_superbuiltup: (l) => l.carpet_area > l.super_built_up_area,
  floor_above_building: (l) => l.floor > l.total_floors,
  posted_in_the_future: (l) => Date.parse(l.posted_at) > REFERENCE,
  outside_city_bounds: (l) => !(l.latitude > 18.3 && l.latitude < 18.8 && l.longitude > 73.6 && l.longitude < 74.1),
  bedroomless_dwelling: (l) => l.bedroom === 0 && l.property_type !== 'plot',
};
export const corruptionOf = (l) => Object.keys(CORRUPTION_RULES).filter((k) => CORRUPTION_RULES[k](l));
const corrupt = listings.filter((l) => corruptionOf(l).length > 0);
const corruptIds = corrupt.map((l) => l.listing_id).sort();

/* Q9: the enquiry farm.
 * NOT "the agent with the most listings" - that rule flags the busiest honest
 * agent too. The ring is volume AND systematic underpricing AND blanket verified. */
const ppsf = (l) => l.price / carpetSqft(l);
const byPhone = new Map();
for (const l of listings) {
  if (!byPhone.has(l.posted_by_contact)) byPhone.set(l.posted_by_contact, []);
  byPhone.get(l.posted_by_contact).push(l);
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const marketMedian = median(listings.filter((l) => l.price > 0).map(ppsf));
export const fakePhones = [...byPhone.entries()]
  .filter(([, g]) => g.length >= 20
    && median(g.filter((l) => l.price > 0).map(ppsf)) < marketMedian * 0.65
    && g.every((l) => l.is_verified))
  .map(([p]) => p).sort();
const fake = listings.filter((l) => fakePhones.includes(l.posted_by_contact));
const fakeIds = fake.map((l) => l.listing_id).sort();

/* Q2: one physical property, cross-posted to several portals. */
const propertyKey = (l) => [l.apartment_name, l.locality, l.bedroom, l.latitude, l.longitude].join('|');
const uniqueProperties = new Set(listings.map(propertyKey)).size;
const groups = new Map();
for (const l of listings) { const k = propertyKey(l); groups.set(k, [...(groups.get(k) || []), l]); }
const dupGroups = [...groups.values()].filter((g) => g.length > 1);

/* Q10: total_listings is computed over LIVE listings. */
const liveByProject = new Map();
const allByProject = new Map();
for (const l of listings) {
  if (!l.project_id) continue;
  allByProject.set(l.project_id, (allByProject.get(l.project_id) || 0) + 1);
  if (l.is_live) liveByProject.set(l.project_id, (liveByProject.get(l.project_id) || 0) + 1);
}
const wrongVsLive = projects.filter((p) => p.total_listings !== (liveByProject.get(p.project_id) || 0));
const wrongVsAll = projects.filter((p) => p.total_listings !== (allByProject.get(p.project_id) || 0));

/* Q7: price_min is in LAKHS, price_max is in CRORES. */
export const projectPriceMinInr = (p) => Math.round(p.price_min * 1e5);
export const projectPriceMaxInr = (p) => Math.round(p.price_max * 1e7);
const costliest = projects.slice().sort((a, b) => b.price_max - a.price_max)[0];

const excluded = new Set([...corruptIds, ...fakeIds]);
const q6set = listings.filter((l) => l.is_live && l.bedroom === 2 && !excluded.has(l.listing_id));
const avgPpsf = q6set.reduce((s, l) => s + ppsf(l), 0) / q6set.length;
const banerRentals = rentals.filter((r) => r.locality === ASSIGNED_LOCALITY);
const last7 = listings.filter((l) => { const t = Date.parse(l.posted_at); return t >= WINDOW_START && t < REFERENCE; });

const answers = {
  total_listing_records: listings.length,
  unique_properties: uniqueProperties,
  active_listings: listings.filter((l) => l.is_live === true).length,
  corrupt_listing_ids: corruptIds,
  total_monthly_rent: banerRentals.reduce((s, r) => s + r.price, 0),
  avg_price_per_sqft_2bhk: Number(avgPpsf.toFixed(2)),
  costliest_project: { project_id: costliest.project_id, price_max_inr: projectPriceMaxInr(costliest) },
  listings_last_7_days: last7.length,
  fake_listing_ids: fakeIds,
  projects_with_wrong_listing_count: wrongVsLive.length,
};

console.log('--- ANSWERS ---');
console.log(JSON.stringify({ ...answers, corrupt_listing_ids: `[${corruptIds.length} ids]`, fake_listing_ids: `[${fakeIds.length} ids]` }, null, 1));
console.log('\ncorruption breakdown:');
for (const k of Object.keys(CORRUPTION_RULES)) console.log('   ' + k.padEnd(30), listings.filter(CORRUPTION_RULES[k]).length);
console.log('fake phones:', fakePhones.length, '->', fakeIds.length, 'listings');
console.log('market median ppsf', marketMedian.toFixed(0), '| q6 n =', q6set.length, '| metric-area records', listings.filter(isMetricArea).length);
console.log('dup groups', dupGroups.length, '| extra records', listings.length - uniqueProperties);
console.log('Q10 wrongVsLive', wrongVsLive.length, ' wrongVsAll', wrongVsAll.length);
console.log('baner rentals', banerRentals.length, 'sum', answers.total_monthly_rent);
console.log('last7 =', last7.length);

const normListings = listings.map((l) => ({
  ...l,
  carpet_area: carpetSqft(l), super_built_up_area: superSqft(l),
  raw_carpet_area: l.carpet_area, area_unit_corrected: isMetricArea(l),
  price_per_sqft: l.price > 0 ? Math.round(ppsf(l)) : null,
  quality_flags: corruptionOf(l),
  is_corrupt: corruptIds.includes(l.listing_id),
  is_suspected_fake: fakeIds.includes(l.listing_id),
  duplicate_key: propertyKey(l),
}));
const normProjects = projects.map((p) => ({
  ...p, price_min_inr: projectPriceMinInr(p), price_max_inr: projectPriceMaxInr(p),
  actual_live_listings: liveByProject.get(p.project_id) || 0,
  actual_total_listings: allByProject.get(p.project_id) || 0,
  listing_count_mismatch: p.total_listings !== (liveByProject.get(p.project_id) || 0),
}));
const out = new URL('../data/', import.meta.url);
writeFileSync(new URL('dataset.json', out), JSON.stringify({
  generated_at: new Date().toISOString(), city: 'pune', assigned_locality: ASSIGNED_LOCALITY,
  listings: normListings, rentals, projects: normProjects,
  meta: { fake_phones: fakePhones, corrupt_ids: corruptIds, fake_ids: fakeIds, market_median_ppsf: Math.round(marketMedian) },
}));
writeFileSync(new URL('answers.json', out), JSON.stringify(answers, null, 2));
console.log('\nwrote data/dataset.json + data/answers.json');
