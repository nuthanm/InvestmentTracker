import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import {
  createSession,
  hashPassword,
  hashRecoveryKey,
  normalizeEmail,
  validateEmail,
  validatePassword,
  validateRecoveryKey,
} from '@/lib/auth';
import { logSecurityEvent } from '@/lib/security';

export async function POST(req) {
  try {
    const { name, email, password, recoveryKey, acceptedLegal } = await req.json();
    if (!name || !email || !password || !recoveryKey) {
      return NextResponse.json({ error: 'Name, email, password, and recovery key are required.' }, { status: 400 });
    }
    if (!acceptedLegal) {
      return NextResponse.json({ error: 'You must accept Terms and Privacy Policy.' }, { status: 400 });
    }
    if (!validateEmail(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    if (!validatePassword(password)) {
      return NextResponse.json({ error: 'Password must be at least 10 chars with upper, lower, number, and symbol.' }, { status: 400 });
    }
    if (!validateRecoveryKey(recoveryKey)) {
      return NextResponse.json({ error: 'Recovery key must be at least 8 characters.' }, { status: 400 });
    }
    const normalizedEmail = normalizeEmail(email);

    const existing = await sql`SELECT id FROM users WHERE email = ${normalizedEmail} LIMIT 1`;
    if (existing.length > 0) {
      await logSecurityEvent({ req, eventType: 'signup', status: 'failed', meta: { reason: 'email_exists' } });
      return NextResponse.json({ error: 'An account with this email already exists. Try logging in.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const recoveryKeyHash = await hashRecoveryKey(recoveryKey.trim());
    let rows;
    try {
      rows = await sql`
        INSERT INTO users (name, email, password_hash, recovery_key_hash, legal_accepted_at)
        VALUES (${name.trim()}, ${normalizedEmail}, ${passwordHash}, ${recoveryKeyHash}, now())
        RETURNING id, mobile, email, name
      `;
    } catch {
      rows = await sql`
        INSERT INTO users (name, email, password_hash, recovery_key_hash)
        VALUES (${name.trim()}, ${normalizedEmail}, ${passwordHash}, ${recoveryKeyHash})
        RETURNING id, mobile, email, name
      `;
    }
    const user = rows[0];

    await sql`
      INSERT INTO notifications (user_id, title, message)
      VALUES (${user.id}, 'Welcome!', 'Add your first goal or investment to get started.')
    `;

    await createSession(user.id);
    await logSecurityEvent({ req, userId: user.id, eventType: 'signup', status: 'success' });
    return NextResponse.json({ user });
  } catch (err) {
    console.error('signup error', err);
    return NextResponse.json({ error: 'Could not create account.' }, { status: 500 });
  }
}
