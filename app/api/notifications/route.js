import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const notifications = await sql`
    SELECT * FROM notifications WHERE user_id = ${me.id}
    ORDER BY created_at DESC LIMIT 50
  `;
  const unreadCount = notifications.filter((n) => !n.read).length;
  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  try {
    const { id, all } = await req.json();
    if (all) {
      await sql`UPDATE notifications SET read = true WHERE user_id = ${me.id}`;
    } else if (id) {
      await sql`UPDATE notifications SET read = true WHERE id = ${id} AND user_id = ${me.id}`;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Could not update.' }, { status: 500 });
  }
}
