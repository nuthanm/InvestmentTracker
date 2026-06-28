import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import SecurityActivityClient from './SecurityActivityClient';

export const metadata = {
  title: 'Security Activity',
  description: 'Search and review account security events.',
};

export default async function SecurityActivityPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <SecurityActivityClient user={user} />;
}
