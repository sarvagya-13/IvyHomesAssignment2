/**
 * Pulls the entire dataset our key can see and parks it on disk, so that every
 * later question is answered against one fixed snapshot instead of re-querying
 * the API a record at a time.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { IvyClient } from './lib/ivyClient.mjs';
import 'dotenv/config';

const OUT = new URL('../data/raw/', import.meta.url);

const client = new IvyClient({
  baseUrl: process.env.IVY_BASE_URL,
  apiKey: process.env.IVY_API_KEY,
  email: 'demo1@ivy.homes',
  password: process.env.IVY_DEMO_PASSWORD,
});

const save = (name, data) => {
  writeFileSync(new URL(name, OUT), JSON.stringify(data, null, 1));
  console.log(`  saved ${name}`);
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  const session = await client.login();
  console.log(`login ok  expires_in=${session.expires_in}s  refresh=${Boolean(session.refresh_token)}`);

  for (const [name, path] of [['listings', '/v1/listings'], ['rentals', '/v1/rentals'], ['projects', '/v1/projects']]) {
    process.stdout.write(`harvesting ${name} ... `);
    const { records, envelope } = await client.collectAll(path);
    const uniq = new Set(records.map((r) => r.listing_id ?? r.project_id)).size;
    console.log(`${records.length} records (${uniq} unique ids), server said total=${envelope.total}`);
    save(`${name}.json`, { fetched_at: new Date().toISOString(), server_total: envelope.total, record_count: records.length, records });
  }

  const loc = await client.get('/v1/localities');
  save('localities.json', loc.body);
  const health = await client.get('/health');
  save('health.json', health.body);

  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s using ${client.requestCount} requests`);
}
main().catch((e) => { console.error('HARVEST FAILED:', e); process.exit(1); });
