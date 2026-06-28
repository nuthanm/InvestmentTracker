'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('email');
  const [mfaChallengeToken, setMfaChallengeToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'email') {
      if (!email.trim() || !password) {
        setError('Email and password are required.');
        return;
      }
    } else {
      if (!mobile.trim() || !pin.trim()) {
        setError('Mobile and PIN are required for legacy sign-in.');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'email' ? { email, password } : { mobile, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not log in.');
      if (data.mfaRequired && data.challengeToken) {
        setMfaChallengeToken(data.challengeToken);
        setLoading(false);
        return;
      }
      router.push('/home');
      router.refresh();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const onVerifyMfa = async (e) => {
    e.preventDefault();
    setError('');
    if (!mfaCode.trim()) {
      setError('Enter your verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken: mfaChallengeToken, code: mfaCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not verify MFA.');
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

        {!mfaChallengeToken ? (
        <form onSubmit={onSubmit}>
          <h1 className="text-xl font-medium text-center">Welcome back</h1>
          <p className="text-sm text-ink-soft text-center mt-1.5 mb-6">
            {mode === 'email' ? 'Sign in securely with your account email' : 'Legacy mode for existing mobile + PIN accounts'}
          </p>

          <div className="mb-3 flex gap-2 rounded-lg border border-edge p-1">
            <button
              type="button"
              className={`flex-1 rounded-md py-1.5 text-xs ${mode === 'email' ? 'bg-paper-tint font-medium' : 'text-ink-soft'}`}
              onClick={() => setMode('email')}
            >
              Email
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md py-1.5 text-xs ${mode === 'legacy' ? 'bg-paper-tint font-medium' : 'text-ink-soft'}`}
              onClick={() => setMode('legacy')}
            >
              Legacy mobile + PIN
            </button>
          </div>

          {mode === 'email' ? (
            <>
              <label className="block text-xs text-ink-soft mb-1.5">Email address<span className="text-danger ml-0.5">*</span></label>
              <input
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-input mb-3"
              />

              <label className="block text-xs text-ink-soft mb-1.5">Password<span className="text-danger ml-0.5">*</span></label>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input"
              />
            </>
          ) : (
            <>
              <label className="block text-xs text-ink-soft mb-1.5">Mobile number<span className="text-danger ml-0.5">*</span></label>
              <input
                type="tel"
                autoComplete="tel"
                placeholder="+91 98XXX XXXXX"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="field-input mb-3"
              />

              <label className="block text-xs text-ink-soft mb-1.5">PIN<span className="text-danger ml-0.5">*</span></label>
              <input
                type="password"
                inputMode="numeric"
                placeholder="6-digit PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="field-input"
              />
            </>
          )}

          {error && <p className="mt-3 text-xs text-danger">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium mt-5">
            {loading ? 'Signing in…' : mode === 'email' ? 'Sign in' : 'Sign in (legacy)'}
          </button>

          {mode === 'email' && (
            <p className="text-xs text-center mt-3">
              <Link href="/forgot-password" className="text-mint-600">Forgot password?</Link>
            </p>
          )}

          <div className="flex items-center gap-3 my-5 text-[11px] text-ink-mute uppercase tracking-wider">
            <div className="flex-1 h-px bg-edge" /> new here? <div className="flex-1 h-px bg-edge" />
          </div>

          <p className="text-sm text-ink-soft text-center">
            Need an account?{' '}
            <Link href="/signup" className="text-mint-600 font-medium">Create one</Link>
          </p>

          <p className="text-[11px] text-ink-mute mt-4 text-center">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="text-mint-600">Terms</Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-mint-600">Privacy Policy</Link>.
          </p>
        </form>
        ) : (
        <form onSubmit={onVerifyMfa}>
          <h1 className="text-xl font-medium text-center">Verify MFA</h1>
          <p className="text-sm text-ink-soft text-center mt-1.5 mb-6">
            Enter the 6-digit code from your authenticator app.
          </p>

          <label className="block text-xs text-ink-soft mb-1.5">Verification code</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="123456"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="field-input"
            autoFocus
          />

          {error && <p className="mt-3 text-xs text-danger">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium mt-5">
            {loading ? 'Verifying…' : 'Verify and continue'}
          </button>

          <button
            type="button"
            onClick={() => {
              setMfaChallengeToken('');
              setMfaCode('');
              setError('');
              setLoading(false);
            }}
            className="text-xs text-ink-mute mt-4 w-full"
          >
            Back to sign in
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
