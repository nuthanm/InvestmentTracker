import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import DetailClient from './DetailClient';
import { isMarketInvestment, isMetalInvestment, summarizeMarketTransactions } from '@/lib/investments';

function missingTransactionsTable(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('investment_transactions') && msg.includes('does not exist');
}

export default async function InvestmentDetailPage({ params }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const rows = await sql`
    SELECT i.*, g.name AS goal_name
    FROM investments i
    LEFT JOIN goals g ON g.id = i.goal_id
    WHERE i.id = ${params.id} AND i.user_id = ${user.id}
    LIMIT 1
  `;
  if (rows.length === 0) notFound();

  const documents = await sql`
    SELECT id, filename, size_bytes, page_count, data_url
    FROM documents WHERE investment_id = ${params.id}
    ORDER BY created_at ASC
  `;

  let marketTransactions = [];
  let marketSummary = null;
  let marketWarning = '';

  if (isMarketInvestment(rows[0].type_code) || isMetalInvestment(rows[0].type_code)) {
    try {
      marketTransactions = await sql`
        SELECT id, investment_id, transaction_type, trade_date, units, price_per_unit, total_amount, charges, taxes, notes, created_at
        FROM investment_transactions
        WHERE investment_id = ${params.id} AND user_id = ${user.id}
        ORDER BY trade_date DESC, created_at DESC
      `;
      marketSummary = summarizeMarketTransactions(marketTransactions);
    } catch (err) {
      if (!missingTransactionsTable(err)) throw err;
      marketWarning = 'Market transactions are not available yet. Run db/migrations/2026-06-22-add-market-investment-transactions.sql in Neon SQL Editor.';
      marketSummary = summarizeMarketTransactions([]);
    }
  }

  const goals = await sql`SELECT id, name FROM goals WHERE user_id = ${user.id} ORDER BY created_at DESC`;

  return <DetailClient user={user} investment={rows[0]} documents={documents} marketTransactions={marketTransactions} marketSummary={marketSummary} marketWarning={marketWarning} goals={goals} />;
}
