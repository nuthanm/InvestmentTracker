import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { isMarketInvestment, isMetalInvestment, missingLiquidityColumn } from '@/lib/investments';

export async function PATCH(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    const body = await req.json();
    const forLiquidity = body.for_liquidity === true || body.for_liquidity === 'true';

    const currentRows = await sql`
      SELECT id, type_code, amount
      FROM investments
      WHERE id = ${params.id} AND user_id = ${me.id}
      LIMIT 1
    `;
    if (currentRows.length === 0) {
      return NextResponse.json({ error: 'Investment not found.' }, { status: 404 });
    }

    const current = currentRows[0];
    const keepHolding = isMarketInvestment(current.type_code) || isMetalInvestment(current.type_code);
    const rows = forLiquidity && !keepHolding
      ? await sql`
          UPDATE investments
          SET
            for_liquidity = TRUE,
            type_code = 'OT',
            custom_type = 'Savings',
            rate_pct = 0,
            tenure_months = 0,
            tenure_days = 0,
            compounding = 'simple',
            payment_frequency = 'lump_sum',
            maturity_date = NULL,
            maturity_value = amount,
            auto_renew = FALSE
          WHERE id = ${params.id} AND user_id = ${me.id}
          RETURNING id, for_liquidity
        `
      : await sql`
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
