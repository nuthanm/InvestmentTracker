import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { generateSecret, generateURI, verify } from 'otplib';
import { sql } from './db';

const SESSION_COOKIE = 'inv_session';
const SESSION_DAYS = 14;

export async function hashPassword(password) {
  return bcrypt.hash(String(password), 12);
}

export async function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(String(password), hash);
}

export function normalizeEmail(input) {
  return String(input || '').trim().toLowerCase();
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function validatePassword(password) {
  const value = String(password || '');
  return value.length >= 8
    && /[A-Z]/.test(value)
    && /[a-z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
}

export function getPasswordStrength(password) {
  const value = String(password || '');
  if (value.length < 8) return { score: 0, label: 'Too short', color: 'text-danger' };
  let score = 1;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  
  if (score <= 1) return { score: 1, label: 'Weak', color: 'text-danger' };
  if (score === 2) return { score: 2, label: 'Fair', color: 'text-honey' };
  if (score === 3) return { score: 3, label: 'Good', color: 'text-mint-600' };
  return { score: 4, label: 'Strong', color: 'text-mint-600' };
}

export function validateRecoveryKey(value) {
  return String(value || '').trim().length >= 8;
}

export async function hashRecoveryKey(value) {
  return bcrypt.hash(String(value), 12);
}

export async function verifyRecoveryKey(value, hash) {
  if (!hash) return false;
  return bcrypt.compare(String(value), hash);
}

export function generateMfaSecret(email) {
  return generateSecret({ issuer: 'InvestmentTracker', accountName: email || 'user' });
}

export function buildMfaOtpauthUrl(email, secret) {
  return generateURI({
    secret,
    issuer: 'InvestmentTracker',
    accountName: email || 'user',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });
}

export function verifyTotpToken(token, secret) {
  if (!token || !secret) return false;
  return verify({ token: String(token).replace(/\s+/g, ''), secret, window: 1 });
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

export function normalizeMobile(input) {
  const cleaned = String(input || '').replace(/[\s-]/g, '');
  if (!cleaned) return null;
  return cleaned.startsWith('+') ? cleaned : '+91' + cleaned.replace(/^0+/, '');
}

export function validatePin(pin) {
  return /^\d{6}$/.test(String(pin));
}
