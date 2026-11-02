import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { computeMaturity, computeRecurringMaturity, addMonths } from '@/lib/format';
import { isMarketInvestment, isMetalInvestment, missingLiquidityColumn } from '@/lib/investments';
import { isChitInvestment } from '@/lib/chit';
import { missingChitDetailsColumn, resolveChitWrite, seedPaymentRecords } from '@/lib/chit-api';
import { documentUploadError } from '@/lib/documents';
import { readOptionalTagNames } from '@/lib/tags';
import { attachInvestmentTags, replaceInvestmentTags } from '@/lib/tag-store';

function missingPaymentRecordsTable(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('payment_records') && msg.includes('does not exist');
}

function parseDateInput(value, fallback) {
  const dt = value ? new Date(value) : fallback ? new Date(fallback) : new Date();
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

async function syncDocuments(sql, investmentId, documents) {
  if (!Array.isArray(documents)) return;

  const existingDocs = await sql`
    SELECT id
    FROM documents
    WHERE investment_id = ${investmentId}
  `;
  const nextDocIds = new Set();
  for (const doc of documents) {
    if (doc.id) nextDocIds.add(String(doc.id));
  }
  const docIdsToDelete = existingDocs.filter((doc) => !nextDocIds.has(String(doc.id))).map((doc) => doc.id);

  if (docIdsToDelete.length) {
    await sql`
      DELETE FROM documents
      WHERE investment_id = ${investmentId} AND id = ANY(${docIdsToDelete})
    `;
  }

  const newDocuments = [];
  for (const doc of documents) {
    if (doc.id || !doc.filename || !doc.data_url) continue;
    newDocuments.push({
      filename: doc.filename,
      size_bytes: doc.size_bytes || 0,
      page_count: doc.page_count || 1,
      data_url: doc.data_url,
    });
  }

  if (newDocuments.length) {
    await sql`
      INSERT INTO documents (investment_id, filename, size_bytes, page_count, data_url)
      SELECT
        ${investmentId},
        doc.filename,
        doc.size_bytes,
        doc.page_count,
        doc.data_url
      FROM json_to_recordset(${JSON.stringify(newDocuments)}::json) AS doc(
        filename text,
        size_bytes int,
        page_count int,
        data_url text
      )
    `;
  }
}

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
  const [investment] = await attachInvestmentTags(rows);
  return NextResponse.json({ investment, documents });
}

