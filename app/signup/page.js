'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import PinInput from '@/components/PinInput';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState('details');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submitDetails = (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Tell us your name.'); return; }
    if (!mobile.trim()) { setError('Enter your mobile number.'); return; }
    setStep('setpin');
  };

  const onSetPin = (next) => {
    setPin(next);
    if (next.length === 6) setStep('confirm');
  };

  const onConfirmPin = async (next) => {
    setConfirmPin(next);
    if (next.length !== 6) return;
    if (next !== pin) {
      setError('PINs do not match. Try again.');
      setConfirmPin('');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mobile, pin: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create account.');
      router.push('/home');
      router.refresh();
    } catch (err) {
      setError(err.message);
      setStep('details');
      setPin('');
      setConfirmPin('');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-paper-card border border-edge rounded-2xl p-7 shadow-sm anim-fade">
        <div className="w-12 h-12 rounded-2xl bg-ink text-paper flex items-center justify-center text-xl font-medium mx-auto mb-4">₹</div>

        {step === 'details' && (
          <form onSubmit={submitDetails}>
            <h1 className="text-xl font-medium text-center">Create account</h1>
            <p className="text-sm text-ink-soft text-center mt-1.5 mb-6">Track every rupee in one place</p>

            <label className="block text-xs text-ink-soft mb-1.5">Your name<span className="text-danger ml-0.5">*</span></label>
            <input type="text" autoFocus autoComplete="name" placeholder="Karthik R."
              value={name} onChange={(e) => setName(e.target.value)} className="field-input mb-3"/>

            <label className="block text-xs text-ink-soft mb-1.5">Mobile number<span className="text-danger ml-0.5">*</span></label>
            <input type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98XXX XXXXX"
              value={mobile} onChange={(e) => setMobile(e.target.value)} className="field-input"/>

            {error && <p className="mt-3 text-xs text-danger">{error}</p>}

            <button type="submit" className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium mt-5">
              Continue
            </button>

            <p className="text-[11px] text-ink-mute mt-4 text-center">By signing up you agree to our terms.</p>

            <div className="flex items-center gap-3 my-5 text-[11px] text-ink-mute uppercase tracking-wider">
              <div className="flex-1 h-px bg-edge" /> already a user? <div className="flex-1 h-px bg-edge" />
            </div>

            <p className="text-sm text-ink-soft text-center">
              <Link href="/login" className="text-mint-600 font-medium">Log in instead</Link>
            </p>
          </form>
        )}

        {step === 'setpin' && (
          <div>
            <h1 className="text-lg font-medium text-center">Choose a 6-digit PIN</h1>
            <p className="text-sm text-ink-soft text-center mt-1.5 mb-5">You'll use this every time you log in</p>
            <PinInput value={pin} onChange={onSetPin} autoFocus />
            <button onClick={() => setStep('details')} className="text-xs text-ink-mute mt-5 mx-auto block">← back</button>
          </div>
        )}

        {step === 'confirm' && (
          <div>
            <h1 className="text-lg font-medium text-center">Confirm your PIN</h1>
            <p className="text-sm text-ink-soft text-center mt-1.5 mb-5">Type the same 6 digits again</p>
            <PinInput value={confirmPin} onChange={onConfirmPin} autoFocus />
            {error && <p className="mt-3 text-xs text-danger text-center">{error}</p>}
            {loading && <p className="mt-3 text-xs text-ink-mute text-center">Creating account…</p>}
            <button onClick={() => { setStep('setpin'); setPin(''); setConfirmPin(''); setError(''); }}
              className="text-xs text-ink-mute mt-5 mx-auto block">← change PIN</button>
          </div>
        )}
      </div>
    </div>
  );
}
