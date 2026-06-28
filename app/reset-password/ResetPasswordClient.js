'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ResetPasswordClient({ token }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!token) {
      setError('Missing reset token. Open the full link from your email.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
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
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-paper-card border border-edge rounded-2xl p-7 shadow-sm anim-fade">
        <h1 className="text-xl font-medium text-center">Reset password</h1>
        <p className="text-sm text-ink-soft text-center mt-1.5 mb-6">Choose a new strong password for your account.</p>

        <form onSubmit={submit}>
          <label className="block text-xs text-ink-soft mb-1.5">New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="field-input mb-3"
            placeholder="At least 10 chars, upper/lower/number/symbol"
            autoFocus
          />

          <label className="block text-xs text-ink-soft mb-1.5">Confirm password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="field-input"
            placeholder="Type password again"
          />

          {error && <p className="mt-3 text-xs text-danger">{error}</p>}
          {message && <p className="mt-3 text-xs text-mint-600">{message}</p>}

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
