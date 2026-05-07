import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import NewGoalClient from './NewGoalClient';

export default async function NewGoalPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <NewGoalClient user={user} />;
}
