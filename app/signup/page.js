'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Tell us your name.');
      return;
    }
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    if (!password) {
      setError('Choose a password.');
      return;
    }
    if (!recoveryKey.trim() || recoveryKey.trim().length < 8) {
      setError('Set a recovery key with at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreed) {
      setError('Please accept Terms and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          recoveryKey,
          acceptedLegal: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create account.');
      router.push('/home');
      router.refresh();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-paper-card border border-edge rounded-2xl p-7 shadow-sm anim-fade">
        <div className="w-12 h-12 rounded-2xl bg-ink text-paper flex items-center justify-center text-xl font-medium mx-auto mb-4">₹</div>

        <form onSubmit={submit}>
          <h1 className="text-xl font-medium text-center">Create account</h1>
          <p className="text-sm text-ink-soft text-center mt-1.5 mb-6">Start tracking your money with stronger account security</p>

          <label className="block text-xs text-ink-soft mb-1.5">Your name<span className="text-danger ml-0.5">*</span></label>
          <input
            type="text"
            autoFocus
            autoComplete="name"
            placeholder="Karthik R."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-input mb-3"
          />

          <label className="block text-xs text-ink-soft mb-1.5">Email address<span className="text-danger ml-0.5">*</span></label>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input mb-3"
          />

          <label className="block text-xs text-ink-soft mb-1.5">Password<span className="text-danger ml-0.5">*</span></label>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="At least 10 chars, with upper/lower/number/symbol"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input mb-3"
          />

          <label className="block text-xs text-ink-soft mb-1.5">Confirm password<span className="text-danger ml-0.5">*</span></label>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Type password again"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="field-input mb-3"
          />

          <label className="block text-xs text-ink-soft mb-1.5">Recovery key<span className="text-danger ml-0.5">*</span></label>
          <input
            type="password"
            placeholder="Keep this safe. Use it for password recovery"
            value={recoveryKey}
            onChange={(e) => setRecoveryKey(e.target.value)}
            className="field-input"
          />

          <p className="text-[11px] text-ink-mute mt-2">No external email/SMS is used. Keep this recovery key secure.</p>

          <label className="mt-4 flex items-start gap-2 text-[12px] text-ink-soft">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I agree to the{' '}
              <Link href="/terms" className="text-mint-600">Terms</Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-mint-600">Privacy Policy</Link>.
            </span>
          </label>

          {error && <p className="mt-3 text-xs text-danger">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium mt-5">
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          <div className="flex items-center gap-3 my-5 text-[11px] text-ink-mute uppercase tracking-wider">
            <div className="flex-1 h-px bg-edge" /> already a user? <div className="flex-1 h-px bg-edge" />
          </div>

          <p className="text-sm text-ink-soft text-center">
            <Link href="/login" className="text-mint-600 font-medium">Log in instead</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
