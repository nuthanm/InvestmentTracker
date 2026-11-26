import { neon, types } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string.');
}

// Return DATE columns as plain 'YYYY-MM-DD' strings. The default parser makes
// a JS Date at local midnight, which serialises as the previous day in UTC
// (e.g. 2026-01-05 → "2026-01-04T18:30:00.000Z" in IST) and breaks
// <input type="date"> pre-fill on every edit form.
const PG_DATE_OID = 1082;
types.setTypeParser(PG_DATE_OID, (value) => value);

export const sql = neon(process.env.DATABASE_URL);
