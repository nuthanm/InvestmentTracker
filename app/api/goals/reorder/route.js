import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

function missingSortColumn(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('sort_order') && (msg.includes('does not exist') || err?.code === '42703');
}

export async function POST(req) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Choose an order to save.' }, { status: 400 });
    }

    let updated = 0;
    for (let index = 0; index < ids.length; index += 1) {
      const rows = await sql`
        UPDATE goals SET sort_order = ${index}
        WHERE id = ${ids[index]} AND user_id = ${me.id}
        RETURNING id
      `;
      updated += rows.length;
    }
    if (updated !== ids.length) {
      return NextResponse.json({ error: 'One of those goals is not yours.' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (missingSortColumn(err)) {
      return NextResponse.json(
        { error: 'Priority order is not available yet. Run db/migrations/2026-11-01-sort-order.sql in Neon SQL Editor.' },
        { status: 409 }
      );
    }
    console.error('reorder goals error', err);
    return NextResponse.json({ error: 'Could not save the new order.' }, { status: 500 });
  }
}
