import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import Shell from '@/components/Shell';
import SecurityActivityClient from './SecurityActivityClient';

export const metadata = {
  title: 'Security Activity',
  description: 'Search and review account security events.',
};

export default async function SecurityActivityPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return (
    <Shell user={user}>
      <SecurityActivityClient user={user} />
    </Shell>
  );
}
