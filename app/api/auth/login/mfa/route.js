import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { createSession, verifyTotpToken } from '@/lib/auth';
import { consumeLoginChallenge, logSecurityEvent } from '@/lib/security';

export async function POST(req) {
  try {
    const { challengeToken, code } = await req.json();
    if (!challengeToken || !code) {
      return NextResponse.json({ error: 'Challenge token and verification code are required.' }, { status: 400 });
    }

    const userId = await consumeLoginChallenge(challengeToken);
    if (!userId) {
      return NextResponse.json({ error: 'Challenge expired. Please sign in again.' }, { status: 401 });
    }

    const rows = await sql`
      SELECT id, mobile, email, name, mfa_secret, mfa_enabled
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;
    const user = rows[0];
    if (!user || !user.mfa_enabled || !user.mfa_secret) {
      await logSecurityEvent({ req, userId, eventType: 'login_mfa', status: 'failed', meta: { reason: 'mfa_not_enabled' } });
      return NextResponse.json({ error: 'MFA is not enabled for this account.' }, { status: 400 });
    }

    const ok = verifyTotpToken(code, user.mfa_secret);
    if (!ok) {
      await logSecurityEvent({ req, userId, eventType: 'login_mfa', status: 'failed' });
      return NextResponse.json({ error: 'Invalid verification code.' }, { status: 401 });
    }

    await createSession(userId);
    await logSecurityEvent({ req, userId, eventType: 'login_mfa', status: 'success' });
    return NextResponse.json({ user: { id: user.id, mobile: user.mobile, email: user.email, name: user.name } });
  } catch (err) {
    console.error('login mfa error', err);
    return NextResponse.json({ error: 'Could not verify MFA.' }, { status: 500 });
  }
}
