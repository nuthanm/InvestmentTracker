import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listUserTags } from '@/lib/tag-store';

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  try {
    const tags = await listUserTags(me.id);
    return NextResponse.json({ tags });
  } catch (err) {
    console.error('list tags error', err);
    return NextResponse.json({ error: 'Could not load tags.' }, { status: 500 });
  }
}
