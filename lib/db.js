import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string.');
}

export const sql = neon(process.env.DATABASE_URL);
