'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [message, setMessage] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setResetLink('');

    try {
      const res = await fetch('/api/auth/password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, recoveryKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate reset link.');
      setMessage('Verification successful. Use this one-time reset link now.');
      if (data.resetUrl) setResetLink(data.resetUrl);
    } catch (err) {
      setMessage(err.message || 'Could not generate reset link.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-paper-card border border-edge rounded-2xl p-7 shadow-sm anim-fade">
        <h1 className="text-xl font-medium text-center">Forgot password</h1>
        <p className="text-sm text-ink-soft text-center mt-1.5 mb-6">Use your recovery key to reset password without email or SMS services.</p>

        <form onSubmit={submit}>
          <label className="block text-xs text-ink-soft mb-1.5">Email address</label>
          <input
            type="text"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input mb-3"
            autoFocus
          />

          <label className="block text-xs text-ink-soft mb-1.5">Recovery key</label>
          <input
            type="password"
            placeholder="Your saved recovery key"
            value={recoveryKey}
            onChange={(e) => setRecoveryKey(e.target.value)}
            className="field-input"
          />

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium mt-5">
            {loading ? 'Sending…' : 'Send reset instructions'}
          </button>
        </form>

        {message && <p className="mt-4 text-xs text-ink-soft">{message}</p>}
        {resetLink && (
          <p className="mt-2 text-xs break-all">
            Reset link: <a className="text-mint-600" href={resetLink}>{resetLink}</a>
          </p>
        )}

        <p className="text-xs text-center mt-5">
          <Link href="/login" className="text-mint-600">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
