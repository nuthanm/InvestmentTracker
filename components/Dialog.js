'use client';

import { useEffect, useRef } from 'react';

/**
 * Accessible modal built on the native <dialog> element: focus is trapped,
 * Escape closes it, and focus returns to the opener afterwards.
 * `variant="sheet"` docks it to the bottom edge on phones.
 */
export default function Dialog({ open, onClose, title, children, variant = 'modal', className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const handleCancel = (e) => { e.preventDefault(); onClose?.(); };
    el.addEventListener('cancel', handleCancel);
    return () => el.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  // Clicking the backdrop (the dialog element itself, outside the panel) closes it.
  const onBackdrop = (e) => {
    if (e.target === ref.current) onClose?.();
  };

  return (
    <dialog
      ref={ref}
      onClick={onBackdrop}
      aria-label={title}
      className={`app-dialog app-dialog-${variant} ${className}`}
    >
      {open ? <div className="app-dialog-panel">{children}</div> : null}
    </dialog>
  );
}
