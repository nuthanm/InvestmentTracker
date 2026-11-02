import { sql } from '@/lib/db';
import { parseTagNames } from '@/lib/tags';

let tablesReady = null;

export function missingTagsTable(err) {
  const msg = String(err?.message || '').toLowerCase();
  return (msg.includes('tags') || msg.includes('investment_tags'))
    && (msg.includes('does not exist') || err?.code === '42P01');
}

export async function ensureTagTables() {
  if (!tablesReady) {
    tablesReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS tags (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          name_key TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now(),
          UNIQUE (user_id, name_key)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS investment_tags (
          investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
          tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT now(),
          PRIMARY KEY (investment_id, tag_id)
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_investment_tags_tag ON investment_tags(tag_id)
      `;
    })().catch((err) => {
      tablesReady = null;
      throw err;
    });
  }
  await tablesReady;
}

export async function replaceInvestmentTags(userId, investmentId, rawTags) {
  await ensureTagTables();
  const names = parseTagNames(rawTags);
  const keys = names.map((name) => name.toLocaleLowerCase('en-IN'));

  for (let i = 0; i < names.length; i += 1) {
    await sql`
      INSERT INTO tags (user_id, name, name_key)
      VALUES (${userId}, ${names[i]}, ${keys[i]})
      ON CONFLICT (user_id, name_key) DO NOTHING
    `;
  }

  if (!keys.length) {
    await sql`DELETE FROM investment_tags WHERE investment_id = ${investmentId}`;
  } else {
    await sql`
      DELETE FROM investment_tags
      WHERE investment_id = ${investmentId}
        AND tag_id NOT IN (
          SELECT id FROM tags WHERE user_id = ${userId} AND name_key = ANY(${keys})
        )
    `;
    await sql`
      INSERT INTO investment_tags (investment_id, tag_id)
      SELECT ${investmentId}, t.id
      FROM tags t
      WHERE t.user_id = ${userId} AND t.name_key = ANY(${keys})
      ON CONFLICT DO NOTHING
    `;
  }

  await sql`
    DELETE FROM tags t
    WHERE t.user_id = ${userId}
      AND NOT EXISTS (SELECT 1 FROM investment_tags it WHERE it.tag_id = t.id)
  `;

  return loadTagsForInvestments([investmentId]).then((map) => map.get(investmentId) || []);
}

async function loadTagsForInvestments(investmentIds) {
  const grouped = new Map();
  if (!investmentIds.length) return grouped;
  const rows = await sql`
    SELECT it.investment_id, t.id, t.name
    FROM investment_tags it
    JOIN tags t ON t.id = it.tag_id
    WHERE it.investment_id = ANY(${investmentIds})
    ORDER BY t.name ASC
  `;
  for (const row of rows) {
    const list = grouped.get(row.investment_id) || [];
    list.push({ id: row.id, name: row.name });
    grouped.set(row.investment_id, list);
  }
  return grouped;
}

export async function attachInvestmentTags(investments) {
  if (!investments?.length) return investments || [];
  try {
    await ensureTagTables();
    const grouped = await loadTagsForInvestments(investments.map((item) => item.id));
    return investments.map((item) => ({
      ...item,
      tags: grouped.get(item.id) || [],
    }));
  } catch (err) {
    if (missingTagsTable(err)) {
      return investments.map((item) => ({ ...item, tags: item.tags || [] }));
    }
    throw err;
  }
}

export async function listUserTags(userId) {
  await ensureTagTables();
  const rows = await sql`
    SELECT t.id, t.name, COUNT(it.investment_id)::int AS count
    FROM tags t
    LEFT JOIN investment_tags it ON it.tag_id = t.id
    WHERE t.user_id = ${userId}
    GROUP BY t.id, t.name
    ORDER BY t.name ASC
  `;
  return rows.map((row) => ({ id: row.id, name: row.name, count: Number(row.count || 0) }));
}
