'use client';

import { useEffect, type ReactNode } from 'react';

type Props = {
  open: boolean;
  title: string;
  titleId?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
  scrollable?: boolean;
};

export function Modal({
  open,
  title,
  titleId = 'modal-title',
  onClose,
  children,
  footer,
  maxWidth = 420,
  scrollable = false,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`modal-dialog${scrollable ? ' modal-dialog--scroll' : ''}`}
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="modal-dialog__title">
          {title}
        </h2>
        {children}
        {footer ? <div className="modal-dialog__footer">{footer}</div> : null}
      </div>
    </div>
  );
}
