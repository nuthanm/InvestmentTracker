import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import {
  destroySession,
  getCurrentUser,
  hashPassword,
  hashRecoveryKey,
  validatePassword,
  validateRecoveryKey,
  verifyPassword,
} from '@/lib/auth';
import { logSecurityEvent } from '@/lib/security';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  const rows = await sql`SELECT mfa_enabled FROM users WHERE id = ${user.id} LIMIT 1`;
  return NextResponse.json({ user: { ...user, mfaEnabled: !!rows[0]?.mfa_enabled } });
}

export async function PATCH(req) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  try {
    const { name, currentPassword, newPassword, newRecoveryKey } = await req.json();

    if (typeof name === 'string' && name.trim()) {
      await sql`UPDATE users SET name = ${name.trim()} WHERE id = ${me.id}`;
    }

    if (newPassword) {
      if (!validatePassword(newPassword)) {
        return NextResponse.json({ error: 'New password must be at least 10 chars with upper, lower, number, and symbol.' }, { status: 400 });
      }
      const rows = await sql`SELECT password_hash FROM users WHERE id = ${me.id} LIMIT 1`;
      const ok = await verifyPassword(currentPassword, rows[0]?.password_hash);
      if (!ok) return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
      const hash = await hashPassword(newPassword);
      await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${me.id}`;
      await logSecurityEvent({ req, userId: me.id, eventType: 'password_change', status: 'success' });
    }

    if (newRecoveryKey) {
      if (!validateRecoveryKey(newRecoveryKey)) {
        return NextResponse.json({ error: 'Recovery key must be at least 8 characters.' }, { status: 400 });
      }
      const rows = await sql`SELECT password_hash FROM users WHERE id = ${me.id} LIMIT 1`;
      const ok = await verifyPassword(currentPassword, rows[0]?.password_hash);
      if (!ok) return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
      const hash = await hashRecoveryKey(newRecoveryKey.trim());
      await sql`UPDATE users SET recovery_key_hash = ${hash} WHERE id = ${me.id}`;
      await logSecurityEvent({ req, userId: me.id, eventType: 'recovery_key_change', status: 'success' });
    }

    const updated = await sql`SELECT id, mobile, email, name, mfa_enabled FROM users WHERE id = ${me.id} LIMIT 1`;
    return NextResponse.json({ user: { ...updated[0], mfaEnabled: !!updated[0]?.mfa_enabled } });
  } catch (err) {
    console.error('me PATCH error', err);
    return NextResponse.json({ error: 'Could not update.' }, { status: 500 });
  }
}

export async function DELETE(req) {
  const me = await getCurrentUser();
  await destroySession();
  if (me?.id) {
    await logSecurityEvent({ req, userId: me.id, eventType: 'logout', status: 'success' });
  }
  return NextResponse.json({ ok: true });
}
