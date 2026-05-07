'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';

function timeAgo(d) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.round(diff / 60) + 'm ago';
  if (diff < 86400) return Math.round(diff / 3600) + 'h ago';
  return Math.round(diff / 86400) + 'd ago';
}

export default function NotificationsClient({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch('/api/notifications').then(r => r.json()).then(d => {
      setItems(d.notifications || []);
      setLoading(false);
    });
  };
  useEffect(() => { load(); }, []);

  const markOne = async (id) => {
    setItems(items.map(n => n.id === id ? { ...n, read: true } : n));
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  };

  const markAll = async () => {
    setItems(items.map(n => ({ ...n, read: true })));
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
  };

  const unread = items.filter(i => !i.read).length;

  return (
    <Shell user={user}>
      <div className="px-4 md:px-8 py-5 md:py-6 max-w-2xl mx-auto w-full">

        <div className="flex justify-between items-end mb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Reminders</h1>
            <p className="text-sm text-ink-soft mt-1">{unread} unread</p>
          </div>
          {unread > 0 && (
            <button onClick={markAll} className="text-sm text-sky-600 hover:underline">Mark all read</button>
          )}
        </div>

        {loading && <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="h-16 bg-paper-tint rounded-xl animate-pulse" />)}</div>}

        {!loading && items.length === 0 && (
          <div className="text-center py-16">
            <p className="text-base font-medium mb-1">No reminders</p>
            <p className="text-sm text-ink-soft">You're all caught up.</p>
          </div>
        )}

        {!loading && items.map((n) => (
          <button key={n.id} onClick={() => markOne(n.id)}
            className={`w-full flex gap-3 p-3 rounded-xl mb-2 text-left transition ${n.read ? 'bg-paper-card border border-edge' : 'bg-mint-50 border border-mint-600/20'}`}>
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${n.read ? 'bg-transparent' : 'bg-danger'}`}></span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{n.title}</p>
              <p className="text-xs text-ink-soft mt-0.5">{n.message}</p>
              <p className="text-[10px] text-ink-mute mt-1">{timeAgo(n.created_at)}</p>
            </div>
          </button>
        ))}
      </div>
    </Shell>
  );
}
