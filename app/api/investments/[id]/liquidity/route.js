import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { missingLiquidityColumn } from '@/lib/investments';

export async function PATCH(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    const body = await req.json();
    const forLiquidity = body.for_liquidity === true || body.for_liquidity === 'true';

    const rows = await sql`
      UPDATE investments
      SET for_liquidity = ${forLiquidity}
      WHERE id = ${params.id} AND user_id = ${me.id}
      RETURNING id, for_liquidity
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Investment not found.' }, { status: 404 });
    }

    return NextResponse.json({ investment: rows[0] });
  } catch (err) {
    console.error('update liquidity flag error', err);
    if (missingLiquidityColumn(err)) {
      return NextResponse.json(
        { error: 'Database schema is out of date. Run db/migrations/2026-10-31-add-for-liquidity.sql in Neon SQL Editor, then try again.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Could not update this investment.' }, { status: 500 });
  }
}
