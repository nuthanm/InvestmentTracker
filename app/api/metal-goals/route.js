import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

function missingColumns(err) {
  const msg = String(err?.message || '').toLowerCase();
  return (msg.includes('gold_target_g') || msg.includes('silver_target_g')) && msg.includes('does not exist');
}

function missingTable(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('user_settings') && msg.includes('does not exist');
}

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    const rows = await sql`
      SELECT gold_target_g, silver_target_g
      FROM user_settings
      WHERE user_id = ${me.id}
    `;
    if (rows.length === 0) return NextResponse.json({ gold_target_g: null, silver_target_g: null });
    return NextResponse.json({
      gold_target_g: rows[0].gold_target_g ? Number(rows[0].gold_target_g) : null,
      silver_target_g: rows[0].silver_target_g ? Number(rows[0].silver_target_g) : null,
    });
  } catch (err) {
    if (missingTable(err) || missingColumns(err)) {
      return NextResponse.json({ gold_target_g: null, silver_target_g: null });
    }
    throw err;
  }
}

export async function PUT(req) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    const body = await req.json();
    const hasGold = Object.prototype.hasOwnProperty.call(body, 'gold_target_g');
    const hasSilver = Object.prototype.hasOwnProperty.call(body, 'silver_target_g');

    if (!hasGold && !hasSilver) {
      return NextResponse.json({ error: 'Send at least one goal field to update.' }, { status: 400 });
    }

    const goldG = hasGold
      ? (body.gold_target_g != null ? Number(body.gold_target_g) : null)
      : null;
    const silvG = hasSilver
      ? (body.silver_target_g != null ? Number(body.silver_target_g) : null)
      : null;

    if (goldG !== null && goldG < 0) {
      return NextResponse.json({ error: 'Gold target must be positive.' }, { status: 400 });
    }
    if (silvG !== null && silvG < 0) {
      return NextResponse.json({ error: 'Silver target must be positive.' }, { status: 400 });
    }

    await sql`
      INSERT INTO user_settings (user_id, gold_target_g, silver_target_g, updated_at)
      VALUES (${me.id}, ${goldG}, ${silvG}, now())
      ON CONFLICT (user_id) DO UPDATE
      SET gold_target_g   = CASE WHEN ${hasGold} THEN EXCLUDED.gold_target_g ELSE user_settings.gold_target_g END,
          silver_target_g = CASE WHEN ${hasSilver} THEN EXCLUDED.silver_target_g ELSE user_settings.silver_target_g END,
            updated_at      = now()
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (missingTable(err) || missingColumns(err)) {
      return NextResponse.json(
        { error: 'Database schema is out of date. Run db/migrations/2026-07-01-add-metal-goals.sql in Neon SQL Editor.' },
        { status: 409 }
      );
    }
    console.error('metal-goals PUT error', err);
    return NextResponse.json({ error: 'Could not save metal goals.' }, { status: 500 });
  }
}

export async function DELETE() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    await sql`
      UPDATE user_settings
      SET gold_target_g = NULL, silver_target_g = NULL, updated_at = now()
      WHERE user_id = ${me.id}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (missingTable(err) || missingColumns(err)) return NextResponse.json({ ok: true });
    throw err;
  }
}
