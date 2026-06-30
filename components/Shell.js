'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Toaster from './Toast';

const NAV_ITEMS = [
  { key: 'home', label: 'Home', href: '/home', icon: 'home' },
  { key: 'goals', label: 'Goals', href: '/goals', icon: 'target' },
  { key: 'investments', label: 'List', href: '/investments', icon: 'list' },
  { key: 'account', label: 'Account', href: '/account', icon: 'user' },
  { key: 'security', label: 'Security Activity', href: '/account/security-activity', icon: 'shield' },
];

function NavIcon({ name }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'home') return (<svg {...common}><path d="M3 9.5L12 3l9 6.5V21H3z"/><path d="M9 21V12h6v9"/></svg>);
  if (name === 'target') return (<svg {...common}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>);
  if (name === 'list') return (<svg {...common}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>);
  if (name === 'plus') return (<svg {...common}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>);
  if (name === 'user') return (<svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>);
  if (name === 'shield') return (<svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>);
  if (name === 'bell') return (<svg {...common}><path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21a2 2 0 004 0"/></svg>);
  return null;
}

export default function Shell({ children, user }) {
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [isDragging, setIsDragging] = useState(false);
  const sidebarRef = useRef(null);

  const refreshUnread = async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setUnread(data.unreadCount || 0);
      }
    } catch {}
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const res = await fetch('/api/auth/me', { method: 'DELETE' });
      if (res.ok) {
        router.push('/login');
        router.refresh();
      }
    } catch (err) {
      console.error('Sign out failed:', err);
    } finally {
      setSigningOut(false);
    }
  };

  useEffect(() => { refreshUnread(); }, [pathname]);
  useEffect(() => { setShowProfileMenu(false); }, [pathname]);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !sidebarRef.current || !sidebarOpen) return;
      const rect = sidebarRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      const maxWidth = Math.min(500, window.innerWidth * 0.5);
      if (newWidth > 150 && newWidth < maxWidth) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const initials = (user?.name || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Toaster />

      <aside ref={sidebarRef} className="hidden md:flex md:flex-col md:border-r md:border-edge md:bg-paper-tint md:py-5 md:overflow-hidden transition-all duration-200 md:h-screen md:sticky md:top-0" style={{ width: sidebarOpen ? sidebarWidth : 60, minWidth: sidebarOpen ? sidebarWidth : 60 }}>
        {/* Logo */}
        <Link href="/home" className={`flex items-center gap-2 px-3 pb-4 mb-2 border-b border-edge ${sidebarOpen ? '' : 'justify-center'}`}>
          <div className="w-9 h-9 rounded-xl bg-ink text-paper flex items-center justify-center font-medium text-sm">₹</div>
          {sidebarOpen && <div className="font-medium">My Investments</div>}
        </Link>

        {/* Navigation Items */}
        <nav className="overflow-y-auto overflow-x-hidden px-2 space-y-1">
          {NAV_ITEMS.map(item => {
            const active = item.href === pathname || (item.href !== '/account' && pathname.startsWith(item.href));
            return (
              <div key={item.key} className="relative group">
                <Link href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-ink transition whitespace-nowrap ${active ? 'bg-paper-card font-medium shadow-sm' : 'hover:bg-paper-card/40'}`}
                  title={!sidebarOpen ? item.label : ''}>
                  <div className="flex-shrink-0"><NavIcon name={item.icon} /></div>
                  {sidebarOpen && <span className="flex-1 min-w-0 truncate">{item.label}</span>}
                </Link>
                {!sidebarOpen && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1.5 bg-paper-card text-ink text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    {item.label}
                  </div>
                )}
              </div>
            );
          })}
        </nav>



        {/* Collapse/Expand Button */}
        <div className="px-2 border-t border-edge pt-2 mt-auto">
          <div className="relative group">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} 
              className={`w-full flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'} px-3 py-2.5 rounded-lg text-sm text-ink hover:bg-paper-card/40 transition`}
              title={sidebarOpen ? 'Collapse' : 'Expand'}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                {sidebarOpen ? (
                  <path d="M15 18l-6-6 6-6" />
                ) : (
                  <path d="M9 18l6-6-6-6" />
                )}
              </svg>
              {sidebarOpen && <span className="flex-1 text-left">Collapse</span>}
            </button>
            {!sidebarOpen && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1.5 bg-paper-card text-ink text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                {sidebarOpen ? 'Collapse' : 'Expand'}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Draggable Divider - Only when sidebar is open */}
      {sidebarOpen && (
        <div onMouseDown={handleMouseDown} className="hidden md:block w-1 bg-edge hover:bg-mint-600 cursor-col-resize transition-colors active:bg-mint-600 flex-shrink-0" style={{ cursor: isDragging ? 'col-resize' : 'col-resize' }} />
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-20 bg-paper-card border-b border-edge px-4 py-3 flex items-center justify-between">
          <Link href="/home" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-ink text-paper flex items-center justify-center font-medium text-xs">₹</div>
            <div className="text-sm font-medium">My Investments</div>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/notifications" className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-paper-tint">
              <NavIcon name="bell" />
              {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-danger text-white text-[10px] font-medium rounded-full flex items-center justify-center">{unread}</span>}
            </Link>
            <div className="relative">
              <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="w-8 h-8 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center text-xs font-medium hover:ring-2 hover:ring-sky-200 transition">
                {initials}
              </button>
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-40 bg-paper-card border border-edge rounded-lg shadow-lg overflow-hidden z-50">
                  <Link href="/account" onClick={() => setShowProfileMenu(false)} className="block px-4 py-3 text-sm text-ink hover:bg-paper-tint border-b border-edge">
                    Account Settings
                  </Link>
                  <button onClick={() => { setShowProfileMenu(false); setConfirmSignOut(true); }} className="w-full text-left px-4 py-3 text-sm text-danger hover:bg-danger/5 transition">
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <header className="hidden md:flex sticky top-0 z-20 bg-paper-card border-b border-edge px-6 h-14 items-center justify-end gap-3">
          <Link href="/notifications" className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-paper-tint">
            <NavIcon name="bell" />
            {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-danger text-white text-[10px] font-medium rounded-full flex items-center justify-center">{unread}</span>}
          </Link>
          <div className="relative">
            <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="w-8 h-8 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center text-xs font-medium hover:ring-2 hover:ring-sky-200 transition">
              {initials}
            </button>
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-paper-card border border-edge rounded-lg shadow-lg overflow-hidden z-50">
                <Link href="/account" onClick={() => setShowProfileMenu(false)} className="block px-4 py-3 text-sm text-ink hover:bg-paper-tint border-b border-edge">
                  Account Settings
                </Link>
                <button onClick={() => { setShowProfileMenu(false); setConfirmSignOut(true); }} className="w-full text-left px-4 py-3 text-sm text-danger hover:bg-danger/5 transition">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {confirmSignOut && (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
            <div className="bg-paper-card border border-edge rounded-2xl p-6 max-w-sm">
              <h3 className="font-medium text-ink mb-2">Sign out</h3>
              <p className="text-sm text-ink-soft mb-6">Sure you want to sign out?</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setConfirmSignOut(false)} disabled={signingOut} className="px-4 py-2 text-sm rounded-lg border border-edge hover:bg-paper-tint disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleSignOut} disabled={signingOut} className="px-4 py-2 text-sm rounded-lg bg-danger text-paper font-medium hover:bg-danger-dark disabled:opacity-50">
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 anim-fade pb-24 md:pb-0">
          {children}
        </div>

        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-paper-card border-t border-edge z-30 flex items-center px-2 py-1.5 overflow-x-auto overflow-y-hidden">
          {NAV_ITEMS.filter(item => item.key !== 'security' && item.key !== 'add').map(item => {
            const active = pathname.startsWith(item.href);
            return (
              <Link key={item.key} href={item.href}
                className={`flex-1 flex flex-col items-center gap-1 py-1.5 text-[11px] ${active ? 'text-ink font-medium' : 'text-ink-mute'}`}>
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${active ? 'bg-ink text-paper' : 'bg-transparent'}`}>
                  <NavIcon name={item.icon} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
