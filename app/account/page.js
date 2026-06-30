import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import Shell from '@/components/Shell';
import AccountClient from './AccountClient';

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return (
    <Shell user={user}>
      <AccountClient user={user} />
    </Shell>
  );
}
