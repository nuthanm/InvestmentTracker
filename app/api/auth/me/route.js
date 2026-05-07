import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, destroySession, hashPin, verifyPin, validatePin } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}

export async function PATCH(req) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  try {
    const { name, currentPin, newPin } = await req.json();

    if (typeof name === 'string' && name.trim()) {
      await sql`UPDATE users SET name = ${name.trim()} WHERE id = ${me.id}`;
    }

    if (newPin) {
      if (!validatePin(newPin)) {
        return NextResponse.json({ error: 'New PIN must be 6 digits.' }, { status: 400 });
      }
      const rows = await sql`SELECT pin_hash FROM users WHERE id = ${me.id} LIMIT 1`;
      const ok = await verifyPin(currentPin, rows[0].pin_hash);
      if (!ok) return NextResponse.json({ error: 'Current PIN is incorrect.' }, { status: 401 });
      const hash = await hashPin(newPin);
      await sql`UPDATE users SET pin_hash = ${hash} WHERE id = ${me.id}`;
    }

    const updated = await sql`SELECT id, mobile, name FROM users WHERE id = ${me.id} LIMIT 1`;
    return NextResponse.json({ user: updated[0] });
  } catch (err) {
    console.error('me PATCH error', err);
    return NextResponse.json({ error: 'Could not update.' }, { status: 500 });
  }
}

export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
