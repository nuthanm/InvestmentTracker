import crypto from 'crypto';
import { cookies } from 'next/headers';
import { unstable_noStore as noStore } from 'next/cache';
import { sql } from './db';
import { hashPassword, verifyPassword } from './auth';
import { hashToken, generateRawToken } from './security';
import {
  attachInvestmentSummaries,
  attachPartialWithdrawals,
  attachRecurringPaymentSummaries,
  isTransactionBased,
} from './investments';

const VIEW_COOKIE = 'inv_view';
const VIEW_HOURS = 24;
const MAX_ATTEMPTS = 5;
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

let tablesReady = null;

function isMissingRelation(err, table) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes(table) && msg.includes('does not exist');
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeViewToken(value) {
  const token = String(value || '').trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export function generateViewPassword() {
  const chars = [];
  while (chars.length < 16) {
    const bytes = crypto.randomBytes(32);
    for (const byte of bytes) {
      if (byte >= 256 - (256 % PASSWORD_ALPHABET.length)) continue;
      chars.push(PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]);
      if (chars.length === 16) break;
    }
  }
  return [0, 4, 8, 12].map((start) => chars.slice(start, start + 4).join('')).join('-');
}

export async function ensureViewTables() {
  if (!tablesReady) {
    tablesReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS portfolio_view_links (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          failed_attempts INT NOT NULL DEFAULT 0,
          locked_until TIMESTAMPTZ,
          revoked_at TIMESTAMPTZ,
          last_viewed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_view_links_active_user
        ON portfolio_view_links (user_id)
        WHERE revoked_at IS NULL
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS portfolio_view_sessions (
          token_hash TEXT PRIMARY KEY,
          link_id UUID NOT NULL REFERENCES portfolio_view_links(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_portfolio_view_sessions_link
        ON portfolio_view_sessions(link_id)
      `;
    })().catch((err) => {
      tablesReady = null;
      throw err;
    });
  }
  await tablesReady;
}

async function findActiveLink(rawToken) {
  const token = normalizeViewToken(rawToken);
  if (!token) return null;
  const rows = await sql`
    SELECT id, user_id, password_hash, failed_attempts, locked_until
    FROM portfolio_view_links
    WHERE token_hash = ${hashToken(token)} AND revoked_at IS NULL
    LIMIT 1
  `;
  return rows[0] || null;
}

function viewCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: VIEW_HOURS * 60 * 60,
  };
}

async function createViewSession(linkId) {
  const raw = generateRawToken();
  await sql`
    INSERT INTO portfolio_view_sessions (token_hash, link_id, expires_at)
    VALUES (${hashToken(raw)}, ${linkId}, now() + interval '24 hours')
  `;
  cookies().set(VIEW_COOKIE, raw, viewCookieOptions());
}

export async function getViewLinkStatus(userId) {
  await ensureViewTables();
  const rows = await sql`
    SELECT created_at, last_viewed_at, locked_until
    FROM portfolio_view_links
    WHERE user_id = ${userId} AND revoked_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (!rows[0]) return { active: false };
  return {
    active: true,
    createdAt: rows[0].created_at,
    lastViewedAt: rows[0].last_viewed_at,
    lockedUntil: rows[0].locked_until,
  };
}

export async function issueViewLink(userId) {
  await ensureViewTables();
  const rawToken = generateRawToken();
  const password = generateViewPassword();
  const passwordHash = await hashPassword(password);

  const existing = await sql`
    SELECT id
    FROM portfolio_view_links
    WHERE user_id = ${userId} AND revoked_at IS NULL
  `;
  if (existing.length) {
    const ids = existing.map((row) => row.id);
    await sql`DELETE FROM portfolio_view_sessions WHERE link_id = ANY(${ids})`;
    await sql`
      UPDATE portfolio_view_links
      SET revoked_at = now()
      WHERE user_id = ${userId} AND revoked_at IS NULL
    `;
  }

  const created = await sql`
    INSERT INTO portfolio_view_links (user_id, token_hash, password_hash)
    VALUES (${userId}, ${hashToken(rawToken)}, ${passwordHash})
    RETURNING created_at
  `;

  return {
    path: `/view/${rawToken}`,
    password,
    createdAt: created[0]?.created_at || new Date().toISOString(),
  };
}

export async function revokeViewLink(userId) {
  await ensureViewTables();
  const rows = await sql`
    UPDATE portfolio_view_links
    SET revoked_at = now()
    WHERE user_id = ${userId} AND revoked_at IS NULL
    RETURNING id
  `;
  if (!rows.length) return false;
  await sql`DELETE FROM portfolio_view_sessions WHERE link_id = ANY(${rows.map((row) => row.id)})`;
  return true;
}

export async function unlockViewLink(rawToken, password) {
  await ensureViewTables();
  const link = await findActiveLink(rawToken);
  if (!link) {
    return { ok: false, status: 404, error: 'This view link is not active.' };
  }

  if (link.locked_until && new Date(link.locked_until).getTime() > Date.now()) {
    return {
      ok: false,
      status: 429,
      error: 'Too many attempts. This link is paused for 15 minutes.',
      userId: link.user_id,
    };
  }

  const matches = await verifyPassword(String(password || ''), link.password_hash);
  if (!matches) {
    const attempts = Number(link.failed_attempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await sql`
        UPDATE portfolio_view_links
        SET failed_attempts = 0, locked_until = now() + interval '15 minutes'
        WHERE id = ${link.id} AND revoked_at IS NULL
      `;
      return {
        ok: false,
        status: 429,
        error: 'Too many attempts. This link is paused for 15 minutes.',
        userId: link.user_id,
      };
    }
    await sql`
      UPDATE portfolio_view_links
      SET failed_attempts = ${attempts}
      WHERE id = ${link.id} AND revoked_at IS NULL
    `;
    return { ok: false, status: 401, error: 'Incorrect password.', userId: link.user_id };
  }

  await sql`
    UPDATE portfolio_view_links
    SET failed_attempts = 0, locked_until = NULL, last_viewed_at = now()
    WHERE id = ${link.id} AND revoked_at IS NULL
  `;
  await createViewSession(link.id);
  return { ok: true, userId: link.user_id };
}

export async function getViewAccess(rawToken) {
  noStore();
  await ensureViewTables();
  const token = normalizeViewToken(rawToken);
  const sessionToken = cookies().get(VIEW_COOKIE)?.value;
  if (!token || !sessionToken || sessionToken.length > 128) return null;

  const rows = await sql`
    SELECT l.user_id, u.name AS owner_name, s.expires_at
    FROM portfolio_view_sessions s
    JOIN portfolio_view_links l ON l.id = s.link_id
    JOIN users u ON u.id = l.user_id
    WHERE s.token_hash = ${hashToken(sessionToken)}
      AND l.token_hash = ${hashToken(token)}
      AND l.revoked_at IS NULL
      AND s.expires_at > now()
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return {
    userId: rows[0].user_id,
    ownerName: rows[0].owner_name,
    expiresAt: rows[0].expires_at,
  };
}

export async function destroyViewSession() {
  const sessionToken = cookies().get(VIEW_COOKIE)?.value;
  if (sessionToken) {
    try {
      await sql`DELETE FROM portfolio_view_sessions WHERE token_hash = ${hashToken(sessionToken)}`;
    } catch {
      // The table may not exist yet. Clearing the cookie is still the right outcome.
    }
  }
  cookies().set(VIEW_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function viewLinkIsActive(rawToken) {
  noStore();
  await ensureViewTables();
  const link = await findActiveLink(rawToken);
  return !!link;
}

async function loadInvestments(userId) {
  const investments = await sql`
    SELECT i.*, g.name AS goal_name,
      (SELECT COUNT(*) FROM documents WHERE investment_id = i.id) AS document_count
    FROM investments i
    LEFT JOIN goals g ON g.id = i.goal_id
    WHERE i.user_id = ${userId}
    ORDER BY i.created_at DESC
  `;

  const transactionIds = investments
    .filter((investment) => isTransactionBased(investment.type_code))
    .map((investment) => investment.id);
  const recurringIds = investments
    .filter((investment) => investment.payment_frequency === 'monthly' || investment.payment_frequency === 'yearly')
    .map((investment) => investment.id);

  let withSummaries = investments;

  if (transactionIds.length > 0) {
    try {
      const transactions = await sql`
        SELECT investment_id, transaction_type, trade_date, units, price_per_unit, total_amount, charges, taxes, notes, created_at, id
        FROM investment_transactions
        WHERE user_id = ${userId} AND investment_id = ANY(${transactionIds})
        ORDER BY trade_date ASC, created_at ASC
      `;
      withSummaries = attachInvestmentSummaries(withSummaries, transactions);
    } catch (err) {
      if (!isMissingRelation(err, 'investment_transactions')) throw err;
    }
  }

  if (recurringIds.length > 0) {
    try {
      const paymentRecords = await sql`
        SELECT investment_id, period_label, due_date, amount, paid, paid_at, notes
        FROM payment_records
        WHERE user_id = ${userId} AND investment_id = ANY(${recurringIds})
        ORDER BY due_date ASC
      `;
      withSummaries = attachRecurringPaymentSummaries(withSummaries, paymentRecords);
    } catch (err) {
      if (!isMissingRelation(err, 'payment_records')) throw err;
    }

    try {
      const withdrawals = await sql`
        SELECT id, investment_id, amount, withdrawn_on, notes
        FROM partial_withdrawals
        WHERE user_id = ${userId} AND investment_id = ANY(${recurringIds})
        ORDER BY withdrawn_on ASC, created_at ASC
      `;
      withSummaries = attachPartialWithdrawals(withSummaries, withdrawals);
    } catch (err) {
      if (!isMissingRelation(err, 'partial_withdrawals')) throw err;
    }
  }

  return withSummaries;
}

export async function loadViewPortfolio(userId) {
  const [ownerRows, investments, goals] = await Promise.all([
    sql`SELECT name FROM users WHERE id = ${userId} LIMIT 1`,
    loadInvestments(userId),
    sql`
      SELECT id, name, description, target_amount, target_date
      FROM goals
      WHERE user_id = ${userId}
      ORDER BY target_date ASC, created_at ASC
    `,
  ]);

  return plain({
    ownerName: ownerRows[0]?.name || 'Portfolio',
    investments,
    goals,
  });
}

export async function loadViewInvestment(userId, investmentId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(investmentId || ''))) return null;

  const rows = await sql`
    SELECT i.*, g.name AS goal_name
    FROM investments i
    LEFT JOIN goals g ON g.id = i.goal_id
    WHERE i.id = ${investmentId} AND i.user_id = ${userId}
    LIMIT 1
  `;
  if (!rows[0]) return null;

  let transactions = [];
  let payments = [];
  let withdrawals = [];
  try {
    transactions = await sql`
      SELECT id, investment_id, transaction_type, trade_date, units, price_per_unit, total_amount, charges, taxes, notes, created_at
      FROM investment_transactions
      WHERE investment_id = ${investmentId} AND user_id = ${userId}
      ORDER BY trade_date DESC, created_at DESC
    `;
  } catch (err) {
    if (!isMissingRelation(err, 'investment_transactions')) throw err;
  }

  try {
    payments = await sql`
      SELECT period_label, due_date, amount, paid, paid_at, notes
      FROM payment_records
      WHERE investment_id = ${investmentId} AND user_id = ${userId}
      ORDER BY due_date ASC
    `;
  } catch (err) {
    if (!isMissingRelation(err, 'payment_records')) throw err;
  }

  try {
    withdrawals = await sql`
      SELECT id, amount, withdrawn_on, notes
      FROM partial_withdrawals
      WHERE investment_id = ${investmentId} AND user_id = ${userId}
      ORDER BY withdrawn_on ASC, created_at ASC
    `;
  } catch (err) {
    if (!isMissingRelation(err, 'partial_withdrawals')) throw err;
  }

  let documentCount = 0;
  try {
    const docs = await sql`
      SELECT COUNT(*)::int AS count
      FROM documents
      WHERE investment_id = ${investmentId}
    `;
    documentCount = Number(docs[0]?.count || 0);
  } catch (err) {
    if (!isMissingRelation(err, 'documents')) throw err;
  }

  const [investment] = attachPartialWithdrawals(
    attachRecurringPaymentSummaries(
      attachInvestmentSummaries(rows, transactions),
      payments.map((payment) => ({ ...payment, investment_id: investmentId })),
    ),
    withdrawals.map((withdrawal) => ({ ...withdrawal, investment_id: investmentId })),
  );

  return plain({
    investment,
    transactions,
    payments,
    withdrawals,
    documentCount,
  });
}
