import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import InvestmentsClient from './InvestmentsClient';

export default async function InvestmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <InvestmentsClient user={user} />;
}
