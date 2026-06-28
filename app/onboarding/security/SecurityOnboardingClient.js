'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SecurityOnboardingClient({ user }) {
  const router = useRouter();
  const [step, setStep] = useState('choice');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const skipFor7Days = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/mfa/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not set reminder.');
      router.push('/home');
      router.refresh();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const beginMfa = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/mfa/setup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start MFA setup.');
      setQr(data.qrCodeDataUrl || '');
      setSecret(data.manualSecret || '');
      setStep('verify');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const verifyMfa = async () => {
    if (!code.trim()) {
      setError('Enter your authenticator code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/mfa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not enable MFA.');
      router.push('/home');
      router.refresh();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <main className="onboard-wrap">
      <section className="onboard-card anim-fade">
        <p className="onboard-kicker">Welcome, {user.name?.split(' ')[0] || 'Investor'}</p>
        <div className="onboard-progress" aria-label="Onboarding progress">
          <div className="onboard-progress-item done">
            <span>1</span>
            <small>Create account</small>
          </div>
          <div className={`onboard-progress-item ${step === 'verify' ? 'done' : 'active'}`}>
            <span>2</span>
            <small>Secure account</small>
          </div>
          <div className="onboard-progress-item">
            <span>3</span>
            <small>Enter app</small>
          </div>
        </div>

        {step === 'choice' ? (
          <>
            <h1>Secure your account before you start</h1>
            <p>
              Enable multi-factor authentication now to protect your investment records.
              You can also skip and set it up later in Account settings.
            </p>

            <div className="onboard-points">
              <div>Protects your portfolio from password-only attacks</div>
              <div>Works with free authenticator apps</div>
              <div>Takes under 60 seconds to finish</div>
            </div>

            {error && <p className="text-xs text-danger mt-3">{error}</p>}

            <div className="onboard-actions">
              <button onClick={beginMfa} disabled={loading} className="btn-primary py-2.5 px-4 rounded-lg text-sm font-medium">
                {loading ? 'Starting…' : 'Enable MFA now'}
              </button>
              <button onClick={skipFor7Days} disabled={loading} className="btn-ghost py-2.5 px-4 rounded-lg text-sm">
                Remind me in 7 days
              </button>
            </div>
          </>
        ) : (
          <>
            <h1>Scan and verify</h1>
            <p>Open your authenticator app, scan this QR code, then enter the 6-digit code.</p>

            {qr ? <img src={qr} alt="MFA QR" className="onboard-qr" /> : null}
            <p className="onboard-secret">Manual code: {secret}</p>

            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className="field-input"
            />
            {error && <p className="text-xs text-danger mt-3">{error}</p>}

            <div className="onboard-actions">
              <button onClick={verifyMfa} disabled={loading} className="btn-primary py-2.5 px-4 rounded-lg text-sm font-medium">
                {loading ? 'Verifying…' : 'Verify and continue'}
              </button>
              <button onClick={skipFor7Days} disabled={loading} className="btn-ghost py-2.5 px-4 rounded-lg text-sm">
                Remind me in 7 days
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
