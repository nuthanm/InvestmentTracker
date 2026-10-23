import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { loadTransactionInvestment, transactionErrorResponse } from '@/lib/investment-transactions';

export async function GET(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const investment = await loadTransactionInvestment(params.id, me.id);
  if (investment.error) return investment.error;

  try {
    const events = await sql`
      SELECT id, transaction_id, action, before_data, after_data, created_at
      FROM investment_transaction_audit
      WHERE investment_id = ${params.id} AND user_id = ${me.id}
      ORDER BY created_at DESC
      LIMIT 200
    `;
    return NextResponse.json({ events });
  } catch (err) {
    return transactionErrorResponse(err, 'Could not load transaction activity.');
  }
}
