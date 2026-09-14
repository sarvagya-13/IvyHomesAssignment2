# Ivy Homes — Pune property search

A MERN application over the Ivy Homes property API, plus the answers to the ten
questions and a list of everywhere the documentation disagrees with the running
service.

The short version: **the documentation is wrong in eleven distinct ways, and the
two that matter most are invisible in any single response.** `total` understates
every collection, so the documented way to page through the data silently loses
139 listings; and roughly 8% of listings report area in square metres while the
docs promise square feet, which inflates their price-per-square-foot by 10.8x.

---

## Running it

You need Node 20+ and a local MongoDB.

```bash
# 1. backend
cd server
cp .env.example .env          # then fill in IVY_API_KEY and IVY_DEMO_PASSWORD
npm install
npm run harvest               # ~116 requests, ~12s - pulls the whole dataset to data/raw/
npm run analyse               # derives data/dataset.json + data/answers.json
npm run dev                   # http://localhost:5000

# 2. frontend, in a second terminal
cd client
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

Sign in with `demo1@ivy.homes`, `demo2@ivy.homes` or `demo3@ivy.homes` and the
password issued with the API key.

`npm run analyse` must run before `npm run dev`, because the server refuses to
start without `data/dataset.json`.

### Architecture

```
server/                      Express + Mongoose
  scripts/harvest.mjs        pages the upstream API to genuine exhaustion
  scripts/analyse.mjs        every correction and every answer, in one place
  scripts/build-submission.mjs
  src/core/QueryEngine.js    declarative filter/sort/paginate pipeline
  src/services/              DatasetService, InsightsService, UpstreamAuthService
  src/models/                User, SavedListing
client/                      React 18 + Vite + Tailwind
  src/pages/                 route-level React.lazy splits
  src/hooks/                 useCollection (abortable paging), useDebouncedValue
  src/context/               AuthContext, SavedContext
