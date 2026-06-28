import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { destroySession, getCurrentUser, verifyPassword } from '@/lib/auth';
import { logSecurityEvent } from '@/lib/security';

export async function POST(req) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    const { currentPassword, confirmText } = await req.json();

    if (!currentPassword) {
      return NextResponse.json({ error: 'Current password is required.' }, { status: 400 });
    }
    if (String(confirmText || '').trim().toUpperCase() !== 'DELETE') {
      return NextResponse.json({ error: 'Type DELETE to confirm account deletion.' }, { status: 400 });
    }

    const rows = await sql`SELECT password_hash FROM users WHERE id = ${me.id} LIMIT 1`;
    const ok = await verifyPassword(currentPassword, rows[0]?.password_hash);
    if (!ok) {
      await logSecurityEvent({ req, userId: me.id, eventType: 'account_delete', status: 'failed' });
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
    }

    await logSecurityEvent({ req, userId: me.id, eventType: 'account_delete', status: 'success' });
    await sql`DELETE FROM users WHERE id = ${me.id}`;
    await destroySession();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('account delete error', err);
    return NextResponse.json({ error: 'Could not delete account right now.' }, { status: 500 });
  }
}
