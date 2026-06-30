'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [method, setMethod] = useState('recovery_key'); // recovery_key, backup_code, security_questions
  const [recoveryKey, setRecoveryKey] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [securityAnswers, setSecurityAnswers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [message, setMessage] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    setResetLink('');

    try {
      const payload = { email, method };
      if (method === 'recovery_key') payload.recoveryKey = recoveryKey;
      else if (method === 'backup_code') payload.backupCode = backupCode;
      else if (method === 'security_questions') payload.answers = securityAnswers;

      const res = await fetch('/api/auth/password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate reset link.');
      setMessage('✓ Verified! Copy the reset link below and open it in your browser.');
      if (data.resetUrl) setResetLink(data.resetUrl);
    } catch (err) {
      if (err?.message === 'Failed to fetch') {
        setError('Cannot reach server. Start the app with "npm run dev" and try again.');
      } else {
        setError(err.message || 'Could not generate reset link.');
      }
    }
    setLoading(false);
  };

  const switchMethod = async (newMethod) => {
    setMethod(newMethod);
    setMessage('');
    setError('');
    setResetLink('');

    if (newMethod === 'security_questions' && !questions.length && email) {
      // Fetch security questions for this email
      try {
        const res = await fetch('/api/auth/security-questions?email=' + encodeURIComponent(email));
        const data = await res.json();
        if (data.questions) {
          setQuestions(data.questions);
          setSecurityAnswers(Array(data.questions.length).fill(''));
          setCurrentQuestion(0);
        }
      } catch (err) {
        setError('Could not load security questions.');
      }
    }
  };

  const updateAnswer = (index, value) => {
    const newAnswers = [...securityAnswers];
    newAnswers[index] = value;
    setSecurityAnswers(newAnswers);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-paper-card border border-edge rounded-2xl p-7 shadow-sm anim-fade">
        <h1 className="text-xl font-medium text-center">Reset password</h1>
        <p className="text-sm text-ink-soft text-center mt-1.5 mb-6">Choose a method to verify your identity</p>

        {/* Method Tabs */}
        <div className="flex gap-1.5 mb-6 border-b border-edge">
          <button
            onClick={() => switchMethod('recovery_key')}
            className={`flex-1 py-2 text-xs font-medium border-b-2 transition ${method === 'recovery_key' ? 'border-mint-600 text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`}
          >
            Recovery Key
          </button>
          <button
            onClick={() => switchMethod('backup_code')}
            className={`flex-1 py-2 text-xs font-medium border-b-2 transition ${method === 'backup_code' ? 'border-mint-600 text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`}
          >
            Backup Code
          </button>
          <button
            onClick={() => switchMethod('security_questions')}
            className={`flex-1 py-2 text-xs font-medium border-b-2 transition ${method === 'security_questions' ? 'border-mint-600 text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`}
          >
            Questions
          </button>
        </div>

        <form onSubmit={submit}>
          <label className="block text-xs text-ink-soft mb-1.5">Email address</label>
          <input
            type="text"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input mb-4"
            autoFocus
          />

          {/* Recovery Key Method */}
          {method === 'recovery_key' && (
            <>
              <label className="block text-xs text-ink-soft mb-1.5">Recovery key</label>
              <input
                type="password"
                placeholder="Your saved recovery key"
                value={recoveryKey}
                onChange={(e) => setRecoveryKey(e.target.value)}
                className="field-input"
              />
            </>
          )}

          {/* Backup Code Method */}
          {method === 'backup_code' && (
            <>
              <label className="block text-xs text-ink-soft mb-1.5">Backup code</label>
              <input
                type="text"
                placeholder="8-character code"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                maxLength="8"
                className="field-input"
              />
              <p className="text-[11px] text-ink-mute mt-2">One-time use code from your printable backup codes</p>
            </>
          )}

          {/* Security Questions Method */}
          {method === 'security_questions' && questions.length > 0 && (
            <>
              {questions.map((q, idx) => (
                <div key={q.id} className={idx !== currentQuestion ? 'hidden' : ''}>
                  <label className="block text-xs text-ink-soft mb-1.5">Q: {q.question}</label>
                  <input
                    type="text"
                    placeholder="Your answer"
                    value={securityAnswers[idx] || ''}
                    onChange={(e) => updateAnswer(idx, e.target.value)}
                    className="field-input"
                    autoFocus
                  />
                  <div className="flex gap-2 mt-3">
                    {currentQuestion > 0 && (
                      <button
                        type="button"
                        onClick={() => setCurrentQuestion(currentQuestion - 1)}
                        className="btn-ghost px-3 py-2 rounded-lg text-xs"
                      >
                        ← Previous
                      </button>
                    )}
                    {currentQuestion < questions.length - 1 && (
                      <button
                        type="button"
                        onClick={() => setCurrentQuestion(currentQuestion + 1)}
                        className="btn-ghost px-3 py-2 rounded-lg text-xs flex-1"
                      >
                        Next →
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {method === 'security_questions' && questions.length === 0 && (
            <p className="text-xs text-ink-mute">No security questions set up. Try another method or contact support.</p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium mt-5">
            {loading ? 'Verifying…' : 'Get reset link'}
          </button>
        </form>

        {error && <p className="mt-4 text-xs text-danger">{error}</p>}
        {message && <p className="mt-4 text-xs text-ink-soft">{message}</p>}
        {resetLink && (
          <div className="mt-4 p-3 bg-mint-50 border border-mint-100 rounded-lg">
            <p className="text-xs text-mint-700 font-medium mb-2">Your one-time reset link:</p>
            <a className="text-xs text-mint-600 break-all hover:underline" href={resetLink}>{resetLink}</a>
          </div>
        )}

        <p className="text-xs text-center mt-5">
          <Link href="/login" className="text-mint-600">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
