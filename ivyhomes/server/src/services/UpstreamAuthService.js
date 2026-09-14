import { config } from '../config/env.js';
import { ApiError } from '../core/ApiError.js';

/**
 * Authenticates a user against the real Ivy auth flow.
 *
 * Two things the documentation gets wrong are handled here:
 *  - the key goes in the X-API-Key header, not ?api_key=
 *  - the access token lives 900 seconds, not 86400, and there IS a refresh
 *    flow at POST /auth/refresh despite the docs saying otherwise.
 *
 * We verify the password upstream, then mint our own 7-day session token, so
 * the browser session survives a refresh and keeps working well past the
 * upstream 15-minute window.
 */
export class UpstreamAuthService {
  constructor({ baseUrl = config.upstream.baseUrl, apiKey = config.upstream.apiKey } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  async #post(path, body) {
    let res;
    try {
      res = await fetch(this.baseUrl + path, {
        method: 'POST',
        headers: { 'X-API-Key': this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw ApiError.upstream('Could not reach the Ivy Homes API', String(cause));
    }
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { detail: text }; }
    return { status: res.status, body: parsed };
  }

  /** @returns {{email: string, upstream: object}} */
  async verifyCredentials(email, password) {
    const { status, body } = await this.#post('/auth/login', { email, password });
    if (status === 401 || status === 403) throw ApiError.unauthorised('Those credentials were rejected by the Ivy Homes API');
    if (status !== 200) throw ApiError.upstream('Unexpected response from the Ivy Homes auth service', body?.detail);
    return {
      email: body.user?.email ?? email,
      upstream: {
        accessToken: body.access_token ?? body.token,
        refreshToken: body.refresh_token ?? null,
        expiresIn: body.expires_in ?? null,
      },
    };
  }
}

export const upstreamAuthService = new UpstreamAuthService();
