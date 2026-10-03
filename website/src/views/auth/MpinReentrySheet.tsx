import { useState } from 'react';
import ModalSheet from '../../components/ModalSheet';
import MpinPad from '../../components/MpinPad';
import { refreshTokens, verifyMpin } from '../../lib/api/auth';
import { isApiError } from '../../lib/api/client';
import { useT } from '../../lib/i18n';
import { useSessionStore } from '../../stores/session';

/**
 * Session-restore UX (missing.md F2): after a 401 refresh failure the client
 * stores `mpinReentryRequired` instead of hard-logging-out; this sheet verifies
 * the MPIN and silently refreshes the token pair. A cancel clears the session
 * and falls back to the normal login flow.
 */
export default function MpinReentrySheet() {
  const t = useT();
  const [mpin, setMpin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setTokens = useSessionStore((s) => s.setTokens);
  const setMpinReentryRequired = useSessionStore((s) => s.setMpinReentryRequired);
  const clear = useSessionStore((s) => s.clear);

  const handleSubmit = async () => {
    if (mpin.length !== 4 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const refreshToken = useSessionStore.getState().refreshToken;
      if (!refreshToken) {
        setError(t('auth.mpinReentry.failed'));
        return;
      }
      await verifyMpin(mpin, refreshToken);
      const pair = await refreshTokens(refreshToken);
      setTokens(pair.accessToken, pair.refreshToken);
      setMpinReentryRequired(false);
      if (window.location.search.includes('reentry=mpin')) {
        window.history.back();
      } else {
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch (e) {
      setError(isApiError(e) ? e.message : t('auth.mpinReentry.failed'));
      setMpin('');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    clear();
    window.history.replaceState(null, '', window.location.pathname);
  };

  return (
    <ModalSheet open onClose={handleCancel} title={t('auth.mpinReentry.title')}>
      <p style={{ marginBottom: 14, fontSize: 13, color: 'var(--av-slate-1)' }}>
        {t('auth.mpinReentry.subtitle')}
      </p>
      <MpinPad label={t('mpinFourDigits')} value={mpin} onChange={setMpin} error={error !== null} />
      {error ? <p className="mpin-match-text bad">{error}</p> : null}
      <button
        type="button"
        className="av-btn av-btn-primary"
        disabled={mpin.length !== 4 || busy}
        onClick={() => void handleSubmit()}
      >
        {busy ? <span className="av-spinner" /> : t('auth.mpinReentry.submit')}
      </button>
      <button type="button" className="av-btn" style={{ marginTop: 8 }} onClick={handleCancel}>
        {t('back')}
      </button>
    </ModalSheet>
  );
}
