import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, normalizeMobile, validatePin, verifyPin } from '@/lib/auth';
import { logSecurityEvent } from '@/lib/security';

async function tableExists(tableName) {
  const rows = await sql`SELECT to_regclass(${`public.${tableName}`}) AS table_ref`;
  return !!rows[0]?.table_ref;
}

export async function POST(req) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    const { mobile, pin } = await req.json();
    if (!mobile || !pin) {
      return NextResponse.json({ error: 'Mobile and PIN are required.' }, { status: 400 });
    }
    if (!validatePin(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 6 digits.' }, { status: 400 });
    }

    const normalizedMobile = normalizeMobile(mobile);
    if (!normalizedMobile) {
      return NextResponse.json({ error: 'Invalid mobile number.' }, { status: 400 });
    }

    const legacyRows = await sql`
      SELECT id, mobile, pin_hash, legal_accepted_at
      FROM users
      WHERE mobile = ${normalizedMobile}
      LIMIT 1
    `;
    if (legacyRows.length === 0) {
      if (me.mobile === normalizedMobile) {
        await logSecurityEvent({ req, userId: me.id, eventType: 'legacy_sync', status: 'success', meta: { mode: 'already_synced' } });
        return NextResponse.json({ ok: true, merged: false, message: 'Legacy data is already synced for this account.' });
      }
      await logSecurityEvent({ req, userId: me.id, eventType: 'legacy_sync', status: 'failed', meta: { reason: 'legacy_not_found' } });
      return NextResponse.json({ error: 'No legacy account found for this mobile.' }, { status: 404 });
    }

    const legacy = legacyRows[0];
    if (legacy.id === me.id) {
      await sql`UPDATE users SET pin_hash = NULL WHERE id = ${me.id}`;
      await logSecurityEvent({ req, userId: me.id, eventType: 'legacy_sync', status: 'success', meta: { mode: 'self_cleanup' } });
      return NextResponse.json({ ok: true, merged: false, message: 'Legacy PIN sign-in disabled for this account.' });
    }

    if (!legacy.pin_hash) {
      await logSecurityEvent({ req, userId: me.id, eventType: 'legacy_sync', status: 'failed', meta: { reason: 'legacy_pin_unavailable' } });
      return NextResponse.json({ error: 'Legacy PIN is not available for this mobile account.' }, { status: 400 });
    }

    const ok = await verifyPin(pin, legacy.pin_hash);
    if (!ok) {
      await logSecurityEvent({ req, userId: me.id, eventType: 'legacy_sync', status: 'failed', meta: { reason: 'bad_pin' } });
      return NextResponse.json({ error: 'Invalid PIN for legacy account.' }, { status: 401 });
    }

    await sql`UPDATE goals SET user_id = ${me.id} WHERE user_id = ${legacy.id}`;
    await sql`UPDATE investments SET user_id = ${me.id} WHERE user_id = ${legacy.id}`;

    if (await tableExists('investment_transactions')) {
      await sql`UPDATE investment_transactions SET user_id = ${me.id} WHERE user_id = ${legacy.id}`;
    }
    if (await tableExists('payment_records')) {
      await sql`UPDATE payment_records SET user_id = ${me.id} WHERE user_id = ${legacy.id}`;
    }

    if (await tableExists('notifications')) {
      await sql`UPDATE notifications SET user_id = ${me.id} WHERE user_id = ${legacy.id}`;
    }
    if (await tableExists('security_events')) {
      await sql`UPDATE security_events SET user_id = ${me.id} WHERE user_id = ${legacy.id}`;
    }
    if (await tableExists('password_reset_tokens')) {
      await sql`UPDATE password_reset_tokens SET user_id = ${me.id} WHERE user_id = ${legacy.id}`;
    }

    await sql`DELETE FROM sessions WHERE user_id = ${legacy.id}`;
    if (await tableExists('login_challenges')) {
      await sql`DELETE FROM login_challenges WHERE user_id = ${legacy.id}`;
    }

    await sql`
      UPDATE users
      SET mobile = COALESCE(mobile, ${legacy.mobile}),
          legal_accepted_at = COALESCE(legal_accepted_at, ${legacy.legal_accepted_at}),
          pin_hash = NULL
      WHERE id = ${me.id}
    `;

    let message = 'Legacy data synced. PIN login has been disabled.';
    try {
      await sql`DELETE FROM users WHERE id = ${legacy.id}`;
    } catch {
      // If full deletion is blocked by an older schema edge-case, still disable legacy login.
      await sql`UPDATE users SET pin_hash = NULL, mobile = NULL WHERE id = ${legacy.id}`;
      message = 'Legacy data synced. Legacy sign-in is disabled.';
    }

    await logSecurityEvent({ req, userId: me.id, eventType: 'legacy_sync', status: 'success', meta: { mergedFrom: normalizedMobile } });
    return NextResponse.json({ ok: true, merged: true, message });
  } catch (err) {
    console.error('legacy sync error', err);
    if (err?.code === '42P01') {
      return NextResponse.json({ error: 'Legacy sync requires latest database migrations. Please update DB and retry.' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Could not sync legacy account.' }, { status: 500 });
  }
}
