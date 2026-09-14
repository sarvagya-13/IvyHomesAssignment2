import { readFileSync, existsSync } from 'node:fs';
import { QueryEngine, Predicates } from '../core/QueryEngine.js';
import { ApiError } from '../core/ApiError.js';

/**
 * Owns the corrected snapshot and every read against it.
 *
 * The frontend never talks to the upstream API for data. It talks to this,
 * which serves the snapshot produced by `npm run harvest && npm run analyse`:
 * areas converted out of square metres, project prices converted out of lakhs
 * and crores, and every record tagged with what we found wrong with it.
 * That is what makes filters and totals in the UI actually correct.
 */
class DatasetService {
  #data = null;
  #listingById = new Map();
  #rentalById = new Map();
  #projectById = new Map();
  #listingsByProject = new Map();

  constructor() {
    this.listingQuery = new QueryEngine({
      schema: {
        q: Predicates.search(['apartment_name', 'locality', 'description', 'listing_id']),
        locality: Predicates.oneOf('locality'),
        bedroom: Predicates.bedroomsAtLeast('bedroom'),
        property_type: Predicates.oneOf('property_type'),
        furnishing: Predicates.oneOf('furnishing'),
        min_price: Predicates.min('price'),
        max_price: Predicates.max('price'),
        min_area: Predicates.min('carpet_area'),
        max_area: Predicates.max('carpet_area'),
        is_live: Predicates.boolean('is_live'),
        project_id: Predicates.equals('project_id'),
      },
      sortable: ['price', 'carpet_area', 'posted_at', 'bedroom', 'price_per_sqft'],
      defaultSort: 'posted_at',
    });

    this.rentalQuery = new QueryEngine({
      schema: {
        q: Predicates.search(['apartment_name', 'locality', 'title', 'description']),
        locality: Predicates.oneOf('locality'),
        bedroom: Predicates.bedroomsAtLeast('bedroom'),
        property_type: Predicates.oneOf('property_type'),
        furnishing: Predicates.oneOf('furnishing'),
        min_price: Predicates.min('price'),
        max_price: Predicates.max('price'),
      },
      sortable: ['price', 'carpet_area', 'posted_at', 'bedroom', 'deposit'],
      defaultSort: 'posted_at',
    });

    this.projectQuery = new QueryEngine({
      schema: {
        q: Predicates.search(['apartment_name', 'developer_name', 'locality', 'project_id']),
        locality: Predicates.oneOf('locality'),
        project_status: Predicates.oneOf('project_status'),
        min_price: Predicates.min('price_min_inr'),
        max_price: Predicates.max('price_max_inr'),
      },
      sortable: ['price_min_inr', 'price_max_inr', 'launch_date', 'total_units', 'total_listings'],
      defaultSort: 'price_max_inr',
    });
  }

  load(url) {
    if (!existsSync(url)) {
      throw new Error('data/dataset.json is missing. Run `npm run harvest` then `npm run analyse` in server/.');
    }
    this.#data = JSON.parse(readFileSync(url, 'utf8'));
    for (const l of this.#data.listings) {
      this.#listingById.set(l.listing_id, l);
      if (l.project_id) {
        if (!this.#listingsByProject.has(l.project_id)) this.#listingsByProject.set(l.project_id, []);
        this.#listingsByProject.get(l.project_id).push(l);
      }
    }
    for (const r of this.#data.rentals) this.#rentalById.set(r.listing_id, r);
    for (const p of this.#data.projects) this.#projectById.set(p.project_id, p);
    return this;
  }

  get ready() { return this.#data !== null; }
  get meta() { return { city: this.#data.city, assigned_locality: this.#data.assigned_locality, generated_at: this.#data.generated_at, ...this.#data.meta }; }
  get listings() { return this.#data.listings; }
  get rentals() { return this.#data.rentals; }
  get projects() { return this.#data.projects; }

  /** Listings safe to put in front of a user: live, not impossible, not bait. */
  get trustworthyListings() {
    return this.#data.listings.filter((l) => l.is_live && !l.is_corrupt && !l.is_suspected_fake);
  }

  searchListings(query) {
    const pool = query.include_flagged === 'true' ? this.listings : this.trustworthyListings;
    return this.listingQuery.run(pool, query);
  }

  searchRentals(query) { return this.rentalQuery.run(this.rentals, query); }
  searchProjects(query) { return this.projectQuery.run(this.projects, query); }

  getListing(id) {
    const listing = this.#listingById.get(id);
    if (!listing) throw ApiError.notFound(`No listing with id ${id}`);
    return listing;
  }

  getRental(id) {
    const rental = this.#rentalById.get(id);
    if (!rental) throw ApiError.notFound(`No rental with id ${id}`);
    return rental;
  }

  getProject(id) {
    const project = this.#projectById.get(id);
    if (!project) throw ApiError.notFound(`No project with id ${id}`);
    return project;
  }

  listingsForProject(id) { return this.#listingsByProject.get(id) ?? []; }

  getListingsByIds(ids) {
    return ids.map((id) => this.#listingById.get(id)).filter(Boolean);
  }

  /**
   * The comparables strip the documented /similar endpoint promised but does
   * not implement: same locality, same bedroom count, price within 15%.
   */
  similarTo(id, limit = 6) {
    const base = this.getListing(id);
    return this.trustworthyListings
      .filter((l) => l.listing_id !== base.listing_id
        && l.locality === base.locality
        && l.bedroom === base.bedroom
        && base.price > 0 && Math.abs(l.price - base.price) / base.price <= 0.15)
      .sort((a, b) => Math.abs(a.price - base.price) - Math.abs(b.price - base.price))
      .slice(0, limit);
  }

  get localities() {
    const counts = new Map();
    for (const l of this.trustworthyListings) counts.set(l.locality, (counts.get(l.locality) ?? 0) + 1);
    return [...counts.entries()].map(([locality, count]) => ({ locality, count })).sort((a, b) => b.count - a.count);
  }

  get facets() {
    const uniq = (rows, field) => [...new Set(rows.map((r) => r[field]).filter(Boolean))].sort();
    return {
      localities: this.localities,
      property_types: uniq(this.listings, 'property_type'),
      furnishings: uniq(this.listings, 'furnishing'),
      project_statuses: uniq(this.projects, 'project_status'),
      price_bounds: {
        min: Math.min(...this.trustworthyListings.map((l) => l.price)),
        max: Math.max(...this.trustworthyListings.map((l) => l.price)),
      },
      rent_bounds: {
        min: Math.min(...this.rentals.map((r) => r.price)),
        max: Math.max(...this.rentals.map((r) => r.price)),
      },
    };
  }
}

export const datasetService = new DatasetService();
