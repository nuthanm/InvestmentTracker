'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getPasswordStrength, validatePassword } from '@/lib/validation';

export default function ResetPasswordClient({ token }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Field-level errors
  const [fieldErrors, setFieldErrors] = useState({
    token: '',
    newPassword: '',
    confirmPassword: '',
    submit: '',
  });
  const [message, setMessage] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setFieldErrors({ token: '', newPassword: '', confirmPassword: '', submit: '' });
    setMessage('');

    let isValid = true;
    const errors = {};

    if (!token) {
      errors.token = 'Missing reset token. Open the full link from your email.';
      isValid = false;
    }

    if (!newPassword) {
      errors.newPassword = 'Choose a password';
      isValid = false;
    } else if (newPassword.length < 8) {
      errors.newPassword = 'At least 8 characters required';
      isValid = false;
    } else if (!/[A-Z]/.test(newPassword)) {
      errors.newPassword = 'Add an uppercase letter';
      isValid = false;
    } else if (!/[a-z]/.test(newPassword)) {
      errors.newPassword = 'Add a lowercase letter';
      isValid = false;
    } else if (!/\d/.test(newPassword)) {
      errors.newPassword = 'Add a number';
      isValid = false;
    } else if (!/[^A-Za-z0-9]/.test(newPassword)) {
      errors.newPassword = 'Add a special character (!@#$%^&*)';
      isValid = false;
    }

    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    if (!isValid) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not reset password.');
      setMessage('Password reset successful. Redirecting to sign in...');
      setTimeout(() => router.push('/login'), 900);
    } catch (err) {
      setFieldErrors((prev) => ({ ...prev, submit: err.message }));
      setLoading(false);
    }
  };

  const passwordStrength = newPassword ? getPasswordStrength(newPassword) : null;
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-paper-card border border-edge rounded-2xl p-7 shadow-sm anim-fade">
        <h1 className="text-xl font-medium text-center">Reset password</h1>
        <p className="text-sm text-ink-soft text-center mt-1.5 mb-6">Choose a new strong password for your account.</p>

        {fieldErrors.token && <p className="text-xs text-danger mb-4">{fieldErrors.token}</p>}

        <form onSubmit={submit}>
          {/* New Password Field */}
          <label className="block text-xs text-ink-soft mb-1.5">New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => {
              const newPass = e.target.value;
              setNewPassword(newPass);
              if (newPass.length > 0 && !validatePassword(newPass)) {
                setFieldErrors((prev) => ({ ...prev, newPassword: 'Add uppercase, lowercase, number, and symbol' }));
              } else {
                setFieldErrors((prev) => ({ ...prev, newPassword: '' }));
              }
            }}
            className={`field-input mb-1 ${fieldErrors.newPassword ? 'border-danger bg-danger/5' : ''}`}
            placeholder="At least 8 chars: upper, lower, number, symbol"
            autoFocus
          />
          {fieldErrors.newPassword && <p className="text-xs text-danger mb-2">{fieldErrors.newPassword}</p>}
          {passwordStrength && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ink-mute">Strength:</span>
                <span className={`text-xs font-medium ${passwordStrength.color}`}>{passwordStrength.label}</span>
              </div>
              <div className="w-full h-1.5 bg-edge rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    passwordStrength.score === 0
                      ? 'w-1/6 bg-danger'
                      : passwordStrength.score === 1
                      ? 'w-1/4 bg-danger'
                      : passwordStrength.score === 2
                      ? 'w-1/2 bg-honey'
                      : 'w-full bg-mint-600'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Confirm Password Field */}
          <labconst newConfirmPass = e.target.value;
              setConfirmPassword(newConfirmPass);
              if (newConfirmPass && newPassword && newPassword !== newConfirmPass) {
                setFieldErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match' }));
              } else {
                setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
              }
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
            }}
            className={`field-input mb-1 ${fieldErrors.confirmPassword ? 'border-danger bg-danger/5' : ''}`}
            placeholder="Type password again"
          />
          {confirmPassword && passwordsMatch && (
            <p className="text-xs text-mint-600 mb-3">✓ Passwords match</p>
          )}
          {fieldErrors.confirmPassword && <p className="text-xs text-danger mb-3">{fieldErrors.confirmPassword}</p>}

          {fieldErrors.submit && <p className="text-xs text-danger mb-3">{fieldErrors.submit}</p>}
          {message && <p className="text-xs text-mint-600 mb-3">{message}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium mt-5">
            {loading ? 'Resetting…' : 'Reset password'}
          </button>
        </form>

        <p className="text-xs text-center mt-5">
          <Link href="/login" className="text-mint-600">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
