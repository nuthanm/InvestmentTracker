import crypto from 'crypto';
import { sql } from './db';

const LOGIN_CHALLENGE_MINUTES = 10;
const PASSWORD_RESET_MINUTES = 30;

export function generateRawToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

function parseIp(req) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (!forwarded) return null;
  return forwarded.split(',')[0]?.trim() || null;
}

function parseUserAgent(req) {
  return req.headers.get('user-agent') || null;
}

export async function logSecurityEvent({ req, userId = null, eventType, status = 'success', meta = null }) {
  try {
    await sql`
      INSERT INTO security_events (user_id, event_type, status, meta, ip_address, user_agent)
      VALUES (${userId}, ${eventType}, ${status}, ${meta ? JSON.stringify(meta) : null}, ${parseIp(req)}, ${parseUserAgent(req)})
    `;
  } catch {
    // Avoid breaking user flows if audit logging table is not available yet.
  }
}

export async function createLoginChallenge(userId) {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  await sql`
    INSERT INTO login_challenges (token_hash, user_id, expires_at)
    VALUES (${tokenHash}, ${userId}, now() + (${LOGIN_CHALLENGE_MINUTES} * interval '1 minute'))
  `;
  return rawToken;
}

export async function consumeLoginChallenge(rawToken) {
  const tokenHash = hashToken(rawToken);
  const rows = await sql`
    DELETE FROM login_challenges
    WHERE token_hash = ${tokenHash} AND expires_at > now()
    RETURNING user_id
  `;
  return rows[0]?.user_id || null;
}

export async function createPasswordResetToken(userId) {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  await sql`
    INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
    VALUES (${tokenHash}, ${userId}, now() + (${PASSWORD_RESET_MINUTES} * interval '1 minute'))
  `;
  return rawToken;
}

export async function consumePasswordResetToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const rows = await sql`
    UPDATE password_reset_tokens
    SET used_at = now()
    WHERE token_hash = ${tokenHash} AND expires_at > now() AND used_at IS NULL
    RETURNING user_id
  `;
  return rows[0]?.user_id || null;
}
