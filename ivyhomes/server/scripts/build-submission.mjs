/**
 * Assembles submission.json from the analysed snapshot, so that every id quoted
 * as evidence is pulled from the data rather than typed by hand.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import 'dotenv/config';

const ds = JSON.parse(readFileSync(new URL('../data/dataset.json', import.meta.url), 'utf8'));
const answers = JSON.parse(readFileSync(new URL('../data/answers.json', import.meta.url), 'utf8'));
const { listings, projects } = ds;
const take = (a, n = 20) => a.slice(0, n);

const metric = listings.filter((l) => l.area_unit_corrected).map((l) => l.listing_id);
const dupKeys = new Map();
for (const l of listings) dupKeys.set(l.duplicate_key, [...(dupKeys.get(l.duplicate_key) || []), l.listing_id]);
const dupEvidence = take([...dupKeys.values()].filter((g) => g.length > 1).flat());
const wrongProjects = projects.filter((p) => p.listing_count_mismatch).map((p) => p.project_id);
const notLive = listings.filter((l) => !l.is_live).map((l) => l.listing_id);

const findings = [
  {
    endpoint: '*',
    category: 'auth',
    documented: 'append the key as a query parameter: GET /v1/listings?api_key=IVY26-...',
    actual: 'the query parameter is rejected with 401 "send your key in the X-API-Key request header, not as a query parameter"; the key must travel in the X-API-Key header',
    how_found: 'called /v1/listings with ?api_key= exactly as documented and read the 401 body',
    impact: 'every request built from the documentation fails to authenticate',
    evidence: [],
  },
  {
    endpoint: '/auth/login',
    category: 'auth',
    documented: 'response contains "token", expires_in is 86400 (24 hours), and "There is no refresh flow"',
    actual: 'the field is "access_token", and the response also carries "refresh_token" and "refresh_url": "/auth/refresh". expires_in is 900 seconds, confirmed against the exp and iat claims inside the JWT',
    how_found: 'logged in and diffed the JSON keys and the decoded token claims against the documented shape',
    impact: 'a client written from the docs reads an undefined "token" and is silently logged out after 15 minutes instead of 24 hours',
    evidence: [],
  },
  {
    endpoint: '/auth/refresh',
    category: 'undocumented_endpoint',
    documented: 'the reference states explicitly that there is no refresh flow',
    actual: 'POST /auth/refresh exists and exchanges a refresh_token for a fresh access token; a GET returns 405 Method Not Allowed rather than 404, confirming the route is real',
    how_found: 'the login response advertised refresh_url, so I called it',
    impact: 'without it no session can outlive the 15-minute access token, which is what the thirty-minute requirement actually tests',
    evidence: [],
  },
  {
    endpoint: '*',
    category: 'pagination',
    documented: 'every collection takes page and limit, and responses are shaped {total, page, page_size, results}',
    actual: 'collections page by offset and respond {limit, offset, count, total, has_more, results}. page is accepted and silently ignored',
    how_found: 'requested ?limit=3&page=2 and ?limit=3&page=3 and got byte-identical records back with offset still reported as 0',
    impact: 'a page-based crawler written from the docs re-reads the first page forever and never advances',
    evidence: [],
  },
  {
    endpoint: '*',
    category: 'pagination',
    documented: 'limit has a maximum of 200',
    actual: 'limit is silently clamped to 50. Both ?limit=300 and ?limit=1000 return 50 records and echo limit=50 rather than erroring',
    how_found: 'requested limit=300 and limit=1000 and read the echoed limit and count',
    impact: 'a crawler sizing its page count on limit=200 requests a quarter of the pages it needs and stops well short of the end',
    evidence: [],
  },
  {
    endpoint: '*',
    category: 'completeness',
    documented: 'total is the exact number of records matching your filters; to fetch every record, read total, divide by your limit, and request that many pages',
    actual: 'total understates every collection. /v1/listings reports total=3661 but yields 3800 distinct listing_ids when paged by offset to genuine exhaustion; /v1/rentals reports 1397 and yields 1450; /v1/projects reports 424 and yields 440. has_more stays true past the reported total',
    how_found: 'ignored total entirely, advanced offset by the number of records actually returned until the server stopped producing new ids, then counted distinct ids',
    impact: 'following the documented recipe silently drops 139 listings, 53 rentals and 16 projects, which changes every count in this assignment',
    evidence: [],
  },
  {
    endpoint: '/v1/listings',
    category: 'completeness',
    documented: 'returns active sale listings; inactive, expired and withdrawn listings are excluded server side, so anything this endpoint returns is safe to show to a user',
    actual: 'records carry an undocumented is_live field and 802 of the 3800 retrievable records have is_live false',
    how_found: 'diffed the documented listing object against the keys actually returned, spotted is_live, and counted it',
    impact: 'a UI that trusts the endpoint presents hundreds of dead listings as live',
    evidence: take(notLive),
  },
  {
    endpoint: '/v1/listing/{id}',
    category: 'missing_endpoint',
    documented: 'GET /v1/listing/{listing_id} returns a single listing',
    actual: 'the singular path 404s. The working single-listing route is the plural GET /v1/listings/{listing_id}',
    how_found: 'requested both spellings for the same known-good id',
    impact: 'the documented detail route is unusable, which is the route a detail page is built on',
    evidence: [],
  },
  {
    endpoint: '/v1/listings/{id}/similar',
    category: 'missing_endpoint',
    documented: 'up to ten comparable listings, same locality, same bedroom count, price within 15 percent',
    actual: '404 Not Found for an id that resolves fine at /v1/listings/{id}',
    how_found: 'called it with a known-good id immediately after fetching that listing successfully',
    impact: 'comparables have to be computed client side instead',
    evidence: [],
  },
  {
    endpoint: '/v1/analytics/summary',
    category: 'missing_endpoint',
    documented: 'pre-computed aggregates for your city, handy for a dashboard screen',
    actual: '404 Not Found. No /v1/analytics tree exists at any depth',
    how_found: 'called it both before and after logging in. Unauthenticated it returns 404 while /v1/listings returns 401, so the route genuinely does not exist rather than merely being hidden behind auth',
    impact: 'the entire insights screen has to be computed from the raw collections',
    evidence: [],
  },
  {
    endpoint: '/v1/favourites',
    category: 'missing_endpoint',
    documented: 'GET /v1/favourites, POST /v1/favourites and DELETE /v1/favourites/{id}',
    actual: '404 at both /v1/favourites and /v1/favorites. Saved listings live at /v1/saved',
    how_found: 'tried both spellings, then probed neighbouring nouns until /v1/saved answered 200',
    impact: 'the documented save flow does not exist at the documented path',
    evidence: [],
  },
  {
    endpoint: '/v1/saved',
    category: 'undocumented_endpoint',
    documented: 'not mentioned anywhere in the reference',
    actual: 'GET /v1/saved returns {count, results}, and DELETE /v1/saved/{id} answers "not in your saved list" for an id that is not saved',
    how_found: 'found it while probing for the real favourites path',
    impact: 'the only working save API is undocumented, so it cannot be discovered from the reference at all',
    evidence: [],
  },
  {
    endpoint: '/v1/localities',
    category: 'undocumented_endpoint',
    documented: 'not mentioned anywhere in the reference',
    actual: 'returns {city, count, results:[{locality, listing_count}]} listing the ten localities in pune',
    how_found: 'probed for a filter-vocabulary endpoint once locality turned out to be an exact-match filter',
    impact: 'useful for populating filter menus; a client built from the docs would hardcode the list and drift',
    evidence: [],
  },
  {
    endpoint: '/v1/listings',
    category: 'filters',
    documented: 'furnishing, min_price and max_price filter the collection',
    actual: 'all three are accepted and completely ignored. Each returns the unfiltered total of 3661 with the same leading records as a bare call. locality and bhk, by contrast, do filter',
    how_found: 'called each filter on its own and compared the reported total and the leading records against an unfiltered request',
    impact: 'price and furnishing filtering must be done client side; a UI that trusts the server silently shows unfiltered results',
    evidence: [],
  },
  {
    endpoint: '/v1/listings',
    category: 'filters',
    documented: 'total_listings on a project always agrees with what GET /v1/listings?project_id=... returns',
    actual: 'project_id is not a supported filter. It is accepted and ignored, returning the whole 3661-record collection',
    how_found: 'called /v1/listings?project_id=P30001 and received the unfiltered total and unfiltered leading records',
    impact: 'the verification the documentation tells you to perform cannot be performed the way it describes',
    evidence: [],
  },
  {
    endpoint: '/v1/listings',
    category: 'units',
    documented: 'area is square feet, integer, everywhere in the API',
    actual: `${metric.length} records carry carpet_area and super_built_up_area in square METRES. They give themselves away as price/carpet_area above 30000 against a market median of ${ds.meta.market_median_ppsf}, and fall onto the normal distribution after multiplying by 10.7639. The ratio of carpet to super built up stays at the usual 0.74 within these records, so both fields were converted together`,
    how_found: 'ranked price divided by carpet area across all 3800 records. The distribution is tight to the 92nd percentile and then jumps by an order of magnitude with nothing in between, and every record above the jump has carpet_area under 217',
    impact: 'every price-per-square-foot figure is inflated about 10.8x for these records, and area sorts and filters place them in the wrong bucket',
    evidence: take(metric),
  },
  {
    endpoint: '/v1/projects',
    category: 'units',
    documented: 'price_min and price_max are in rupees',
    actual: 'neither is. price_min is in LAKHS and price_max is in CRORES. Read naively, price_min exceeds price_max for 321 of 440 projects, which cannot be. Scaling by 1e5 and 1e7 respectively reconciles both with the per-square-foot rates implied by the listings and restores price_min below price_max for every project',
    how_found: 'noticed price_min > price_max for most projects, then solved for the pair of scale factors that makes project rates agree with the listing rates and the ordering valid everywhere',
    impact: 'project prices rendered as rupees are wrong by five and seven orders of magnitude respectively',
    evidence: take(projects.map((p) => p.project_id)),
  },
  {
    endpoint: '/v1/listings',
    category: 'duplicates',
    documented: 'every listing_id is globally unique, and each listing corresponds to exactly one physical property',
    actual: `the ids are all distinct, but the properties are not. ${listings.length - answers.unique_properties} records re-describe a property already present, cross-posted to other portals with jittered price and carpet area at byte-identical coordinates. One property appears on squarelane, zerobroker and magichomes at 9460000, 8670000 and 11370000`,
    how_found: 'grouped on apartment_name, locality, bedroom, latitude and longitude. Coordinates repeat exactly across portals while price and area wobble a few percent, which is the signature of a re-post rather than a neighbouring flat',
    impact: 'counts, averages and the browse list all double-count these properties',
    evidence: dupEvidence,
  },
  {
    endpoint: '/v1/listings',
    category: 'data_quality',
    documented: 'the listing object is described with no validity caveats',
    actual: 'exactly 42 records are physically impossible, in six disjoint classes of exactly 7 each: negative price, carpet_area greater than super_built_up_area, floor above total_floors, posted_at after the reference moment, coordinates outside the Pune bounding box, and a non-plot dwelling reporting 0 bedrooms and 0 bathrooms',
    how_found: 'wrote one predicate per physical invariant and ran them all over the snapshot. The clean six-way split into equal groups of seven is what confirmed the corruption was injected rather than incidental noise',
    impact: 'these poison any aggregate; the seven negative prices alone drag the mean sale price down and take the top of any price-ascending sort',
    evidence: take(answers.corrupt_listing_ids),
  },
  {
    endpoint: '/v1/listings',
    category: 'fraud',
    documented: 'posted_by_contact is the seller verified contact number, and is_verified means our operations team has checked the listing',
    actual: `${answers.fake_listing_ids.length} listings are bait, spread across ${ds.meta.fake_phones.length} phone numbers holding 29 to 30 listings each. Every one of them is is_verified true, and each number prices its entire book around 5500 per square foot against a market median of ${ds.meta.market_median_ppsf}`,
    how_found: 'ranked phone numbers by median price per square foot rather than by volume. Volume is the rule that almost works and it is wrong at exactly the interesting point: the single busiest number, +912002574181 with 31 listings, prices at the market and is an honest high-volume agent, while the ring sits just below it on volume and far below it on price',
    impact: 'these are the cheapest listings in the city, so they dominate any price-ascending sort and pull down every locality average a user sees',
    evidence: take(answers.fake_listing_ids),
  },
  {
    endpoint: '/v1/projects',
    category: 'consistency',
    documented: 'total_listings is recomputed whenever a listing is added or withdrawn, so it always agrees with what GET /v1/listings?project_id=... returns',
    actual: `it disagrees for ${wrongProjects.length} of 440 projects. The field is computed over live listings only: it matches the live count for 345 projects but the all-records count for just 123, so live-only is the intended rule and the remaining ${wrongProjects.length} are genuinely stale`,
    how_found: 'counted listings per project_id from the full snapshot under both readings and kept whichever fits more projects, on the principle that the rule fitting most of the data is the rule the server meant to apply and the misfits are the real answer',
    impact: 'a project page that trusts total_listings shows a count that does not match the listings displayed beneath it',
    evidence: take(wrongProjects),
  },
];

const submission = {
  api_key: process.env.IVY_API_KEY ?? 'IVY26-XXXXXXXXXXXX',
  candidate: {
    name: '',
    email: '',
    repo_url: '',
    demo_url: '',
  },
  answers,
  findings,
};

writeFileSync(new URL('../../submission.json', import.meta.url), JSON.stringify(submission, null, 2));
console.log('findings:', findings.length);
console.log('categories:', [...new Set(findings.map((f) => f.category))].join(', '));
console.log('with evidence:', findings.filter((f) => f.evidence.length).length);
