import ModalSheet from '../ModalSheet';

interface ConfirmSheetProps {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}

/** Bottom-sheet confirmation used for destructive actions (withdraw/delete/cancel). */
export default function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
  busy,
}: ConfirmSheetProps) {
  return (
    <ModalSheet open={open} onClose={onClose} title={title}>
      {body ? <p className="trade-hint" style={{ marginBottom: 12 }}>{body}</p> : null}
      <div className="trade-actions">
        <button type="button" className="av-btn av-btn-primary" onClick={onConfirm} disabled={busy}>
          {busy ? <span className="av-spinner" aria-hidden /> : confirmLabel}
        </button>
        <button type="button" className="av-btn av-btn-ghost" onClick={onClose} disabled={busy}>
          ← Back
        </button>
      </div>
    </ModalSheet>
  );
}
