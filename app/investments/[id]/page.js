import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import DetailClient from './DetailClient';

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
  return <DetailClient user={user} investment={rows[0]} documents={documents} />;
}
