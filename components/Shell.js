'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Toaster from './Toast';
import Icon from './Icon';
import Dialog from './Dialog';
import BrandMark from './BrandMark';

const NAV_ITEMS = [
  { key: 'home', label: 'Home', href: '/home', icon: 'home' },
  { key: 'investments', label: 'Investments', href: '/investments', icon: 'wallet' },
  { key: 'goals', label: 'Goals', href: '/goals', icon: 'target' },
  { key: 'reminders', label: 'Reminders', href: '/notifications', icon: 'calendar', countsUnread: true },
];

const SETTINGS_ITEMS = [
  { key: 'account', label: 'Account', href: '/account', icon: 'user' },
  { key: 'security', label: 'Security', href: '/account/security-activity', icon: 'shield' },
];

const FINANCIAL_QUOTES = [
  { text: 'Do not save what is left after spending, but spend what is left after saving.', author: 'Warren Buffett' },
  { text: 'Price is what you pay. Value is what you get.', author: 'Warren Buffett' },
  { text: 'Risk comes from not knowing what you are doing.', author: 'Warren Buffett' },
  { text: 'Someone is sitting in the shade today because someone planted a tree a long time ago.', author: 'Warren Buffett' },
  { text: 'The big money is not in the buying and selling, but in the waiting.', author: 'Charlie Munger' },
  { text: 'Time is your friend; impulse is your enemy.', author: 'John C. Bogle' },
  { text: 'Know what you own, and know why you own it.', author: 'Peter Lynch' },
  { text: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin' },
  { text: 'Beware of little expenses. A small leak will sink a great ship.', author: 'Benjamin Franklin' },
  { text: 'A budget is telling your money where to go instead of wondering where it went.', author: 'Dave Ramsey' },
  { text: 'It is not how much money you make, but how much money you keep.', author: 'Robert Kiyosaki' },
  { text: 'The four most dangerous words in investing are: this time it is different.', author: 'John Templeton' },
];

function pageTitle(pathname) {
  if (pathname === '/home') return 'Home';
  if (pathname === '/investments/new') return 'Add investment';
  if (/^\/investments\/[^/]+\/edit/.test(pathname)) return 'Edit investment';
  if (pathname.startsWith('/investments/')) return 'Investment';
  if (pathname.startsWith('/investments')) return 'Investments';
  if (pathname === '/goals/new') return 'New goal';
  if (pathname.startsWith('/goals')) return 'Goals';
  if (pathname.startsWith('/notifications')) return 'Reminders';
  if (pathname.startsWith('/account/security-activity')) return 'Security';
  if (pathname.startsWith('/account')) return 'Account';
  return 'InvestmentTracker';
}

function isActive(href, pathname) {
  if (href === '/account') return pathname === '/account';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function readStored(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function writeStored(key, value) {
  try { window.localStorage.setItem(key, value); } catch {}
}

/** Blurs every element whose own text holds a rupee amount while `enabled` is on. */
function useAmountMask(enabled, rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const clear = () => root.querySelectorAll('.amount-masked').forEach((el) => el.classList.remove('amount-masked'));
    if (!enabled) { clear(); return undefined; }

    let frame = 0;
    const mark = () => {
      frame = 0;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.nodeValue && node.nodeValue.includes('₹') && node.parentElement) {
          node.parentElement.classList.add('amount-masked');
        }
      }
    };
    mark();
    const observer = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(mark); });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); clear(); };
  }, [enabled, rootRef]);
}

function NavLink({ item, pathname, collapsed, count = 0 }) {
  const active = isActive(item.href, pathname);
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      data-tip={collapsed ? item.label : undefined}
      className={`shell-nav-item${active ? ' is-active' : ''}`}
    >
      <Icon name={item.icon} />
      {!collapsed && <span className="flex-1 min-w-0 truncate">{item.label}</span>}
      {!collapsed && count > 0 && <span className="shell-nav-count">{count}</span>}
      {collapsed && count > 0 && <span className="shell-nav-dot" />}
    </Link>
  );
}

