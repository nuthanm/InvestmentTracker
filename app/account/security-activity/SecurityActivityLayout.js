'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const MENU_ITEMS = [
  { label: 'Account Settings', href: '/account', icon: 'settings' },
  { label: 'Security Activity', href: '/account/security-activity', icon: 'shield' },
];

function MenuIcon({ name }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'settings') return (<svg {...common}><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"/></svg>);
  if (name === 'shield') return (<svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>);
  return null;
}

export default function SecurityActivityLayout({ children }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const [menuWidth, setMenuWidth] = useState(240);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;
      
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      
      if (newWidth > 200 && newWidth < 500) {
        setMenuWidth(newWidth);
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

  return (
    <div ref={containerRef} className="flex gap-0 h-full">
      {/* Sidebar */}
      <aside
        className={`bg-paper-card border-r border-edge flex flex-col transition-all duration-300 overflow-hidden ${
          isOpen ? '' : 'w-0'
        }`}
        style={{ width: isOpen ? menuWidth : 0, minWidth: isOpen ? menuWidth : 0 }}
      >
        <div className="flex-1 overflow-y-auto">
          <nav className="space-y-1 p-3">
            {MENU_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition whitespace-nowrap ${
                    isActive
                      ? 'bg-mint-50 text-mint-600 font-medium'
                      : 'text-ink-soft hover:bg-paper-tint'
                  }`}
                >
                  <MenuIcon name={item.icon} />
                  <span className="flex-1">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Divider with resize handle */}
      {isOpen && (
        <div
          onMouseDown={handleMouseDown}
          className="w-1 bg-edge hover:bg-mint-600 cursor-col-resize transition-colors active:bg-mint-600 flex-shrink-0"
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 px-4 md:px-0 py-0 bg-transparent">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-paper-tint transition md:hidden"
            title={isOpen ? 'Collapse menu' : 'Expand menu'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {isOpen ? (
                <>
                  <line x1="15" y1="19" x2="15" y2="5" />
                  <polyline points="8 12 15 19 8 26" />
                </>
              ) : (
                <>
                  <line x1="9" y1="19" x2="9" y2="5" />
                  <polyline points="16 12 9 5 16 12" />
                </>
              )}
            </svg>
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