```

The frontend never calls the upstream API directly. It calls our backend, which
serves a corrected snapshot. That is deliberate: it is the only way the filters
and the totals in the UI can be right, because the upstream ignores half its own
documented filters and misreports its own totals.

---

## How I worked out what to distrust

I called `/health` first, then tried to do exactly what the documentation said
and watched where it broke. That found the cheap discrepancies in about fifteen
minutes: the key goes in a header not a query parameter, `/v1/listing/{id}` is
really `/v1/listings/{id}`, `/v1/analytics/summary` and `/v1/favourites` are 404
(the real one is `/v1/saved`), and `page` is accepted and ignored.

Two of those cheap findings were load-bearing.

**The session.** `expires_in` is 900, not the documented 86400, and the response
carries a `refresh_token` and a `refresh_url` even though the docs say in so many
words that there is no refresh flow. That is what the "still working thirty
minutes after you logged in" requirement is actually testing — a client built
from the documentation dies at the fifteen-minute mark. Our backend verifies the
password upstream and then mints its own seven-day session in an httpOnly cookie,
so the browser session is independent of the upstream token lifetime.

**The end of the collection.** `total` says 3661. Advancing by `offset` until the
server stops producing new records yields 3800 distinct ids, and `has_more` stays
true past the reported total. Rentals go 1397 → 1450, projects 424 → 440. Every
count in Part 2 depends on getting this right, and the documented recipe — "read
`total`, divide by your limit, request that many pages" — gets it wrong.

Then I stopped reading responses and pulled everything down (116 requests), which
is where the rest came from:

- **Areas in square metres.** Price ÷ carpet area is tight to the 92nd percentile
  and then jumps by an order of magnitude with nothing in between. Every record
  above the jump has a carpet area under 217. Multiplying by 10.7639 lands them
  exactly on the main distribution, and the carpet-to-built-up ratio stays at the
  usual 0.74, so both area fields were converted together.
- **Project prices in two units.** Read as rupees, `price_min` exceeds
  `price_max` for 321 of 440 projects. Scaling the minimum by 10⁵ (lakhs) and the
  maximum by 10⁷ (crores) restores the ordering for every project and reconciles
  project rates with listing rates.
- **Forty-two impossible records.** Six physical invariants each fail on exactly
  seven records, with no overlap between the groups. Equal groups of seven is not
  what natural corruption looks like.
- **Projects miscounting.** `total_listings` matches the *live* listing count for
  345 projects and the all-records count for only 123. So the field means live
  listings, and the 95 that still disagree are genuinely stale.

### The one that needed a hypothesis

Question 9 asks which listings are fake. The obvious rule is "the phone numbers
with the most listings" — and it is wrong in an instructive way.

Ranking phones by volume puts `+912002574181` at the top with 31 listings. It is
a real agent: its median rate is ₹10,862/sqft against a market median of ₹10,332.
The actual ring is seven numbers holding 29–30 listings each, sitting *just below*
the busiest honest agent on volume, every listing marked `is_verified: true`, and
every one priced near ₹5,500/sqft — about half the going rate. Bait, priced to
generate enquiries.

So the rule is volume **and** systematic underpricing **and** blanket verification,
not volume alone. The statement warns that the first rule that fits will fit most
of the data and that the answer is in what it gets wrong; `+912002574181` is
exactly that record.

---

## What I checked that turned out to be fine

These are the hypotheses that did not pan out. They cost time and produced
nothing, which is the point of listing them.

- **Timestamps.** The conventions table claims ISO 8601 UTC with a `Z` suffix
  everywhere, and `/health` returns `+05:30`, so I expected `posted_at` to be IST
  mislabelled as UTC — a four-part answer to question 8 depending on which way you
  read it. It is not. All 3800 listings end in `Z`, none carry an offset, and the
  hour-of-day distribution is flat (132–190 per hour across all 24), so there is no
  timezone shift hiding in it. I answered question 8 taking `Z` at face value.
- **Sorting.** I expected `sort_by` to be ignored the way the filters are. It is
  not: `price` ascending and descending, `carpet_area`, and `bedroom` all order
  correctly. No `sorting` finding, because there isn't one.
- **`listing_id` uniqueness.** The docs claim ids are globally unique. They are —
  all 3800 are distinct. The lie is the *second* half of that sentence ("each
  listing corresponds to exactly one physical property"), which is a duplicates
  problem, not an id problem.
- **Bedroom count of zero.** 143 records report 0 bedrooms and 0 bathrooms, which
  looks like mass corruption. 136 of them are plots, where it is correct. Only the
  remaining 7 are genuinely impossible. Reporting all 143 would have wrecked the
  precision score on question 4.
- **`carpet_area` under 400 sq ft.** 325 records, which looked like the unit bug
  until I checked configuration: 175 of them are 3BHK or larger, so small area
  alone does not identify the metric records. The price-per-area ratio does.
- **Rental rents.** I expected the same unit problem as sale prices. Rents run
  ₹7,500–₹90,800 with a median of ₹33,200 — all plausible monthly rupees, no
  rescaling needed. Deposits *are* affected (some are quoted in lakhs), but
  question 5 asks about rent, so it does not change the answer.
- **Geographic bounds.** I checked whether the key leaks other cities. It does not
  — all 3800 records are `city_id: 3`. Only 7 records have coordinates outside the
  Pune bounding box, and those are part of the injected corruption.

---

## What I would do with another two days

1. **Verify the duplicate rule harder.** Question 2 is graded to ±1% and my answer
   (3707) rests on grouping by name, locality, bedrooms and coordinates. I would
   test whether any genuine pair of distinct flats shares coordinates exactly,
   which would make the rule slightly over-merge.
2. **Re-derive the fraud set from the other direction.** I identified the ring by
   price, then checked volume. I would like to build it from description
   similarity and posting cadence independently and confirm the same 205 records
   fall out.
3. **Serve the app from a live proxy with a snapshot fallback**, so it reflects
   upstream changes instead of a frozen file, with the corrections applied in the
   request path.
4. **Tests.** The correction rules in `analyse.mjs` are the whole submission and
   they have no test suite. Each one deserves a fixture.

---

## Tooling

Built with Claude (Anthropic) in Claude Code, used throughout: for the endpoint
sweep, the exploratory analysis, and most of the application code. The hypotheses
about what to test — the metric areas, the two project price units, ranking phones
by rate rather than volume — came from looking at distributions and arguing about
what could not physically be true. The model tested them quickly; it did not
propose them.

## Notes

- `server/.env` is gitignored and holds the API key and demo password. Use
  `.env.example` as the template.
- `server/data/raw/` is gitignored; regenerate it with `npm run harvest`.
- `submission.json` at the repository root is generated by
  `npm run --prefix server build:submission`, so the evidence ids in it are pulled
  from the data rather than typed by hand.
