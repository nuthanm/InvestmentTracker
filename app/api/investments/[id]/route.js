import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const rows = await sql`
    SELECT i.*, g.name AS goal_name
    FROM investments i
    LEFT JOIN goals g ON g.id = i.goal_id
    WHERE i.id = ${params.id} AND i.user_id = ${me.id}
    LIMIT 1
  `;
  if (rows.length === 0) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const documents = await sql`
    SELECT id, filename, size_bytes, page_count, data_url
    FROM documents WHERE investment_id = ${params.id}
    ORDER BY created_at ASC
  `;
  return NextResponse.json({ investment: rows[0], documents });
}

export async function DELETE(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  try {
    await sql`DELETE FROM investments WHERE id = ${params.id} AND user_id = ${me.id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Could not delete.' }, { status: 500 });
  }
}