export async function PATCH(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    const currentRows = await sql`
      SELECT *
      FROM investments
      WHERE id = ${params.id} AND user_id = ${me.id}
      LIMIT 1
    `;
    if (currentRows.length === 0) return NextResponse.json({ error: 'Investment not found.' }, { status: 404 });

    const current = currentRows[0];
    const body = await req.json();
    const forLiquidity = body.for_liquidity === true || body.for_liquidity === 'true';
    const marketInvestment = isMarketInvestment(body.type_code);
    const metalInvestment = isMetalInvestment(body.type_code);
    const chitInvestment = isChitInvestment(body.type_code);
    const transactionBasedInvestment = marketInvestment || metalInvestment;
    const required = forLiquidity
      ? ['bank', 'plan_name', 'amount', 'nominee', 'goal_id']
      : transactionBasedInvestment
        ? ['type_code', 'bank', 'plan_name', 'nominee', 'goal_id']
        : chitInvestment
          ? ['type_code', 'bank', 'plan_name', 'tenure_months', 'nominee', 'goal_id']
          : ['type_code', 'bank', 'plan_name', 'amount', 'rate_pct', 'tenure_months', 'nominee', 'goal_id'];

    for (const field of required) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return NextResponse.json({ error: `${field.replace(/_/g, ' ')} is required.` }, { status: 400 });
      }
    }
    if (!forLiquidity && body.type_code === 'OT' && !body.custom_type) {
      return NextResponse.json({ error: 'Please name your custom investment type.' }, { status: 400 });
    }

    const goalRows = await sql`
      SELECT id
      FROM goals
      WHERE id = ${body.goal_id} AND user_id = ${me.id}
      LIMIT 1
    `;
    if (goalRows.length === 0) {
      return NextResponse.json({ error: 'Please select a valid goal.' }, { status: 400 });
    }

    const documentError = documentUploadError(body.documents);
    if (documentError) {
      return NextResponse.json({ error: documentError }, { status: 400 });
    }

    let tagNames;
    try {
      tagNames = readOptionalTagNames(body);
    } catch (err) {
      return NextResponse.json({ error: err.message || 'Tags are invalid.' }, { status: 400 });
    }
    const investmentResponse = async (investment) => {
      if (tagNames === undefined) return NextResponse.json({ investment });
      const tags = await replaceInvestmentTags(me.id, investment.id, tagNames);
      return NextResponse.json({ investment: { ...investment, tags } });
    };

    const startDate = parseDateInput(body.start_date, current.start_date);
    if (!startDate) {
      return NextResponse.json({ error: 'Start date is invalid.' }, { status: 400 });
    }

    if (forLiquidity) {
      if (Number(body.amount) <= 0) {
        return NextResponse.json({ error: 'Balance must be greater than zero.' }, { status: 400 });
      }
      const balance = Number(body.amount);
      const rows = await sql`
        UPDATE investments
        SET
          goal_id = ${body.goal_id},
          type_code = 'OT',
          custom_type = 'Savings',
          bank = ${body.bank.trim()},
          plan_name = ${body.plan_name.trim()},
          amount = ${balance},
          rate_pct = 0,
          tenure_months = 0,
          tenure_days = 0,
          compounding = 'simple',
          payment_frequency = 'lump_sum',
          start_date = ${startDate.toISOString().slice(0, 10)},
          maturity_date = NULL,
          maturity_value = ${balance},
          nominee = ${body.nominee.trim()},
          auto_renew = FALSE,
          account_holder = ${body.account_holder || 'Self'},
          for_liquidity = TRUE
        WHERE id = ${params.id} AND user_id = ${me.id}
        RETURNING *
      `;
      if (rows.length === 0) return NextResponse.json({ error: 'Investment not found.' }, { status: 404 });
      await syncDocuments(sql, params.id, body.documents);
      return investmentResponse(rows[0]);
    }

    if (transactionBasedInvestment) {
      const schemeMonths = Math.floor(Number(body.metal_scheme?.months || 0));
      const schemeMonthly = Number(body.metal_scheme?.monthly_amount || 0);
      const schemePaid = Math.floor(Number(body.metal_scheme?.paid_months || 0));
      const keepScheme = metalInvestment
        && !body.metal_scheme
        && (current.payment_frequency === 'monthly' || current.payment_frequency === 'yearly')
        && Number(current.tenure_months) > 0
        && Number(current.amount) > 0;

      if (metalInvestment && body.metal_scheme) {
        if (!(schemeMonths > 0) || !(schemeMonthly > 0)) {
          return NextResponse.json({ error: 'Enter the scheme months and the monthly amount.' }, { status: 400 });
        }
        if (schemePaid < 0 || schemePaid > schemeMonths) {
          return NextResponse.json({ error: 'Paid months must be between 0 and total scheme months.' }, { status: 400 });
        }
        const maturityDate = addMonths(startDate, schemeMonths);
        const maturityValue = schemeMonthly * schemeMonths;
        const rows = await sql`
          UPDATE investments
          SET
            goal_id = ${body.goal_id},
            type_code = ${body.type_code},
            custom_type = ${body.custom_type || null},
            bank = ${body.bank.trim()},
            plan_name = ${body.plan_name.trim()},
            nominee = ${body.nominee.trim()},
            account_holder = ${body.account_holder || 'Self'},
            start_date = ${startDate.toISOString().slice(0, 10)},
            amount = ${schemeMonthly},
            rate_pct = 0,
            tenure_months = ${schemeMonths},
            tenure_days = 0,
            compounding = 'simple',
            payment_frequency = 'monthly',
            maturity_date = ${maturityDate.toISOString().slice(0, 10)},
            maturity_value = ${maturityValue},
            auto_renew = FALSE,
            for_liquidity = FALSE
          WHERE id = ${params.id} AND user_id = ${me.id}
          RETURNING *
        `;
        if (rows.length === 0) return NextResponse.json({ error: 'Investment not found.' }, { status: 404 });
        try {
          await seedPaymentRecords(sql, { investment: rows[0], userId: me.id });
          await sql`UPDATE payment_records SET paid = FALSE, paid_at = NULL WHERE investment_id = ${params.id}`;
          if (schemePaid > 0) {
            await sql`
              UPDATE payment_records
              SET paid = TRUE, paid_at = due_date
              WHERE investment_id = ${params.id}
                AND id IN (
                  SELECT id FROM payment_records
                  WHERE investment_id = ${params.id}
                  ORDER BY due_date ASC
                  LIMIT ${schemePaid}
                )
            `;
          }
        } catch (err) {
          if (!missingPaymentRecordsTable(err)) throw err;
        }
        await syncDocuments(sql, params.id, body.documents);
        return investmentResponse(rows[0]);
      }

      const rows = await sql`
        UPDATE investments
        SET
          goal_id = ${body.goal_id},
          type_code = ${body.type_code},
          custom_type = ${body.custom_type || null},
          bank = ${body.bank.trim()},
          plan_name = ${body.plan_name.trim()},
          nominee = ${body.nominee.trim()},
          account_holder = ${body.account_holder || 'Self'},
          start_date = ${startDate.toISOString().slice(0, 10)},
          payment_frequency = ${keepScheme ? current.payment_frequency : 'lump_sum'},
          rate_pct = 0,
          tenure_months = ${keepScheme ? current.tenure_months : 0},
          tenure_days = 0,
          compounding = ${keepScheme ? (current.compounding || 'simple') : 'quarterly'},
          maturity_date = ${keepScheme ? current.maturity_date : null},
          maturity_value = ${keepScheme ? current.maturity_value : null},
          auto_renew = FALSE,
          for_liquidity = ${forLiquidity}
        WHERE id = ${params.id} AND user_id = ${me.id}
        RETURNING *
      `;
      if (rows.length === 0) return NextResponse.json({ error: 'Investment not found.' }, { status: 404 });

      await syncDocuments(sql, params.id, body.documents);
      return investmentResponse(rows[0]);
    }

    if (chitInvestment) {
      const chitWrite = resolveChitWrite(body);
      if (chitWrite?.error) {
        return NextResponse.json({ error: chitWrite.error }, { status: 400 });
      }
      const maturityDate = addMonths(startDate, chitWrite.tenure_months);

      let investment;
      try {
        const rows = await sql`
          UPDATE investments
          SET
            goal_id = ${body.goal_id},
            type_code = 'CHIT',
            custom_type = NULL,
            bank = ${body.bank.trim()},
            plan_name = ${body.plan_name.trim()},
            amount = ${chitWrite.amount},
            rate_pct = ${chitWrite.rate_pct},
            tenure_months = ${chitWrite.tenure_months},
            tenure_days = 0,
            compounding = ${chitWrite.compounding},
            payment_frequency = ${chitWrite.payment_frequency},
            start_date = ${startDate.toISOString().slice(0, 10)},
            maturity_date = ${maturityDate.toISOString().slice(0, 10)},
            maturity_value = ${chitWrite.maturity_value},
            nominee = ${body.nominee.trim()},
            auto_renew = FALSE,
            account_holder = ${body.account_holder || 'Self'},
            for_liquidity = ${forLiquidity},
            chit_details = ${JSON.stringify(chitWrite.chit_details)}::jsonb
          WHERE id = ${params.id} AND user_id = ${me.id}
          RETURNING *
        `;
        if (rows.length === 0) return NextResponse.json({ error: 'Investment not found.' }, { status: 404 });
        investment = rows[0];
      } catch (err) {
        if (missingChitDetailsColumn(err)) {
          return NextResponse.json(
            { error: 'Database schema is out of date. Run db/migrations/2026-07-24-add-chit-details.sql in Neon SQL Editor, then try again.' },
            { status: 409 }
          );
        }
        throw err;
      }

      try {
        await seedPaymentRecords(sql, { investment, userId: me.id });
      } catch (err) {
        const msg = String(err?.message || '').toLowerCase();
        if (!(msg.includes('payment_records') && msg.includes('does not exist'))) throw err;
      }

      await syncDocuments(sql, params.id, body.documents);
      return investmentResponse(investment);
    }

    if (Number(body.amount) <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 });
    }
    if (Number(body.rate_pct) <= 0) {
      return NextResponse.json({ error: 'Interest rate must be greater than zero.' }, { status: 400 });
    }
    if (Number(body.tenure_months) <= 0 && Number(body.tenure_days || 0) <= 0) {
      return NextResponse.json({ error: 'Pick a valid tenure.' }, { status: 400 });
    }

    const tenureMonths = Number(body.tenure_months) + (Number(body.tenure_days || 0) / 30);
    const paymentFrequency = body.payment_frequency || 'lump_sum';

    let maturityValue;
    if (paymentFrequency === 'monthly' || paymentFrequency === 'yearly') {
      maturityValue = computeRecurringMaturity({
        amountPerPeriod: Number(body.amount),
        ratePct: Number(body.rate_pct),
        months: tenureMonths,
        paymentFrequency,
      });
    } else {
      maturityValue = computeMaturity({
        amount: Number(body.amount),
        ratePct: Number(body.rate_pct),
        months: tenureMonths,
        compounding: body.compounding || 'quarterly',
      });
    }
    const maturityDate = addMonths(startDate, tenureMonths);

    const rows = await sql`
      UPDATE investments
      SET
        goal_id = ${body.goal_id},
        type_code = ${body.type_code},
        custom_type = ${body.custom_type || null},
        bank = ${body.bank.trim()},
        plan_name = ${body.plan_name.trim()},
        amount = ${body.amount},
        rate_pct = ${body.rate_pct},
        tenure_months = ${body.tenure_months},
        tenure_days = ${body.tenure_days || 0},
        compounding = ${body.compounding || 'quarterly'},
        payment_frequency = ${paymentFrequency},
        start_date = ${startDate.toISOString().slice(0, 10)},
        maturity_date = ${maturityDate.toISOString().slice(0, 10)},
        maturity_value = ${maturityValue},
        nominee = ${body.nominee.trim()},
        auto_renew = ${!!body.auto_renew},
        account_holder = ${body.account_holder || 'Self'},
        for_liquidity = ${forLiquidity}
      WHERE id = ${params.id} AND user_id = ${me.id}
      RETURNING *
    `;
    if (rows.length === 0) return NextResponse.json({ error: 'Investment not found.' }, { status: 404 });

    await syncDocuments(sql, params.id, body.documents);

    return investmentResponse(rows[0]);
  } catch (err) {
    console.error('update investment error', err);
    if (err?.status === 400 && err?.message) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err?.code === '22P02') {
      return NextResponse.json({ error: 'Invalid ID format in request.' }, { status: 400 });
    }
    if (err?.code === '23503') {
      return NextResponse.json({ error: 'Selected goal does not exist.' }, { status: 400 });
    }
    if (missingLiquidityColumn(err)) {
      return NextResponse.json(
        { error: 'Database schema is out of date. Run db/migrations/2026-10-31-add-for-liquidity.sql in Neon SQL Editor, then try again.' },
        { status: 409 }
      );
    }
    if (err?.code === '42703' || missingChitDetailsColumn(err)) {
      return NextResponse.json(
        {
          error:
            'Database schema is out of date. Run the SQL files in db/migrations (including 2026-07-24-add-chit-details.sql) in Neon SQL Editor, then try again.',
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: 'Could not update investment.' }, { status: 500 });
  }
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
