import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(req) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const rows = await sql`
      SELECT code_hash FROM backup_recovery_codes
      WHERE user_id = ${user.id} AND used_at IS NULL
      ORDER BY created_at
    `;

    // Return code count and hashes (codes themselves are one-way hashed)
    // For display, we'll show the hashes truncated
    const displayCodes = rows.map(row => row.code_hash.substring(0, 8).toUpperCase());

    return NextResponse.json({ codes: displayCodes, count: rows.length });
  } catch (err) {
    console.error('get backup codes error', err);
    return NextResponse.json({ error: 'Could not fetch backup codes' }, { status: 500 });
  }
}
