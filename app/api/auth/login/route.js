import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import {
  createSession,
  normalizeEmail,
  normalizeMobile,
  validateEmail,
  validatePin,
  verifyPassword,
  verifyPin,
} from '@/lib/auth';
import { createLoginChallenge, logSecurityEvent } from '@/lib/security';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function POST(req) {
  try {
    const { email, password, mobile, pin } = await req.json();

    if (mobile || pin) {
      if (!mobile || !pin) {
        return NextResponse.json({ error: 'Mobile and PIN are required.' }, { status: 400 });
      }
      if (!validatePin(pin)) {
        return NextResponse.json({ error: 'PIN must be exactly 6 digits.' }, { status: 400 });
      }

      const normalizedMobile = normalizeMobile(mobile);
      const rows = await sql`
        SELECT id, mobile, email, name, pin_hash
        FROM users
        WHERE mobile = ${normalizedMobile}
        LIMIT 1
      `;
      if (rows.length === 0) {
        return NextResponse.json({ error: 'No account found for this mobile.' }, { status: 404 });
      }
      const user = rows[0];
      const ok = await verifyPin(pin, user.pin_hash);
      if (!ok) {
        await logSecurityEvent({ req, userId: user.id, eventType: 'login_legacy', status: 'failed' });
        return NextResponse.json({ error: 'Wrong PIN. Try again.' }, { status: 401 });
      }

      await createSession(user.id);
      await logSecurityEvent({ req, userId: user.id, eventType: 'login_legacy', status: 'success' });
      return NextResponse.json({
        user: { id: user.id, mobile: user.mobile, email: user.email, name: user.name },
        upgradeRecommended: true,
      });
    }

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }
    if (!validateEmail(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    const rows = await sql`
      SELECT id, mobile, email, name, password_hash, failed_login_attempts, locked_until, mfa_enabled
      FROM users
      WHERE email = ${normalizedEmail}
      LIMIT 1
    `;
    if (rows.length === 0) {
      await logSecurityEvent({ req, eventType: 'login_password', status: 'failed', meta: { reason: 'email_not_found' } });
      return NextResponse.json({ error: 'No account found for this email. Please sign up first.' }, { status: 404 });
    }

    const user = rows[0];
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      await logSecurityEvent({ req, userId: user.id, eventType: 'login_password', status: 'failed', meta: { reason: 'account_locked' } });
      return NextResponse.json({ error: 'Account temporarily locked. Try again later.' }, { status: 423 });
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      const nextFailed = Number(user.failed_login_attempts || 0) + 1;
      if (nextFailed >= MAX_FAILED_ATTEMPTS) {
        await sql`
          UPDATE users
          SET failed_login_attempts = ${nextFailed},
              locked_until = now() + (${LOCK_MINUTES} * interval '1 minute')
          WHERE id = ${user.id}
        `;
      } else {
        await sql`
          UPDATE users
          SET failed_login_attempts = ${nextFailed}
          WHERE id = ${user.id}
        `;
      }
      await logSecurityEvent({ req, userId: user.id, eventType: 'login_password', status: 'failed' });
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
    }

    await sql`
      UPDATE users
      SET failed_login_attempts = 0,
          locked_until = NULL,
          last_login_at = now()
      WHERE id = ${user.id}
    `;

    if (user.mfa_enabled) {
      const challengeToken = await createLoginChallenge(user.id);
      await logSecurityEvent({ req, userId: user.id, eventType: 'login_password', status: 'mfa_pending' });
      return NextResponse.json({ mfaRequired: true, challengeToken });
    }

    await createSession(user.id);
    await logSecurityEvent({ req, userId: user.id, eventType: 'login_password', status: 'success' });
    return NextResponse.json({ user: { id: user.id, mobile: user.mobile, email: user.email, name: user.name } });
  } catch (err) {
    console.error('login error', err);
    return NextResponse.json({ error: 'Could not log in.' }, { status: 500 });
  }
}
