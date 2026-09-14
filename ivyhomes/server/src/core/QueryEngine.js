/**
 * A small, reusable query pipeline over an in-memory collection.
 *
 * It exists because the upstream API only honours two of its documented
 * filters: locality and bhk. furnishing, min_price, max_price and project_id
 * are accepted and ignored, and there is no server-side text search at all.
 * Rather than scatter that workaround through the controllers, every
 * collection is filtered, sorted and paged through this one class.
 */

/** Declarative predicate builders, keyed by the query parameter they serve. */
export const Predicates = {
  equals: (field) => (value) => (row) => String(row[field] ?? '').toLowerCase() === String(value).toLowerCase(),
  numberEquals: (field) => (value) => (row) => Number(row[field]) === Number(value),
  min: (field) => (value) => (row) => Number(row[field]) >= Number(value),
  max: (field) => (value) => (row) => Number(row[field]) <= Number(value),
  oneOf: (field) => (value) => {
    const wanted = new Set(String(value).toLowerCase().split(',').map((s) => s.trim()).filter(Boolean));
    return (row) => wanted.has(String(row[field] ?? '').toLowerCase());
  },
  boolean: (field) => (value) => (row) => row[field] === (value === true || value === 'true'),
  /** Case-insensitive substring match across several fields at once. */
  search: (fields) => (value) => {
    const needle = String(value).trim().toLowerCase();
    if (!needle) return () => true;
    return (row) => fields.some((f) => String(row[f] ?? '').toLowerCase().includes(needle));
  },
  /** bedroom=4 means "4 or more", which is how property sites conventionally behave. */
  bedroomsAtLeast: (field) => (value) => {
    const n = Number(value);
    return (row) => (n >= 4 ? Number(row[field]) >= n : Number(row[field]) === n);
  },
};

export class QueryEngine {
  /**
   * @param {object} schema map of query-param name -> predicate factory
   * @param {string[]} sortable fields the caller is allowed to sort by
   */
  constructor({ schema, sortable, defaultSort = null, maxLimit = 60 }) {
    this.schema = schema;
    this.sortable = new Set(sortable);
    this.defaultSort = defaultSort;
    this.maxLimit = maxLimit;
  }

  #buildFilters(query) {
    const active = [];
    for (const [param, factory] of Object.entries(this.schema)) {
      const raw = query[param];
      if (raw === undefined || raw === null || raw === '' || raw === 'any') continue;
      active.push({ param, value: raw, test: factory(raw) });
    }
    return active;
  }

  #applySort(rows, sortBy, order) {
    if (!sortBy || !this.sortable.has(sortBy)) return rows;
    const dir = order === 'desc' ? -1 : 1;
    return rows.slice().sort((a, b) => {
      const x = a[sortBy];
      const y = b[sortBy];
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir;
    });
  }

  /**
   * @returns {{results: object[], total: number, limit: number, offset: number,
   *            has_more: boolean, applied_filters: string[]}}
   */
  run(rows, query = {}) {
    const filters = this.#buildFilters(query);
    let out = rows;
    for (const { test } of filters) out = out.filter(test);

    const sortBy = query.sort_by ?? this.defaultSort;
    out = this.#applySort(out, sortBy, query.order);

    const total = out.length;
    const limit = Math.min(Math.max(Number(query.limit) || 24, 1), this.maxLimit);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const page = out.slice(offset, offset + limit);

    return {
      results: page,
      total,
      limit,
      offset,
      count: page.length,
      has_more: offset + page.length < total,
      applied_filters: filters.map((f) => f.param),
      sorted_by: this.sortable.has(sortBy) ? { field: sortBy, order: query.order === 'desc' ? 'desc' : 'asc' } : null,
    };
  }
}
