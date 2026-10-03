import type { ReactNode } from 'react';

interface ModalSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** Bottom-sheet modal using the tokens.css av-modal-backdrop / av-modal-sheet classes. */
export default function ModalSheet({ open, onClose, title, children }: ModalSheetProps) {
  if (!open) return null;
  return (
    <div
      className="av-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="av-modal-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="av-sheet-handle" />
        {title ? <h3 className="av-sheet-title">{title}</h3> : null}
        {children}
      </div>
    </div>
  );
}
