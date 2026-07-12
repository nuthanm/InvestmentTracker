import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { sql } from './db';
import {
  normalizeEmail,
  validateEmail,
  validatePassword,
  getPasswordStrength,
  validatePin,
  normalizeMobile,
  validateRecoveryKey,
} from './validation';

const SESSION_COOKIE = 'inv_session';
const SESSION_DAYS = 14;

export async function hashPassword(password) {
  return bcrypt.hash(String(password), 12);
}

export async function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(String(password), hash);
}

// Re-export validation utilities for backwards compatibility
export { normalizeEmail, validateEmail, validatePassword, getPasswordStrength, validatePin, normalizeMobile, validateRecoveryKey };

export async function hashRecoveryKey(value) {
  return bcrypt.hash(String(value), 12);
}

export async function verifyRecoveryKey(value, hash) {
  if (!hash) return false;
  return bcrypt.compare(String(value), hash);
}

function normalizeMfaAccountName(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return 'user';

  const lower = normalized.toLowerCase();
  if (lower === 'undefined' || lower === 'null') return 'user';

  return normalized;
}

export function generateMfaSecret(email) {
  return generateSecret({ issuer: 'InvestmentTracker', accountName: normalizeMfaAccountName(email) });
}

export function buildMfaOtpauthUrl(email, secret) {
  return generateURI({
    secret,
    issuer: 'InvestmentTracker',
    label: normalizeMfaAccountName(email),
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });
}

export function verifyTotpToken(token, secret) {
  if (!token || !secret) return false;
  // otplib v13 returns { valid }, not a boolean. Using the Promise from verify() as a
  // boolean was always truthy and incorrectly accepted every MFA code.
  const result = verifySync({
    token: String(token).replace(/\s+/g, ''),
    secret,
    epochTolerance: 30,
  });
  return result?.valid === true;
}

export async function hashPin(pin) {
  return bcrypt.hash(String(pin), 10);
}

export async function verifyPin(pin, hash) {
  return bcrypt.compare(String(pin), hash);
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function createSession(userId) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${token}, ${userId}, ${expiresAt.toISOString()})
  `;
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return token;
}

export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await sql`
    SELECT u.id, u.mobile, u.email, u.name, u.mfa_enabled, u.mfa_skip_until
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at > now()
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return {
    ...rows[0],
    mfaEnabled: !!rows[0].mfa_enabled,
    mfaSkipUntil: rows[0].mfa_skip_until || null,
  };
}

export async function destroySession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await sql`DELETE FROM sessions WHERE token = ${token}`;
  }
  cookies().delete(SESSION_COOKIE);
}
