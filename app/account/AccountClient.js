'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Shell from '@/components/Shell';
import PinInput from '@/components/PinInput';
import { toast } from '@/components/Toast';

export default function AccountClient({ user }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);

  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinStep, setPinStep] = useState('current');
  const [pinError, setPinError] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  const initials = (name || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

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

  const onCurrentPin = (val) => {
    setCurrentPin(val);
    if (val.length === 6) setPinStep('new');
  };

  const onNewPin = async (val) => {
    setNewPin(val);
    if (val.length !== 6) return;
    setSavingPin(true);
    setPinError('');
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin: val }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not change PIN.');
      setPinModal(false);
      setCurrentPin('');
      setNewPin('');
      setPinStep('current');
      toast('PIN changed successfully.');
    } catch (err) {
      setPinError(err.message);
      setCurrentPin('');
      setNewPin('');
      setPinStep('current');
    }
    setSavingPin(false);
  };

  const signOut = async () => {
    await fetch('/api/auth/me', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  return (
    <Shell user={user}>
      <div className="px-4 md:px-8 py-5 md:py-6 max-w-2xl mx-auto w-full">

        <h1 className="text-2xl md:text-3xl font-medium tracking-tight mb-1">Account</h1>
        <p className="text-sm text-ink-soft mb-6">Manage your profile and preferences</p>

        <div className="flex items-center gap-3.5 p-4 bg-paper-tint rounded-2xl mb-6">
          <div className="w-12 h-12 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center font-medium">{initials}</div>
          <div className="flex-1 min-w-0">
            <p className="font-medium">{user.name}</p>
            <p className="text-xs text-ink-soft mt-0.5">{user.mobile}</p>
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
                <input value={name} onChange={(e) => setName(e.target.value)} className="field-input flex-1" autoFocus/>
                <button onClick={() => { setName(user.name); setEditingName(false); }} className="text-xs text-ink-mute px-2">cancel</button>
                <button onClick={saveName} disabled={savingName} className="btn-primary text-xs px-3 py-2 rounded-lg">{savingName ? '…' : 'save'}</button>
              </div>
            )}
          </div>
          <div className="px-4 py-3.5 border-b border-edge flex justify-between items-center">
            <span className="text-sm">Mobile number</span>
            <span className="text-xs text-ink-soft">{user.mobile}</span>
          </div>
          <button onClick={() => setPinModal(true)} className="w-full px-4 py-3.5 flex justify-between items-center hover:bg-paper-tint/50 transition">
            <span className="text-sm text-left">Change PIN</span>
            <span className="text-xs text-ink-soft">›</span>
          </button>
        </div>

        <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2">Session</p>
        <div className="bg-paper-card border border-edge rounded-2xl">
          {confirmSignOut ? (
            <div className="px-4 py-3.5 flex items-center justify-between gap-3">
              <span className="text-sm text-ink-soft">Sure you want to sign out?</span>
              <div className="flex gap-2">
                <button onClick={() => setConfirmSignOut(false)} className="text-xs px-3 py-1.5 rounded-lg border border-edge hover:bg-paper-tint">Cancel</button>
                <button onClick={signOut} className="text-xs px-3 py-1.5 rounded-lg bg-danger text-paper font-medium">Sign out</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmSignOut(true)} className="w-full px-4 py-3.5 flex justify-between items-center hover:bg-danger-soft/40 transition">
              <span className="text-sm text-danger text-left">Sign out</span>
              <span className="text-xs text-danger">›</span>
            </button>
          )}
        </div>

      </div>

      {pinModal && (
        <div className="fixed inset-0 bg-ink/60 z-50 flex items-center justify-center p-4 anim-fade" onClick={() => setPinModal(false)}>
          <div className="bg-paper-card rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-medium text-center mb-1">
              {pinStep === 'current' ? 'Enter current PIN' : 'Choose new PIN'}
            </h2>
            <p className="text-sm text-ink-soft text-center mb-5">
              {pinStep === 'current' ? 'For security, confirm your current PIN' : '6 digits, type carefully'}
            </p>
            {pinStep === 'current' ? (
              <PinInput value={currentPin} onChange={onCurrentPin} autoFocus/>
            ) : (
              <PinInput value={newPin} onChange={onNewPin} autoFocus/>
            )}
            {pinError && <p className="text-xs text-danger text-center mt-3">{pinError}</p>}
            {savingPin && <p className="text-xs text-ink-mute text-center mt-3">Updating…</p>}
            <button onClick={() => { setPinModal(false); setCurrentPin(''); setNewPin(''); setPinStep('current'); setPinError(''); }}
              className="text-xs text-ink-mute mt-5 mx-auto block">cancel</button>
          </div>
        </div>
      )}
    </Shell>
  );
}
