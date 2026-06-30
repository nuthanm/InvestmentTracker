'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from '@/components/Toast';
import { getPasswordStrength, validateEmail, validatePassword } from '@/lib/validation';

const SECURITY_QUESTIONS = [
  'What was the name of your first pet?',
  'What city were you born in?',
  'What was the name of your first school?',
  'What is your mother\'s maiden name?',
  'What is your favorite book?',
  'What was your first job title?',
];

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [securityQ1, setSecurityQ1] = useState('');
  const [securityA1, setSecurityA1] = useState('');
  const [securityQ2, setSecurityQ2] = useState('');
  const [securityA2, setSecurityA2] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);

  // Field-level errors
  const [fieldErrors, setFieldErrors] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    recoveryKey: '',
    securityQ1: '',
    securityA1: '',
    securityQ2: '',
    securityA2: '',
    agreed: '',
  });

  const validateForm = () => {
    const errors = {};
    let isValid = true;

    if (!name.trim()) {
      errors.name = 'Tell us your name';
      isValid = false;
    }

    if (!email.trim()) {
      errors.email = 'Enter your email address';
      isValid = false;
    } else if (!email.includes('@') || !email.includes('.')) {
      errors.email = 'Enter a valid email address';
      isValid = false;
    }

    if (!password) {
      errors.password = 'Choose a password';
      isValid = false;
    } else if (password.length < 8) {
      errors.password = 'At least 8 characters required';
      isValid = false;
    } else if (!/[A-Z]/.test(password)) {
      errors.password = 'Add an uppercase letter';
      isValid = false;
    } else if (!/[a-z]/.test(password)) {
      errors.password = 'Add a lowercase letter';
      isValid = false;
    } else if (!/\d/.test(password)) {
      errors.password = 'Add a number';
      isValid = false;
    } else if (!/[^A-Za-z0-9]/.test(password)) {
      errors.password = 'Add a special character (!@#$%^&*)';
      isValid = false;
    }

    if (password && confirmPassword && password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    if (!recoveryKey.trim() || recoveryKey.trim().length < 8) {
      errors.recoveryKey = 'At least 8 characters required';
      isValid = false;
    }

    if (!securityQ1 || !securityA1.trim()) {
      errors.securityA1 = 'Please answer the first security question';
      isValid = false;
    }

    if (!securityQ2 || !securityA2.trim()) {
      errors.securityA2 = 'Please answer the second security question';
      isValid = false;
    }

    if (securityQ1 === securityQ2) {
      errors.securityQ2 = 'Choose different questions';
      isValid = false;
    }

    if (!agreed) {
      errors.agreed = 'Please accept Terms and Privacy Policy';
      isValid = false;
    }

    setFieldErrors(errors);
    return isValid;
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
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
          securityQuestions: [
            { question: securityQ1, answer: securityA1 },
            { question: securityQ2, answer: securityA2 },
          ],
          acceptedLegal: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create account.');
      setBackupCodes(data.backupCodes || []);
      // Don't redirect yet - show backup codes first
    } catch (err) {
      setFieldErrors((prev) => ({ ...prev, submit: err.message }));
      setLoading(false);
    }
  };

  const passwordStrength = password ? getPasswordStrength(password) : null;
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className={`w-full ${backupCodes.length > 0 ? 'max-w-md' : 'max-w-sm'} bg-paper-card border border-edge rounded-2xl p-7 shadow-sm anim-fade`}>
        <div className="w-12 h-12 rounded-2xl bg-ink text-paper flex items-center justify-center text-xl font-medium mx-auto mb-4">₹</div>

        {backupCodes.length > 0 ? (
          // Backup Codes Display Screen
          <>
            <h1 className="text-xl font-medium text-center">Save your backup codes</h1>
            <p className="text-sm text-ink-soft text-center mt-1.5 mb-5">
              Store these codes somewhere safe. You can use each code once to recover your account if you lose your password and recovery key.
            </p>

            <div className="bg-honey/10 border border-honey/30 rounded-lg p-4 mb-5">
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, idx) => (
                  <div key={idx} className="font-mono text-sm bg-paper px-2.5 py-1.5 rounded border border-edge text-center">
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-ink-mute mb-4 text-center">
              💾 Copy these codes and save them to a password manager.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <button
                type="button"
                onClick={() => {
                  const codesText = backupCodes.join('\n');
                  navigator.clipboard.writeText(codesText);
                  toast('Backup codes copied to clipboard!');
                }}
                className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium whitespace-nowrap"
              >
                Copy codes
              </button>

              <button
                type="button"
                onClick={() => {
                  setBackupCodes([]);
                  router.push('/onboarding/security');
                  router.refresh();
                }}
                className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium whitespace-nowrap"
              >
                Continue to security setup
              </button>
            </div>
          </>
        ) : (
          // Signup Form
          <form onSubmit={submit}>
          <h1 className="text-xl font-medium text-center">Create account</h1>
          <p className="text-sm text-ink-soft text-center mt-1.5 mb-6">Start tracking your money with stronger account security</p>

          {/* Name Field */}
          <label className="block text-xs text-ink-soft mb-1.5">Your name<span className="text-danger ml-0.5">*</span></label>
          <input
            type="text"
            autoFocus
            autoComplete="name"
            placeholder="Nuthan"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: '' }));
            }}
            className={`field-input mb-1 ${fieldErrors.name ? 'border-danger bg-danger/5' : ''}`}
          />
          {fieldErrors.name && <p className="text-xs text-danger mb-3">{fieldErrors.name}</p>}

          {/* Email Field */}
          <label className="block text-xs text-ink-soft mb-1.5">Email address<span className="text-danger ml-0.5">*</span></label>
          <input
            type="text"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              const newEmail = e.target.value;
              setEmail(newEmail);
              if (newEmail.trim() && !validateEmail(newEmail)) {
                setFieldErrors((prev) => ({ ...prev, email: 'Enter a valid email address' }));
              } else {
                setFieldErrors((prev) => ({ ...prev, email: '' }));
              }
            }}
            className={`field-input mb-1 ${fieldErrors.email ? 'border-danger bg-danger/5' : ''}`}
          />
          {fieldErrors.email && <p className="text-xs text-danger mb-3">{fieldErrors.email}</p>}

          {/* Password Field */}
          <label className="block text-xs text-ink-soft mb-1.5">Password<span className="text-danger ml-0.5">*</span></label>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 chars: upper, lower, number, symbol"
            value={password}
            onChange={(e) => {
              const newPassword = e.target.value;
              setPassword(newPassword);
              if (newPassword.length > 0 && !validatePassword(newPassword)) {
                setFieldErrors((prev) => ({ ...prev, password: 'Add uppercase, lowercase, number, and symbol' }));
              } else {
                setFieldErrors((prev) => ({ ...prev, password: '' }));
              }
            }}
            className={`field-input mb-1 ${fieldErrors.password ? 'border-danger bg-danger/5' : ''}`}
          />
          {fieldErrors.password && <p className="text-xs text-danger mb-2">{fieldErrors.password}</p>}
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
          <label className="block text-xs text-ink-soft mb-1.5">Confirm password<span className="text-danger ml-0.5">*</span></label>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Type password again"
            value={confirmPassword}
            onChange={(e) => {
              const newConfirmPassword = e.target.value;
              setConfirmPassword(newConfirmPassword);
              if (newConfirmPassword && password && password !== newConfirmPassword) {
                setFieldErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match' }));
              } else {
                setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
              }
            }}
            className={`field-input mb-1 ${fieldErrors.confirmPassword ? 'border-danger bg-danger/5' : ''}`}
          />
          {confirmPassword && passwordsMatch && (
            <p className="text-xs text-mint-600 mb-3">✓ Passwords match</p>
          )}
          {fieldErrors.confirmPassword && <p className="text-xs text-danger mb-3">{fieldErrors.confirmPassword}</p>}

          {/* Recovery Key Field */}
          <label className="block text-xs text-ink-soft mb-1.5">Recovery key<span className="text-danger ml-0.5">*</span></label>
          <input
            type="password"
            placeholder="Keep this safe. Use it for password recovery"
            value={recoveryKey}
            onChange={(e) => {
              setRecoveryKey(e.target.value);
              if (fieldErrors.recoveryKey) setFieldErrors((prev) => ({ ...prev, recoveryKey: '' }));
            }}
            className={`field-input mb-1 ${fieldErrors.recoveryKey ? 'border-danger bg-danger/5' : ''}`}
          />
          {fieldErrors.recoveryKey && <p className="text-xs text-danger mb-3">{fieldErrors.recoveryKey}</p>}

          <p className="text-[11px] text-ink-mute mb-4">No external email/SMS is used. Keep this recovery key secure.</p>

          {/* Security Question 1 */}
          <label className="block text-xs text-ink-soft mb-1.5">Security question 1<span className="text-danger ml-0.5">*</span></label>
          <select
            value={securityQ1}
            onChange={(e) => {
              setSecurityQ1(e.target.value);
              if (fieldErrors.securityQ1) setFieldErrors((prev) => ({ ...prev, securityQ1: '' }));
            }}
            className={`field-input mb-1 ${fieldErrors.securityQ1 ? 'border-danger bg-danger/5' : ''}`}
          >
            <option value="">Choose a question...</option>
            {SECURITY_QUESTIONS.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
          {fieldErrors.securityQ1 && <p className="text-xs text-danger mb-3">{fieldErrors.securityQ1}</p>}
          <input
            type="text"
            placeholder="Your answer"
            value={securityA1}
            onChange={(e) => {
              setSecurityA1(e.target.value);
              if (fieldErrors.securityA1) setFieldErrors((prev) => ({ ...prev, securityA1: '' }));
            }}
            className={`field-input mb-1 ${fieldErrors.securityA1 ? 'border-danger bg-danger/5' : ''}`}
          />
          {fieldErrors.securityA1 && <p className="text-xs text-danger mb-3">{fieldErrors.securityA1}</p>}

          {/* Security Question 2 */}
          <label className="block text-xs text-ink-soft mb-1.5 mt-3">Security question 2<span className="text-danger ml-0.5">*</span></label>
          <select
            value={securityQ2}
            onChange={(e) => {
              setSecurityQ2(e.target.value);
              if (fieldErrors.securityQ2) setFieldErrors((prev) => ({ ...prev, securityQ2: '' }));
            }}
            className={`field-input mb-1 ${fieldErrors.securityQ2 ? 'border-danger bg-danger/5' : ''}`}
          >
            <option value="">Choose a question...</option>
            {SECURITY_QUESTIONS.map((q) => (
              <option key={q} value={q} disabled={q === securityQ1}>{q}</option>
            ))}
          </select>
          {fieldErrors.securityQ2 && <p className="text-xs text-danger mb-3">{fieldErrors.securityQ2}</p>}
          <input
            type="text"
            placeholder="Your answer"
            value={securityA2}
            onChange={(e) => {
              setSecurityA2(e.target.value);
              if (fieldErrors.securityA2) setFieldErrors((prev) => ({ ...prev, securityA2: '' }));
            }}
            className={`field-input mb-1 ${fieldErrors.securityA2 ? 'border-danger bg-danger/5' : ''}`}
          />
          {fieldErrors.securityA2 && <p className="text-xs text-danger mb-3">{fieldErrors.securityA2}</p>}

          <p className="text-[11px] text-ink-mute mb-4">Backup recovery method if you forget both password and recovery key.</p>

          {/* Terms Checkbox */}
          <label className="flex items-start gap-2 text-[12px] text-ink-soft mb-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (fieldErrors.agreed) setFieldErrors((prev) => ({ ...prev, agreed: '' }));
              }}
              className="mt-0.5"
            />
            <span>
              I agree to the{' '}
              <Link href="/terms" className="text-mint-600">Terms</Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-mint-600">Privacy Policy</Link>.
            </span>
          </label>
          {fieldErrors.agreed && <p className="text-xs text-danger mb-3">{fieldErrors.agreed}</p>}

          {fieldErrors.submit && <p className="text-xs text-danger mb-3">{fieldErrors.submit}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium mt-5">
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          <p className="text-xs text-center mt-4 text-ink-soft">
            Already have an account?{' '}
            <Link href="/login" className="text-mint-600">Sign in</Link>
          </p>
        </form>
        )}
      </div>
    </div>
  );
}