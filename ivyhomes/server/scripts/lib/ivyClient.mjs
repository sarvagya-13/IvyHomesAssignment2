/**
 * Thin, honest client for the Ivy Homes upstream API.
 *
 * Encodes what the running service actually does, not what API_REFERENCE.md claims:
 *  - the key travels in the X-API-Key header, never as ?api_key=
 *  - every /v1 route additionally needs a bearer token
 *  - access tokens live 900s, so we refresh transparently on any 401
 *  - collections page by `offset`; `page` is accepted and ignored
 */
export class IvyClient {
  #access = null;
  #refresh = null;

  constructor({ baseUrl, apiKey, email, password }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.email = email;
    this.password = password;
    this.requestCount = 0;
  }

  get #authHeaders() {
    const h = { 'X-API-Key': this.apiKey };
    if (this.#access) h.Authorization = `Bearer ${this.#access}`;
    return h;
  }

  async login() {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'X-API-Key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.email, password: this.password }),
    });
    if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
    const body = await res.json();
    this.#access = body.access_token ?? body.token;
    this.#refresh = body.refresh_token ?? null;
    return body;
  }

  async #renew() {
    if (this.#refresh) {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'X-API-Key': this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.#refresh }),
      });
      if (res.ok) {
        const body = await res.json();
        this.#access = body.access_token ?? body.token;
        if (body.refresh_token) this.#refresh = body.refresh_token;
        return;
      }
    }
    await this.login();
  }

  /** Raw request that retries once through a token renewal, and backs off on 429. */
  async request(path, init = {}, attempt = 0) {
    this.requestCount += 1;
    const res = await fetch(this.baseUrl + path, { ...init, headers: { ...this.#authHeaders, ...(init.headers || {}) } });
    if (res.status === 401 && attempt < 2) { await this.#renew(); return this.request(path, init, attempt + 1); }
    if (res.status === 429 && attempt < 5) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      return this.request(path, init, attempt + 1);
    }
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body };
  }

  async get(path) { return this.request(path); }

  /**
   * Walk a collection to genuine exhaustion.
   *
   * Deliberately does NOT trust `total`: it advances by the number of records the
   * server actually handed back and stops only when the server stops producing
   * new ones. That is the only way to reach the real end of /v1/listings.
   */
  async *pages(path, { limit = 50, hardCap = 500 } = {}) {
    let offset = 0, page = 0;
    const seenSignatures = new Set();
    while (page < hardCap) {
      const sep = path.includes('?') ? '&' : '?';
      const { status, body } = await this.get(`${path}${sep}limit=${limit}&offset=${offset}`);
      if (status !== 200) throw new Error(`${path} offset=${offset} -> ${status} ${JSON.stringify(body).slice(0, 200)}`);
      const rows = body.results ?? [];
      if (rows.length === 0) break;
      // Guard against a server that loops rather than ending.
      const sig = rows.map((r) => r.listing_id ?? r.project_id ?? JSON.stringify(r)).join('|');
      if (seenSignatures.has(sig)) break;
      seenSignatures.add(sig);
      yield { body, rows, offset };
      offset += rows.length;
      page += 1;
      if (body.has_more === false) break;
    }
  }

  async collectAll(path, opts) {
    const out = [];
    let envelope = null;
    for await (const { body, rows } of this.pages(path, opts)) {
      envelope ??= { limit: body.limit, total: body.total };
      out.push(...rows);
    }
    return { records: out, envelope };
  }
}
