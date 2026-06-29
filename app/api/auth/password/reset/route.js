import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hashPassword, validatePassword } from '@/lib/auth';
import { consumePasswordResetToken, logSecurityEvent } from '@/lib/security';

export async function POST(req) {
  try {
    const { token, newPassword } = await req.json();
    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Reset token and new password are required.' }, { status: 400 });
    }
    if (!validatePassword(newPassword)) {
      return NextResponse.json({ error: 'Password must be at least 8 chars with uppercase, lowercase, number, and symbol.' }, { status: 400 });
    }

    const userId = await consumePasswordResetToken(token);
    if (!userId) {
      await logSecurityEvent({ req, eventType: 'password_reset_confirm', status: 'failed', meta: { reason: 'bad_token' } });
      return NextResponse.json({ error: 'Invalid or expired reset token.' }, { status: 401 });
    }

    const hash = await hashPassword(newPassword);
    await sql`
      UPDATE users
      SET password_hash = ${hash},
          failed_login_attempts = 0,
          locked_until = NULL
      WHERE id = ${userId}
    `;

    await sql`DELETE FROM sessions WHERE user_id = ${userId}`;
    await logSecurityEvent({ req, userId, eventType: 'password_reset_confirm', status: 'success' });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('password reset error', err);
    return NextResponse.json({ error: 'Could not reset password.' }, { status: 500 });
  }
}
