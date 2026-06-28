import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import {
  normalizeEmail,
  validateEmail,
  validateRecoveryKey,
  verifyRecoveryKey,
} from '@/lib/auth';
import { createPasswordResetToken, logSecurityEvent } from '@/lib/security';

export async function POST(req) {
  try {
    const { email, recoveryKey } = await req.json();
    if (!email || !recoveryKey || !validateEmail(email) || !validateRecoveryKey(recoveryKey)) {
      return NextResponse.json({ error: 'Valid email and recovery key are required.' }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    const rows = await sql`SELECT id, recovery_key_hash FROM users WHERE email = ${normalizedEmail} LIMIT 1`;
    if (rows.length === 0) {
      await logSecurityEvent({ req, eventType: 'password_reset_request', status: 'failed', meta: { reason: 'invalid_email_or_key' } });
      return NextResponse.json({ error: 'Invalid email or recovery key.' }, { status: 401 });
    }

    const user = rows[0];
    const validRecovery = await verifyRecoveryKey(recoveryKey.trim(), user.recovery_key_hash);
    if (!validRecovery) {
      await logSecurityEvent({ req, userId: user.id, eventType: 'password_reset_request', status: 'failed', meta: { reason: 'invalid_email_or_key' } });
      return NextResponse.json({ error: 'Invalid email or recovery key.' }, { status: 401 });
    }

    const userId = user.id;
    const token = await createPasswordResetToken(userId);
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const resetUrl = `${base}/reset-password?token=${token}`;

    await logSecurityEvent({ req, userId, eventType: 'password_reset_request', status: 'success' });
    return NextResponse.json({ ok: true, resetUrl });
  } catch (err) {
    console.error('password request error', err);
    return NextResponse.json({ error: 'Could not process reset request.' }, { status: 500 });
  }
}
