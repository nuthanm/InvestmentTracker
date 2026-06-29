'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [mfaChallengeToken, setMfaChallengeToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Field-level errors
  const [fieldErrors, setFieldErrors] = useState({
    email: '',
    password: '',
    mfaCode: '',
    submit: '',
  });

  const onSubmit = async (e) => {
    e.preventDefault();
    setFieldErrors({ email: '', password: '', mfaCode: '', submit: '' });

    let isValid = true;
    const errors = {};

    if (!email.trim()) {
      errors.email = 'Enter your email address';
      isValid = false;
    }

    if (!password) {
      errors.password = 'Enter your password';
      isValid = false;
    }

    if (!isValid) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
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
      setFieldErrors((prev) => ({ ...prev, submit: err.message }));
      setLoading(false);
    }
  };

  const onVerifyMfa = async (e) => {
    e.preventDefault();
    setFieldErrors({ email: '', password: '', mfaCode: '', submit: '' });

    if (!mfaCode.trim()) {
      setFieldErrors((prev) => ({ ...prev, mfaCode: 'Enter your verification code' }));
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
      setFieldErrors((prev) => ({ ...prev, submit: err.message }));
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
            <p className="text-sm text-ink-soft text-center mt-1.5 mb-6">Sign in securely with your account email</p>

            {/* Email Field */}
            <label className="block text-xs text-ink-soft mb-1.5">Email address<span className="text-danger ml-0.5">*</span></label>
            <input
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
              }}
              className={`field-input mb-1 ${fieldErrors.email ? 'border-danger bg-danger/5' : ''}`}
            />
            {fieldErrors.email && <p className="text-xs text-danger mb-3">{fieldErrors.email}</p>}

            {/* Password Field */}
            <label className="block text-xs text-ink-soft mb-1.5">Password<span className="text-danger ml-0.5">*</span></label>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
              }}
              className={`field-input mb-1 ${fieldErrors.password ? 'border-danger bg-danger/5' : ''}`}
            />
            {fieldErrors.password && <p className="text-xs text-danger mb-3">{fieldErrors.password}</p>}

            {fieldErrors.submit && <p className="text-xs text-danger mb-3">{fieldErrors.submit}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium mt-5">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <p className="text-xs text-center mt-3">
              <Link href="/forgot-password" className="text-mint-600">Forgot password?</Link>
            </p>

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
              onChange={(e) => {
                setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                if (fieldErrors.mfaCode) setFieldErrors((prev) => ({ ...prev, mfaCode: '' }));
              }}
              className={`field-input mb-1 ${fieldErrors.mfaCode ? 'border-danger bg-danger/5' : ''}`}
              autoFocus
            />
            {fieldErrors.mfaCode && <p className="text-xs text-danger mb-3">{fieldErrors.mfaCode}</p>}

            {fieldErrors.submit && <p className="text-xs text-danger mb-3">{fieldErrors.submit}</p>}

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
