import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hashPin, createSession, normalizeMobile, validatePin } from '@/lib/auth';

export async function POST(req) {
  try {
    const { name, mobile, pin } = await req.json();
    if (!name || !mobile || !pin) {
      return NextResponse.json({ error: 'Name, mobile, and PIN are required.' }, { status: 400 });
    }
    if (!validatePin(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 6 digits.' }, { status: 400 });
    }
    const normalized = normalizeMobile(mobile);
    if (!normalized) {
      return NextResponse.json({ error: 'Invalid mobile number.' }, { status: 400 });
    }

    const existing = await sql`SELECT id FROM users WHERE mobile = ${normalized} LIMIT 1`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'An account with this mobile already exists. Try logging in.' }, { status: 409 });
    }

    const pinHash = await hashPin(pin);
    const rows = await sql`
      INSERT INTO users (mobile, name, pin_hash)
      VALUES (${normalized}, ${name.trim()}, ${pinHash})
      RETURNING id, mobile, name
    `;
    const user = rows[0];

    await sql`
      INSERT INTO notifications (user_id, title, message)
      VALUES (${user.id}, 'Welcome!', 'Add your first goal or investment to get started.')
    `;

    await createSession(user.id);
    return NextResponse.json({ user });
  } catch (err) {
    console.error('signup error', err);
    return NextResponse.json({ error: 'Could not create account.' }, { status: 500 });
  }
}
