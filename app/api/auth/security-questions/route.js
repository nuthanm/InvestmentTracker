import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { normalizeEmail } from '@/lib/auth';

export async function GET(req) {
  try {
    const email = req.nextUrl.searchParams.get('email');
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    const rows = await sql`SELECT id FROM users WHERE email = ${normalizedEmail} LIMIT 1`;
    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = rows[0].id;
    const questions = await sql`
      SELECT id, question FROM user_security_questions
      WHERE user_id = ${userId}
      ORDER BY question
    `;

    return NextResponse.json({ questions });
  } catch (err) {
    console.error('get security questions error', err);
    return NextResponse.json({ error: 'Could not fetch questions' }, { status: 500 });
  }
}
