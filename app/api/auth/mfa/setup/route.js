import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { sql } from '@/lib/db';
import { buildMfaOtpauthUrl, generateMfaSecret, getCurrentUser } from '@/lib/auth';
import { logSecurityEvent } from '@/lib/security';

export async function POST(req) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    const secret = generateMfaSecret(me.email || me.id);
    const otpauthUrl = buildMfaOtpauthUrl(me.email || me.id, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    await sql`
      UPDATE users
      SET mfa_pending_secret = ${secret}
      WHERE id = ${me.id}
    `;

    await logSecurityEvent({ req, userId: me.id, eventType: 'mfa_setup', status: 'pending' });
    return NextResponse.json({ otpauthUrl, qrCodeDataUrl, manualSecret: secret });
  } catch (err) {
    console.error('mfa setup error', err);
    return NextResponse.json({ error: 'Could not start MFA setup.' }, { status: 500 });
  }
}
