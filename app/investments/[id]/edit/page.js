import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import NewInvestmentClient from '../../new/NewInvestmentClient';

export default async function EditInvestmentPage({ params }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [rows, goals, documents] = await Promise.all([
    sql`
      SELECT i.*, g.name AS goal_name
      FROM investments i
      LEFT JOIN goals g ON g.id = i.goal_id
      WHERE i.id = ${params.id} AND i.user_id = ${user.id}
      LIMIT 1
    `,
    sql`SELECT id, name FROM goals WHERE user_id = ${user.id} ORDER BY created_at DESC`,
    sql`
      SELECT id, filename, size_bytes, page_count, data_url
      FROM documents
      WHERE investment_id = ${params.id}
      ORDER BY created_at ASC
    `,
  ]);

  if (rows.length === 0) notFound();

  return (
    <NewInvestmentClient
      user={user}
      goals={goals}
      mode="edit"
      initialInvestment={rows[0]}
      initialDocuments={documents}
    />
  );
}
