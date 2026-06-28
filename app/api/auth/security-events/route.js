import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    const rows = await sql`
      SELECT event_type, status, meta, created_at
      FROM security_events
      WHERE user_id = ${me.id}
      ORDER BY created_at DESC
      LIMIT 40
    `;
    return NextResponse.json({ events: rows });
  } catch (err) {
    console.error('security events error', err);
    return NextResponse.json({ error: 'Could not load security events.' }, { status: 500 });
  }
}
