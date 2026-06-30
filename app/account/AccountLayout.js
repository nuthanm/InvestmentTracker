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

export default function AccountLayout({ children }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const [menuWidth, setMenuWidth] = useState(260);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const dividerRef = useRef(null);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;
      
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      
      if (newWidth >= 200 && newWidth <= 500) {
        setMenuWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'auto';
      document.body.style.userSelect = 'auto';
    };
  }, [isDragging]);

  return (
    <div ref={containerRef} className="flex h-full bg-paper">
      {/* Sidebar */}
      <aside
        className={`bg-paper-card border-r border-edge flex flex-col transition-all duration-300 overflow-hidden ${
          isDragging ? '' : ''
        }`}
        style={{ 
          width: isOpen ? menuWidth : 0, 
          minWidth: 0,
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? 'visible' : 'hidden'
        }}
      >
        <div className="p-4 border-b border-edge">
          <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wide px-1">Menu</h3>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {MENU_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'bg-mint-50 text-mint-600 shadow-sm'
                    : 'text-ink-soft hover:bg-paper-tint hover:text-ink'
                }`}
              >
                <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                  <MenuIcon name={item.icon} />
                </span>
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Divider with resize handle */}
      {isOpen && (
        <div
          ref={dividerRef}
          onMouseDown={handleMouseDown}
          className="w-1 bg-edge hover:bg-mint-500 cursor-col-resize transition-all duration-200 active:bg-mint-600 active:w-1.5 flex-shrink-0 group"
          title="Drag to resize sidebar"
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-paper-card border-b border-edge">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 ${
              isOpen 
                ? 'hover:bg-paper-tint text-ink' 
                : 'hover:bg-mint-50 text-mint-600'
            }`}
            title={isOpen ? 'Collapse menu' : 'Expand menu'}
            aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <svg 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className={`transition-transform duration-300 ${isOpen ? '' : 'rotate-180'}`}
            >
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
