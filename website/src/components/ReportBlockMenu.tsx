import { useEffect, useState } from 'react';
import { toast } from './toast';
import { blockUser, getBlockedIds, reportUser, unblockUser } from '../lib/api/users';
import { useT } from '../lib/i18n';

/**
 * Report / block menu (WS-03 X9) — mounted on chat, deal and profile surfaces.
 * Report posts to /users/{id}/report; block toggles /users/me/blocks. All
 * feedback goes through toasts; no alert()/confirm()/prompt().
 */
export default function ReportBlockMenu({ userId }: { userId?: string | null }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    getBlockedIds()
      .then((ids) => setBlocked(ids.includes(userId)))
      .catch(() => undefined);
  }, [userId]);

  if (!userId) return null;

  const doReport = async () => {
    setBusy(true);
    try {
      await reportUser(userId, 'user_report');
      toast(t('trust.reported'));
      setOpen(false);
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const doBlock = async () => {
    setBusy(true);
    try {
      if (blocked) {
        await unblockUser(userId);
        setBlocked(false);
        toast(t('trust.unblocked'));
      } else {
        await blockUser(userId);
        setBlocked(true);
        toast(t('trust.blocked'));
      }
      setOpen(false);
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="av-btn av-btn-ghost"
        aria-label="menu"
        onClick={() => setOpen((v) => !v)}
      >
        ⋮
      </button>
      {open ? (
        <div
          style={{
            position: 'absolute',
            right: 0,
            zIndex: 20,
            background: 'var(--av-card, #fff)',
            border: '1px solid var(--av-border, #ddd)',
            borderRadius: 8,
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            minWidth: 140,
          }}
        >
          <button type="button" className="av-btn av-btn-plain" disabled={busy} onClick={() => void doReport()}>
            {t('trust.report')}
          </button>
          <button type="button" className="av-btn av-btn-plain" disabled={busy} onClick={() => void doBlock()}>
            {blocked ? t('trust.unblock') : t('trust.block')}
          </button>
        </div>
      ) : null}
    </span>
  );
}
