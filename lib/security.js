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

export async function getLoginChallenge(rawToken) {
  const tokenHash = hashToken(rawToken);
  const rows = await sql`
    SELECT user_id
    FROM login_challenges
    WHERE token_hash = ${tokenHash} AND expires_at > now()
    LIMIT 1
  `;
  return rows[0]?.user_id || null;
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

// ============ Backup Recovery Codes ============
export function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

export function hashBackupCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export async function saveBackupCodes(userId, rawCodes) {
  // Hash all codes before saving
  const codesData = rawCodes.map(code => ({
    userId,
    codeHash: hashBackupCode(code),
  }));
  
  // Delete old codes and insert new ones
  await sql`DELETE FROM backup_recovery_codes WHERE user_id = ${userId}`;
  
  for (const item of codesData) {
    await sql`
      INSERT INTO backup_recovery_codes (user_id, code_hash)
      VALUES (${item.userId}, ${item.codeHash})
    `;
  }
}

export async function useBackupCode(userId, rawCode) {
  const codeHash = hashBackupCode(rawCode);
  const rows = await sql`
    UPDATE backup_recovery_codes
    SET used_at = now()
    WHERE user_id = ${userId} AND code_hash = ${codeHash} AND used_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

export async function getBackupCodeStatus(userId, rawCode) {
  const codeHash = hashBackupCode(rawCode);
  const rows = await sql`
    SELECT used_at
    FROM backup_recovery_codes
    WHERE user_id = ${userId} AND code_hash = ${codeHash}
    LIMIT 1
  `;

  if (!rows.length) return 'not_found';
  return rows[0].used_at ? 'used' : 'unused';
}

export async function getUnusedBackupCodesCount(userId) {
  const rows = await sql`
    SELECT COUNT(*) as count FROM backup_recovery_codes
    WHERE user_id = ${userId} AND used_at IS NULL
  `;
  return rows[0]?.count || 0;
}

// ============ Security Questions ============
export function hashAnswer(answer) {
  const normalized = answer.toLowerCase().trim();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export async function saveSecurityQuestions(userId, questionsData) {
  // questionsData: [{ question, answer }, ...]
  await sql`DELETE FROM user_security_questions WHERE user_id = ${userId}`;
  
  for (const qa of questionsData) {
    await sql`
      INSERT INTO user_security_questions (user_id, question, answer_hash)
      VALUES (${userId}, ${qa.question}, ${hashAnswer(qa.answer)})
    `;
  }
}

export async function verifySecurityAnswers(userId, answers) {
  // answers: [{ question, answer }, ...]
  // Return true if all answers match
  const questions = await sql`
    SELECT question, answer_hash FROM user_security_questions
    WHERE user_id = ${userId}
    ORDER BY question
  `;

  if (questions.length === 0) return false;

  const answersMap = {};
  answers.forEach(qa => {
    answersMap[qa.question.toLowerCase()] = hashAnswer(qa.answer);
  });

  for (const q of questions) {
    const providedHash = answersMap[q.question.toLowerCase()];
    if (!providedHash || providedHash !== q.answer_hash) {
      return false;
    }
  }

  return true;
}

export async function getSecurityQuestions(userId) {
  return sql`
    SELECT id, question FROM user_security_questions
    WHERE user_id = ${userId}
    ORDER BY question
  `;
}
