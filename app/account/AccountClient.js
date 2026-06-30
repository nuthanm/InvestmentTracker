'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/Toast';

const AUTHENTICATOR_APPS = [
  {
    name: 'Google Authenticator',
    ios: 'https://apps.apple.com/app/google-authenticator/id388497605',
    android: 'https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2',
  },
  {
    name: 'Microsoft Authenticator',
    ios: 'https://apps.apple.com/app/microsoft-authenticator/id981149162',
    android: 'https://play.google.com/store/apps/details?id=com.azure.authenticator',
  },
  {
    name: 'Authy',
    ios: 'https://apps.apple.com/app/authy/id494868406',
    android: 'https://play.google.com/store/apps/details?id=com.authy.authy',
  },
  {
    name: '1Password',
    ios: 'https://apps.apple.com/app/1password-password-manager/id568903335',
    android: 'https://play.google.com/store/apps/details?id=com.onepassword.android',
  },
];

export default function AccountClient({ user }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);

  const [passwordModal, setPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [recoveryModal, setRecoveryModal] = useState(false);
  const [recoveryCurrentPassword, setRecoveryCurrentPassword] = useState('');
  const [newRecoveryKey, setNewRecoveryKey] = useState('');
  const [confirmRecoveryKey, setConfirmRecoveryKey] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [savingRecovery, setSavingRecovery] = useState(false);

  const [mfaEnabled, setMfaEnabled] = useState(!!user.mfaEnabled);
  const [mfaSetupOpen, setMfaSetupOpen] = useState(false);
  const [mfaDisableOpen, setMfaDisableOpen] = useState(false);
  const [mfaSetupSecret, setMfaSetupSecret] = useState('');
  const [mfaQrCode, setMfaQrCode] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaDisablePassword, setMfaDisablePassword] = useState('');
  const [mfaDisableCode, setMfaDisableCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);

  const [exportLoading, setExportLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const initials = (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const saveName = async () => {
    if (!name.trim()) return;
    setSavingName(true);
    await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    setEditingName(false);
    setSavingName(false);
    router.refresh();
  };

  const savePassword = async () => {
    setPasswordError('');
    if (!currentPassword || !newPassword) {
      setPasswordError('Current and new password are required.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update password.');

      setPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      toast('Password changed successfully.');
    } catch (err) {
      setPasswordError(err.message);
    }
    setSavingPassword(false);
  };

  const saveRecoveryKey = async () => {
    setRecoveryError('');
    if (!recoveryCurrentPassword || !newRecoveryKey) {
      setRecoveryError('Current password and new recovery key are required.');
      return;
    }
    if (newRecoveryKey.length < 8) {
      setRecoveryError('Recovery key must be at least 8 characters.');
      return;
    }
    if (newRecoveryKey !== confirmRecoveryKey) {
      setRecoveryError('Recovery keys do not match.');
      return;
    }

    setSavingRecovery(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: recoveryCurrentPassword, newRecoveryKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update recovery key.');

      setRecoveryModal(false);
      setRecoveryCurrentPassword('');
      setNewRecoveryKey('');
      setConfirmRecoveryKey('');
      toast('Recovery key updated.');
    } catch (err) {
      setRecoveryError(err.message);
    }
    setSavingRecovery(false);
  };

  const startMfaSetup = async () => {
    setMfaError('');
    setMfaLoading(true);
    try {
      const res = await fetch('/api/auth/mfa/setup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start MFA setup.');
      setMfaSetupSecret(data.manualSecret || '');
      setMfaQrCode(data.qrCodeDataUrl || '');
      setMfaSetupOpen(true);
    } catch (err) {
      setMfaError(err.message);
    }
    setMfaLoading(false);
  };

  const enableMfa = async () => {
    setMfaError('');
    if (!mfaCode.trim()) {
      setMfaError('Enter the verification code from your authenticator app.');
      return;
    }
    setMfaLoading(true);
    try {
      const res = await fetch('/api/auth/mfa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: mfaCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not enable MFA.');
      setMfaEnabled(true);
      setMfaSetupOpen(false);
      setMfaCode('');
      toast('MFA enabled.');
    } catch (err) {
      setMfaError(err.message);
    }
    setMfaLoading(false);
  };

  const disableMfa = async () => {
    setMfaError('');
    if (!mfaDisablePassword || !mfaDisableCode) {
      setMfaError('Current password and MFA code are required.');
      return;
    }
    setMfaLoading(true);
    try {
      const res = await fetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: mfaDisablePassword, code: mfaDisableCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not disable MFA.');
      setMfaEnabled(false);
      setMfaDisableOpen(false);
      setMfaDisablePassword('');
      setMfaDisableCode('');
      toast('MFA disabled.');
    } catch (err) {
      setMfaError(err.message);
    }
    setMfaLoading(false);
  };

  const exportData = async () => {
    setExportLoading(true);
    try {
      const res = await fetch('/api/auth/export');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Could not export data.');
      }

      const csv = await res.text();
      const blob = new Blob([csv], { type: 'text/csv; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `investmenttracker-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Data export downloaded.');
    } catch (err) {
      toast(err.message || 'Could not export data.');
    }
    setExportLoading(false);
  };

  const deleteAccount = async () => {
    setDeleteError('');
    if (!deletePassword) {
      setDeleteError('Current password is required.');
      return;
    }
    if (deleteConfirm.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Type DELETE to confirm account deletion.');
      return;
    }

    setDeleteLoading(true);
    try {
      const res = await fetch('/api/auth/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: deletePassword, confirmText: deleteConfirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete account.');
      toast('Account deleted successfully.');
      router.push('/signup');
      router.refresh();
    } catch (err) {
      setDeleteError(err.message || 'Could not delete account.');
      setDeleteLoading(false);
    }
  };

  return (
    <>
    <div className="px-4 md:px-8 py-5 md:py-6 max-w-2xl mx-auto w-full">
        <h1 className="text-2xl md:text-3xl font-medium tracking-tight mb-1">Account</h1>
        <p className="text-sm text-ink-soft mb-6">Manage your profile, security, and export your data anytime.</p>

        <div className="flex items-center gap-3.5 p-4 bg-paper-tint rounded-2xl mb-6">
          <div className="w-12 h-12 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center font-medium">{initials}</div>
          <div className="flex-1 min-w-0">
            <p className="font-medium">{user.name}</p>
            <p className="text-xs text-ink-soft mt-0.5">{user.email || user.mobile || 'No email on file'}</p>
          </div>
        </div>

        <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2">Profile</p>
        <div className="bg-paper-card border border-edge rounded-2xl mb-5">
          <div className="px-4 py-3.5 border-b border-edge">
            {!editingName ? (
              <button onClick={() => setEditingName(true)} className="w-full flex justify-between items-center text-left">
                <span className="text-sm">Name</span>
                <span className="text-xs text-ink-soft">{user.name} ›</span>
              </button>
            ) : (
              <div className="flex gap-2 items-center">
                <input value={name} onChange={(e) => setName(e.target.value)} className="field-input flex-1" autoFocus />
                <button onClick={() => { setName(user.name); setEditingName(false); }} className="text-xs text-ink-mute px-2">cancel</button>
                <button onClick={saveName} disabled={savingName} className="btn-primary text-xs px-3 py-2 rounded-lg">{savingName ? '…' : 'save'}</button>
              </div>
            )}
          </div>
          <div className="px-4 py-3.5 border-b border-edge flex justify-between items-center">
            <span className="text-sm">Email</span>
            <span className="text-xs text-ink-soft">{user.email || 'Legacy account'}</span>
          </div>
          <button onClick={() => setPasswordModal(true)} className="w-full px-4 py-3.5 border-b border-edge flex justify-between items-center hover:bg-paper-tint/50 transition">
            <span className="text-sm text-left">Change password</span>
            <span className="text-xs text-ink-soft">›</span>
          </button>
          <button onClick={() => setRecoveryModal(true)} className="w-full px-4 py-3.5 flex justify-between items-center hover:bg-paper-tint/50 transition">
            <span className="text-sm text-left">Rotate recovery key</span>
            <span className="text-xs text-ink-soft">›</span>
          </button>
        </div>

        <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2">Security</p>
        <div className="bg-paper-card border border-edge rounded-2xl mb-5">
          <div className="px-4 py-3.5 border-b border-edge flex justify-between items-center">
            <div>
              <p className="text-sm">Authenticator MFA</p>
              <p className="text-xs text-ink-soft mt-0.5">{mfaEnabled ? 'Enabled' : 'Not enabled'}</p>
            </div>
            {!mfaEnabled ? (
              <button onClick={startMfaSetup} disabled={mfaLoading} className="btn-primary text-xs px-3 py-2 rounded-lg">
                {mfaLoading ? 'Starting…' : 'Enable MFA'}
              </button>
            ) : (
              <button onClick={() => setMfaDisableOpen(true)} className="text-xs px-3 py-2 rounded-lg border border-edge">
                Disable MFA
              </button>
            )}
          </div>

          <div className="px-4 py-3.5 flex justify-between items-center">
            <div>
              <p className="text-sm">Export your data</p>
              <p className="text-xs text-ink-soft mt-0.5">Download all your records as CSV. No data is removed.</p>
            </div>
            <button onClick={exportData} disabled={exportLoading} className="text-xs px-3 py-2 rounded-lg border border-edge">
              {exportLoading ? 'Preparing…' : 'Export (CSV)'}
            </button>
          </div>

          {mfaError && <p className="px-4 pb-3 text-xs text-danger">{mfaError}</p>}
        </div>

        <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2">Danger zone</p>
        <div className="bg-paper-card border border-edge rounded-2xl mb-5">
          <button onClick={() => setDeleteModal(true)} className="w-full px-4 py-3.5 flex justify-between items-center hover:bg-danger-soft/40 transition">
            <span className="text-sm text-danger text-left">Delete account</span>
            <span className="text-xs text-danger">›</span>
          </button>
          <p className="px-4 pb-3 text-xs text-ink-soft">This permanently removes your account and related investment data.</p>
        </div>


      </div>

      {passwordModal && (
        <div className="fixed inset-0 bg-ink/60 z-50 flex items-center justify-center p-4 anim-fade" onClick={() => setPasswordModal(false)}>
          <div className="bg-paper-card rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-medium text-center mb-1">Change password</h2>
            <p className="text-sm text-ink-soft text-center mb-5">Use at least 8 chars with upper/lower/number/symbol</p>
            <label className="block text-xs text-ink-soft mb-1.5">Current password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="field-input mb-3" autoFocus />
            <label className="block text-xs text-ink-soft mb-1.5">New password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="field-input mb-3" />
            <label className="block text-xs text-ink-soft mb-1.5">Confirm new password</label>
            <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="field-input" />
            {passwordError && <p className="text-xs text-danger text-center mt-3">{passwordError}</p>}
            {savingPassword && <p className="text-xs text-ink-mute text-center mt-3">Updating…</p>}
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={() => setPasswordModal(false)} className="text-xs px-3 py-2 border border-edge rounded-lg">Cancel</button>
              <button onClick={savePassword} className="btn-primary text-xs px-3 py-2 rounded-lg" disabled={savingPassword}>Save password</button>
            </div>
          </div>
        </div>
      )}

      {recoveryModal && (
        <div className="fixed inset-0 bg-ink/60 z-50 flex items-center justify-center p-4 anim-fade" onClick={() => setRecoveryModal(false)}>
          <div className="bg-paper-card rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-medium text-center mb-1">Rotate recovery key</h2>
            <p className="text-sm text-ink-soft text-center mb-5">Store this in a safe place. It is required for free password recovery.</p>
            <label className="block text-xs text-ink-soft mb-1.5">Current password</label>
            <input type="password" value={recoveryCurrentPassword} onChange={(e) => setRecoveryCurrentPassword(e.target.value)} className="field-input mb-3" autoFocus />
            <label className="block text-xs text-ink-soft mb-1.5">New recovery key</label>
            <input type="password" value={newRecoveryKey} onChange={(e) => setNewRecoveryKey(e.target.value)} className="field-input mb-3" />
            <label className="block text-xs text-ink-soft mb-1.5">Confirm recovery key</label>
            <input type="password" value={confirmRecoveryKey} onChange={(e) => setConfirmRecoveryKey(e.target.value)} className="field-input" />
            {recoveryError && <p className="text-xs text-danger text-center mt-3">{recoveryError}</p>}
            {savingRecovery && <p className="text-xs text-ink-mute text-center mt-3">Updating…</p>}
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={() => setRecoveryModal(false)} className="text-xs px-3 py-2 border border-edge rounded-lg">Cancel</button>
              <button onClick={saveRecoveryKey} className="btn-primary text-xs px-3 py-2 rounded-lg" disabled={savingRecovery}>Save key</button>
            </div>
          </div>
        </div>
      )}

      {mfaSetupOpen && (
        <div className="fixed inset-0 bg-ink/60 z-50 flex items-center justify-center p-4 anim-fade" onClick={() => setMfaSetupOpen(false)}>
          <div className="bg-paper-card rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-medium text-center mb-1">Enable MFA</h2>
            <p className="text-sm text-ink-soft text-center mb-4">Scan with any of these authenticator apps:</p>

            {/* Authenticator Apps Links */}
            <div className="bg-edge/30 rounded-lg p-3 mb-4 space-y-2">
              {AUTHENTICATOR_APPS.map((app) => (
                <div key={app.name} className="flex items-center justify-between">
                  <span className="text-xs text-ink-soft">{app.name}</span>
                  <div className="flex gap-1.5">
                    <a
                      href={app.ios}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-1.5 py-0.5 bg-mint-600/20 text-mint-600 text-[10px] rounded hover:bg-mint-600/30 transition"
                    >
                      iOS
                    </a>
                    <a
                      href={app.android}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-1.5 py-0.5 bg-mint-600/20 text-mint-600 text-[10px] rounded hover:bg-mint-600/30 transition"
                    >
                      Android
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {mfaQrCode ? <img src={mfaQrCode} alt="MFA QR code" className="w-40 h-40 mx-auto mb-3 rounded-lg border border-edge" /> : null}
            <p className="text-[11px] text-ink-soft break-all mb-3">Manual code: {mfaSetupSecret}</p>
            <label className="block text-xs text-ink-soft mb-1.5">Verification code</label>
            <input type="text" inputMode="numeric" value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="field-input" placeholder="123456" />
            {mfaError && <p className="text-xs text-danger text-center mt-3">{mfaError}</p>}
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={() => setMfaSetupOpen(false)} className="text-xs px-3 py-2 border border-edge rounded-lg">Cancel</button>
              <button onClick={enableMfa} className="btn-primary text-xs px-3 py-2 rounded-lg" disabled={mfaLoading}>Enable</button>
            </div>
          </div>
        </div>
      )}

      {mfaDisableOpen && (
        <div className="fixed inset-0 bg-ink/60 z-50 flex items-center justify-center p-4 anim-fade" onClick={() => setMfaDisableOpen(false)}>
          <div className="bg-paper-card rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-medium text-center mb-1">Disable MFA</h2>
            <p className="text-sm text-ink-soft text-center mb-4">Confirm password and current authenticator code.</p>
            <label className="block text-xs text-ink-soft mb-1.5">Current password</label>
            <input type="password" value={mfaDisablePassword} onChange={(e) => setMfaDisablePassword(e.target.value)} className="field-input mb-3" />
            <label className="block text-xs text-ink-soft mb-1.5">MFA code</label>
            <input type="text" inputMode="numeric" value={mfaDisableCode} onChange={(e) => setMfaDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="field-input" placeholder="123456" />
            {mfaError && <p className="text-xs text-danger text-center mt-3">{mfaError}</p>}
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={() => setMfaDisableOpen(false)} className="text-xs px-3 py-2 border border-edge rounded-lg">Cancel</button>
              <button onClick={disableMfa} className="btn-primary text-xs px-3 py-2 rounded-lg" disabled={mfaLoading}>Disable</button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 bg-ink/60 z-50 flex items-center justify-center p-4 anim-fade" onClick={() => setDeleteModal(false)}>
          <div className="bg-paper-card rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-medium text-center mb-1">Delete account</h2>
            <p className="text-sm text-ink-soft text-center mb-4">This action is permanent. Enter your password and type DELETE to continue.</p>

            <label className="block text-xs text-ink-soft mb-1.5">Current password</label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="field-input mb-3"
              autoFocus
            />

            <label className="block text-xs text-ink-soft mb-1.5">Type DELETE</label>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="field-input"
              placeholder="DELETE"
            />

            {deleteError && <p className="text-xs text-danger text-center mt-3">{deleteError}</p>}

            <div className="mt-5 flex justify-center gap-2">
              <button onClick={() => setDeleteModal(false)} className="text-xs px-3 py-2 border border-edge rounded-lg" disabled={deleteLoading}>Cancel</button>
              <button onClick={deleteAccount} className="text-xs px-3 py-2 rounded-lg bg-danger text-paper font-medium" disabled={deleteLoading}>
                {deleteLoading ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
