import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import GoalsClient from './GoalsClient';

export default async function GoalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <GoalsClient user={user} />;
}
