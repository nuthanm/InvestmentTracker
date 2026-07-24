import { buildChitSchedule, isChitInvestment, prepareChitForSave } from '@/lib/chit';
import { buildRecurringPaymentSchedule } from '@/lib/investments';

export function missingChitDetailsColumn(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('chit_details') && (msg.includes('does not exist') || err?.code === '42703');
}

export function resolveChitWrite(body) {
  if (!isChitInvestment(body?.type_code)) return null;

  const tenureMonths = Math.floor(Number(body.tenure_months) || 0);
  const prepared = prepareChitForSave(body.chit_details || body, tenureMonths);
  if (prepared.error) return { error: prepared.error };

  return {
    amount: prepared.amount,
    rate_pct: prepared.rate_pct,
    maturity_value: prepared.maturity_value,
    payment_frequency: 'monthly',
    tenure_months: tenureMonths,
    tenure_days: 0,
    compounding: 'simple',
    auto_renew: false,
    chit_details: prepared.details,
    schedule: buildChitSchedule(prepared.details, tenureMonths, prepared.details.pick_month),
  };
}

/** Upsert payment_records from the recurring schedule (variable amounts for CHIT). */
export async function seedPaymentRecords(sql, { investment, userId }) {
  const schedule = buildRecurringPaymentSchedule(investment);
  if (!schedule.length) return;

  for (const slot of schedule) {
    await sql`
      INSERT INTO payment_records (investment_id, user_id, period_label, due_date, amount, paid, paid_at)
      VALUES (
        ${investment.id}, ${userId}, ${slot.period_label}, ${slot.due_date}, ${slot.amount},
        FALSE, NULL
      )
      ON CONFLICT (investment_id, period_label) DO UPDATE SET
        due_date = EXCLUDED.due_date,
        amount = EXCLUDED.amount
    `;
  }
}
