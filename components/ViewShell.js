'use client';

import { useRouter } from 'next/navigation';
import BrandMark from './BrandMark';
import Icon from './Icon';

export default function ViewShell({ token, ownerName, children }) {
  const router = useRouter();

  const leave = async () => {
    await fetch('/api/view/session', { method: 'DELETE' });
    router.push(`/view/${token}`);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-20 border-b border-edge bg-paper/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-3 flex items-center gap-3">
          <BrandMark size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{ownerName ? `${ownerName}'s portfolio` : 'Private view'}</p>
            <p className="text-[12px] text-ink-mute flex items-center gap-1"><Icon name="eye" size={13} />View only · InvestmentTracker</p>
          </div>
          <button type="button" onClick={leave} className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-edge hover:bg-paper-tint transition">
            <Icon name="logout" size={14} />Leave view
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