export default function Shell({ children, user }) {
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [masked, setMasked] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [quote, setQuote] = useState(null);
  const contentRef = useRef(null);
  const searchRef = useRef(null);
  const profileRef = useRef(null);

  useAmountMask(masked, contentRef);

  useEffect(() => {
    setCollapsed(readStored('sidebar-collapsed') === '1');
    setMasked(readStored('hide-amounts') === '1');
    setQuote(FINANCIAL_QUOTES[Math.floor(Math.random() * FINANCIAL_QUOTES.length)]);
  }, []);

  const refreshUnread = async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setUnread(data.unreadCount || 0);
      }
    } catch {}
  };

  useEffect(() => { refreshUnread(); }, [pathname]);
  useEffect(() => { setShowProfileMenu(false); setMoreOpen(false); }, [pathname]);

  // Close the profile menu on an outside click or Escape.
  useEffect(() => {
    if (!showProfileMenu) return undefined;
    const onDown = (e) => { if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfileMenu(false); };
    const onKey = (e) => { if (e.key === 'Escape') setShowProfileMenu(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [showProfileMenu]);

  // "/" focuses search unless the user is already typing somewhere.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => { writeStored('sidebar-collapsed', prev ? '0' : '1'); return !prev; });
  };

  const toggleMasked = () => {
    setMasked((prev) => { writeStored('hide-amounts', prev ? '0' : '1'); return !prev; });
  };

  const submitSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/investments?q=${encodeURIComponent(q)}` : '/investments');
    window.dispatchEvent(new CustomEvent('app:search', { detail: q }));
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

  const closeSignOut = useCallback(() => { if (!signingOut) setConfirmSignOut(false); }, [signingOut]);
  const closeMore = useCallback(() => setMoreOpen(false), []);

  const initials = (user?.name || '?').split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const title = pageTitle(pathname);
  const onInvestments = pathname === '/investments' || (pathname.startsWith('/investments/') && pathname !== '/investments/new');

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Toaster />

      <aside className={`shell-side${collapsed ? ' is-collapsed' : ''}`} aria-label="Sidebar">
        <Link href="/home" className="shell-brand" aria-label="InvestmentTracker home">
          <BrandMark />
          {!collapsed && <span className="font-semibold truncate">InvestmentTracker</span>}
        </Link>

        <Link href="/investments/new" className="shell-add" data-tip={collapsed ? 'Add investment' : undefined} aria-label={collapsed ? 'Add investment' : undefined}>
          <Icon name="plus" strokeWidth={2.2} />
          {!collapsed && <span>Add investment</span>}
        </Link>

        <nav className="flex flex-col gap-1" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.key} item={item} pathname={pathname} collapsed={collapsed} count={item.countsUnread ? unread : 0} />
          ))}
          {collapsed ? <div className="border-t border-edge my-2" /> : <p className="shell-nav-group">Settings</p>}
          {SETTINGS_ITEMS.map((item) => (
            <NavLink key={item.key} item={item} pathname={pathname} collapsed={collapsed} />
          ))}
        </nav>

        <div className="mt-auto pt-3 flex flex-col gap-2">
          {!collapsed && quote && (
            <figure className="shell-quote">
              <blockquote>“{quote.text}”</blockquote>
              <figcaption>— {quote.author}</figcaption>
            </figure>
          )}
          <div className="border-t border-edge pt-2">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="shell-nav-item w-full"
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand sidebar' : undefined}
              data-tip={collapsed ? 'Expand sidebar' : undefined}
            >
              <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} />
              {!collapsed && <span className="flex-1 text-left">Collapse</span>}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="shell-bar">
          <Link href="/home" className="md:hidden" aria-label="Home"><BrandMark size="sm" /></Link>
          <p className="shell-title md:hidden">{title}</p>

          <form role="search" onSubmit={submitSearch} className="shell-search">
            <Icon name="search" size={16} />
            <label htmlFor="shell-search-input" className="sr-only">Search investments</label>
            <input
              id="shell-search-input"
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search plans, banks, tags"
              autoComplete="off"
            />
            <kbd aria-hidden="true">/</kbd>
          </form>

          <div className="flex items-center gap-1 ml-auto">
            <Link href="/investments?focus=search" className="shell-icon-btn md:hidden" aria-label="Search investments">
              <Icon name="search" />
            </Link>
            <button
              type="button"
              onClick={toggleMasked}
              className="shell-icon-btn"
              aria-pressed={masked}
              aria-label={masked ? 'Show amounts' : 'Hide amounts'}
              title={masked ? 'Show amounts' : 'Hide amounts'}
            >
              <Icon name={masked ? 'eyeOff' : 'eye'} />
            </button>
            <Link href="/notifications" className="shell-icon-btn relative" aria-label={unread > 0 ? `Reminders, ${unread} unread` : 'Reminders'}>
              <Icon name="bell" />
              {unread > 0 && <span className="shell-badge">{unread}</span>}
            </Link>
            <div className="relative ml-1" ref={profileRef}>
              <button
                type="button"
                onClick={() => setShowProfileMenu((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={showProfileMenu}
                aria-label="Profile menu"
                className="w-9 h-9 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center text-xs font-semibold hover:ring-2 hover:ring-sky-200 transition"
              >
                {initials}
              </button>
              {showProfileMenu && (
                <div role="menu" className="absolute right-0 mt-2 w-48 bg-paper-card border border-edge rounded-xl shadow-lg overflow-hidden z-50">
                  <Link role="menuitem" href="/account" className="flex items-center gap-2.5 px-4 py-3 text-sm text-ink hover:bg-paper-tint border-b border-edge">
                    <Icon name="user" size={16} /> Account settings
                  </Link>
                  <button role="menuitem" type="button" onClick={() => { setShowProfileMenu(false); setConfirmSignOut(true); }} className="w-full flex items-center gap-2.5 text-left px-4 py-3 text-sm text-danger hover:bg-danger/5 transition">
                    <Icon name="logout" size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div ref={contentRef} className="flex-1 anim-fade pb-28 md:pb-0">
          {children}
        </div>

        <nav className="shell-tabbar md:hidden" aria-label="Main">
          <Link href="/home" className={`shell-tab${isActive('/home', pathname) ? ' is-active' : ''}`} aria-current={isActive('/home', pathname) ? 'page' : undefined}>
            <span className="shell-tab-icon"><Icon name="home" /></span>Home
          </Link>
          <Link href="/investments" className={`shell-tab${onInvestments ? ' is-active' : ''}`} aria-current={onInvestments ? 'page' : undefined}>
            <span className="shell-tab-icon"><Icon name="wallet" /></span>Investments
          </Link>
          <Link href="/investments/new" className="shell-tab shell-tab-add">
            <span className="shell-tab-icon"><Icon name="plus" size={22} strokeWidth={2.2} /></span>Add
          </Link>
          <Link href="/goals" className={`shell-tab${isActive('/goals', pathname) ? ' is-active' : ''}`} aria-current={isActive('/goals', pathname) ? 'page' : undefined}>
            <span className="shell-tab-icon"><Icon name="target" /></span>Goals
          </Link>
          <button type="button" onClick={() => setMoreOpen(true)} className={`shell-tab${pathname.startsWith('/account') || pathname.startsWith('/notifications') ? ' is-active' : ''}`} aria-haspopup="dialog">
            <span className="shell-tab-icon relative">
              <Icon name="more" />
              {unread > 0 && <span className="shell-nav-dot" />}
            </span>More
          </button>
        </nav>
      </main>

      <Dialog open={moreOpen} onClose={closeMore} title="More" variant="sheet">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold">More</h2>
          <button type="button" onClick={closeMore} className="shell-icon-btn" aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="flex flex-col gap-1">
          <NavLink item={NAV_ITEMS[3]} pathname={pathname} collapsed={false} count={unread} />
          {SETTINGS_ITEMS.map((item) => <NavLink key={item.key} item={item} pathname={pathname} collapsed={false} />)}
          <button type="button" onClick={() => { setMoreOpen(false); setConfirmSignOut(true); }} className="shell-nav-item w-full !text-danger">
            <Icon name="logout" /><span className="flex-1 text-left">Sign out</span>
          </button>
        </div>
      </Dialog>

      <Dialog open={confirmSignOut} onClose={closeSignOut} title="Sign out">
        <h2 className="font-semibold text-ink mb-2">Sign out</h2>
        <p className="text-sm text-ink-soft mb-6">Are you sure you want to sign out?</p>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={closeSignOut} disabled={signingOut} className="px-4 py-2 text-sm rounded-lg border border-edge hover:bg-paper-tint disabled:opacity-50" autoFocus>
            Cancel
          </button>
          <button type="button" onClick={handleSignOut} disabled={signingOut} className="px-4 py-2 text-sm rounded-lg bg-danger text-paper font-medium hover:opacity-90 disabled:opacity-50">
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
