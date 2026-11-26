'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import Icon from '@/components/Icon';
import PageHeader from '@/components/PageHeader';
import KpiTile from '@/components/KpiTile';

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
  const weekAgo = Date.now() - 7 * 86400000;
  const thisWeek = items.filter(i => new Date(i.created_at).getTime() >= weekAgo).length;

  return (
    <Shell user={user}>
      <div className="page-wrap max-w-3xl">
        <PageHeader
          icon="bell"
          tone="honey"
          title="Reminders"
          subtitle={loading ? 'Loading…' : unread > 0 ? `${unread} unread of ${items.length}` : 'You are all caught up'}
        >
          {unread > 0 && (
            <button type="button" onClick={markAll} className="btn-ghost inline-flex items-center gap-1.5 py-2 px-3.5 rounded-full text-xs font-medium"><Icon name="check" size={15} />Mark all read</button>
          )}
        </PageHeader>

        {!loading && items.length > 0 && (
          <div className="kpi-grid">
            <KpiTile icon="bell" tone="honey" label="Unread" value={unread} note={unread ? 'Tap a reminder to mark it read' : 'Nothing new'} alert={unread > 0} />
            <KpiTile icon="clock" tone="sky" label="Last 7 days" value={thisWeek} note="New reminders this week" />
            <KpiTile icon="checkCircle" tone="mint" label="Read" value={items.length - unread} note={`of ${items.length} reminders`} />
          </div>
        )}

        {loading && <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="h-16 bg-paper-tint rounded-xl animate-pulse" />)}</div>}

        {!loading && items.length === 0 && (
          <div className="panel text-center py-14">
            <span className="mx-auto mb-3 w-12 h-12 rounded-2xl kpi-tone-mint flex items-center justify-center"><Icon name="checkCircle" size={22} /></span>
            <p className="text-base font-medium mb-1">No reminders</p>
            <p className="text-sm text-ink-soft">You're all caught up.</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="panel !p-2">
            {items.map((n) => (
              <button key={n.id} type="button" onClick={() => markOne(n.id)}
                className={`w-full flex gap-3 p-3 rounded-xl text-left transition hover:bg-paper-tint ${n.read ? '' : 'bg-mint-50/60'}`}>
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${n.read ? 'bg-paper-tint text-ink-mute' : 'kpi-tone-honey'}`}>
                  <Icon name={n.read ? 'check' : 'bell'} size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium flex items-center gap-2">{n.title}{!n.read && <span className="w-1.5 h-1.5 rounded-full bg-danger" aria-label="Unread" />}</p>
                  <p className="text-xs text-ink-soft mt-0.5">{n.message}</p>
                </div>
                <span className="text-[11px] text-ink-mute whitespace-nowrap">{timeAgo(n.created_at)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
