import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import {
  normalizeEmail,
  validateEmail,
  validateRecoveryKey,
  verifyRecoveryKey,
} from '@/lib/auth';
import {
  createPasswordResetToken,
  getBackupCodeStatus,
  logSecurityEvent,
  useBackupCode,
  verifySecurityAnswers,
} from '@/lib/security';

export async function POST(req) {
  try {
    const body = await req.json();
    const { email, method = 'recovery_key', recoveryKey, backupCode, answers } = body;

    if (!email || !validateEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    const rows = await sql`SELECT id, recovery_key_hash FROM users WHERE email = ${normalizedEmail} LIMIT 1`;
    if (rows.length === 0) {
      await logSecurityEvent({ req, eventType: 'password_reset_request', status: 'failed', meta: { reason: 'invalid_email' } });
      return NextResponse.json({ error: 'Account not found.' }, { status: 401 });
    }

    const user = rows[0];
    let valid = false;

    // Method 1: Recovery Key
    if (method === 'recovery_key' && recoveryKey) {
      if (!validateRecoveryKey(recoveryKey)) {
        return NextResponse.json({ error: 'Invalid recovery key format.' }, { status: 400 });
      }
      valid = await verifyRecoveryKey(recoveryKey.trim(), user.recovery_key_hash);
    }

    // Method 2: Backup Code (one-time use)
    else if (method === 'backup_code' && backupCode) {
      const normalizedBackupCode = String(backupCode).replace(/\s+/g, '').toUpperCase();

      const codeStatus = await getBackupCodeStatus(user.id, normalizedBackupCode);
      if (codeStatus === 'used') {
        await logSecurityEvent({ req, userId: user.id, eventType: 'password_reset_request', status: 'failed', meta: { reason: 'backup_code_already_used' } });
        return NextResponse.json({ error: 'This backup code was already used. Please use another unused backup code.' }, { status: 409 });
      }

      valid = await useBackupCode(user.id, normalizedBackupCode);
    }

    // Method 3: Security Questions
    else if (method === 'security_questions' && answers && Array.isArray(answers)) {
      valid = await verifySecurityAnswers(user.id, answers);
    }

    if (!valid) {
      await logSecurityEvent({ req, userId: user.id, eventType: 'password_reset_request', status: 'failed', meta: { reason: `invalid_${method}` } });

      if (method === 'backup_code') {
        return NextResponse.json({ error: 'Invalid backup code. Use an unused 8-character backup code.' }, { status: 401 });
      }

      return NextResponse.json({ error: 'Verification failed. Please check your credentials.' }, { status: 401 });
    }

    const userId = user.id;
    const token = await createPasswordResetToken(userId);
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const resetUrl = `${base}/reset-password?token=${token}`;

    await logSecurityEvent({ req, userId, eventType: 'password_reset_request', status: 'success', meta: { method } });
    return NextResponse.json({ ok: true, resetUrl });
  } catch (err) {
    console.error('password request error', err);
    return NextResponse.json({ error: 'Could not process reset request.' }, { status: 500 });
  }
}
