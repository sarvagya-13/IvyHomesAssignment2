const BASE = import.meta.env.VITE_API_BASE ?? '/api';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/**
 * One place that knows how to talk to our backend.
 *
 * The session token is mirrored into localStorage so a refresh restores the
 * UI instantly, but the authoritative copy is an httpOnly cookie the server
 * sets, which is what actually keeps the session alive.
 */
class ApiClient {
  #token = null;
  #inflight = new Map();

  constructor() {
    try { this.#token = localStorage.getItem('ivy.session') ?? null; } catch { this.#token = null; }
  }

  get token() { return this.#token; }

  setToken(token) {
    this.#token = token;
    try {
      if (token) localStorage.setItem('ivy.session', token);
      else localStorage.removeItem('ivy.session');
    } catch { /* private mode - the cookie still carries the session */ }
  }

  async request(path, { method = 'GET', body, signal } = {}) {
    const res = await fetch(BASE + path, {
      method,
      credentials: 'include',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(this.#token ? { Authorization: `Bearer ${this.#token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal,
    });

    if (res.status === 204) return null;
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) this.setToken(null);
      throw new ApiError(res.status, payload?.error?.message ?? 'Something went wrong', payload?.error?.details);
    }
    return payload;
  }

  /** De-duplicates identical in-flight GETs, which React strict mode causes a lot of. */
  get(path, opts) {
    if (this.#inflight.has(path)) return this.#inflight.get(path);
    const p = this.request(path, opts).finally(() => this.#inflight.delete(path));
    this.#inflight.set(path, p);
    return p;
  }

  post(path, body) { return this.request(path, { method: 'POST', body }); }
  delete(path) { return this.request(path, { method: 'DELETE' }); }
}

export const api = new ApiClient();

export const buildQuery = (params) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === 'any') continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
};
