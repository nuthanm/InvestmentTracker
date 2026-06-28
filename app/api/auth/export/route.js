import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logSecurityEvent } from '@/lib/security';

export async function GET(req) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    const [goals, investments, payments, notifications] = await Promise.all([
      sql`SELECT * FROM goals WHERE user_id = ${me.id} ORDER BY created_at DESC`,
      sql`SELECT * FROM investments WHERE user_id = ${me.id} ORDER BY created_at DESC`,
      sql`SELECT * FROM payment_records WHERE user_id = ${me.id} ORDER BY created_at DESC`,
      sql`SELECT * FROM notifications WHERE user_id = ${me.id} ORDER BY created_at DESC`,
    ]);

    await logSecurityEvent({ req, userId: me.id, eventType: 'data_export', status: 'success' });

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      user: { id: me.id, name: me.name, email: me.email, mobile: me.mobile },
      goals,
      investments,
      payments,
      notifications,
    });
  } catch (err) {
    console.error('data export error', err);
    return NextResponse.json({ error: 'Could not export data.' }, { status: 500 });
  }
}
