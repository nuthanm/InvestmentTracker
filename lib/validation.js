// Pure utility functions for validation and password strength
// These functions have no server dependencies and can be safely used in Client Components

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

export function validatePin(pin) {
  return /^\d{6}$/.test(String(pin));
}

export function normalizeMobile(input) {
  const cleaned = String(input || '').replace(/[\s-]/g, '');
  if (!cleaned) return null;
  return cleaned.startsWith('+') ? cleaned : '+91' + cleaned.replace(/^0+/, '');
}

export function validateRecoveryKey(value) {
  return String(value || '').trim().length >= 8;
}
