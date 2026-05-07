import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import NewInvestmentClient from './NewInvestmentClient';

export default async function NewInvestmentPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const goals = await sql`SELECT id, name FROM goals WHERE user_id = ${user.id} ORDER BY created_at DESC`;
  return <NewInvestmentClient user={user} goals={goals} />;
}
