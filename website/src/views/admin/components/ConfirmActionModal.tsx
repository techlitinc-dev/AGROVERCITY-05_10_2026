import { useState } from 'react';
import { useT } from '../../../lib/i18n';
import { isApiError } from '../../../lib/api/client';
import { verifyMpin } from '../../../lib/api/admin';

export interface ConfirmField {
  key: string;
  labelKey: string;
  placeholderKey?: string;
}

interface Props {
  title: string;
  requireMpin?: boolean;
  fields?: ConfirmField[];
  onConfirm: (reason: string, extra: Record<string, string>) => Promise<void>;
  onClose: () => void;
}

/**
 * Two-step safeguard: mandatory reason (≥3 chars) then admin MPIN re-entry.
 * All state is React state — no browser dialog APIs are used anywhere.
 */
export default function ConfirmActionModal({
  title,
  requireMpin = true,
  fields = [],
  onConfirm,
  onClose,
}: Props) {
  const t = useT();
  const [step, setStep] = useState<1 | 2>(1);
  const [reason, setReason] = useState('');
  const [mpin, setMpin] = useState('');
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (requireMpin) {
        await verifyMpin(mpin);
      }
      await onConfirm(reason, extra);
      onClose();
    } catch (e) {
      if (isApiError(e) && e.status === 403) {
        setError(t('admin.modal.invalidMpin'));
      } else {
        setError(isApiError(e) ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
      <div className="admin-modal">
        <h3>{title}</h3>
        {step === 1 && (
          <>
            {fields.map((field) => (
              <label key={field.key} style={{ display: 'block', marginBottom: 8 }}>
                <span className="admin-nav-group-label">{t(field.labelKey)}</span>
                <input
                  className="admin-input"
                  value={extra[field.key] ?? ''}
                  placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined}
                  onChange={(e) => setExtra((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              </label>
            ))}
            <label style={{ display: 'block', marginBottom: 8 }}>
              <span className="admin-nav-group-label">{t('admin.modal.reasonLabel')}</span>
              <textarea
                className="admin-textarea"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {error && <p className="admin-error">{error}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="admin-button secondary" onClick={onClose} disabled={busy}>
                {t('admin.modal.cancel')}
              </button>
              <button
                className="admin-button"
                disabled={reason.trim().length < 3 || busy}
                onClick={() => setStep(2)}
              >
                {t('admin.modal.confirm')}
              </button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <label style={{ display: 'block', marginBottom: 8 }}>
              <span className="admin-nav-group-label">{t('admin.modal.mpinLabel')}</span>
              <input
                className="admin-input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={mpin}
                onChange={(e) => setMpin(e.target.value)}
              />
            </label>
            {error && <p className="admin-error">{error}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="admin-button secondary" onClick={() => setStep(1)} disabled={busy}>
                {t('admin.modal.cancel')}
              </button>
              <button className="admin-button" onClick={submit} disabled={busy || mpin.length < 4}>
                {t('admin.modal.confirm')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
