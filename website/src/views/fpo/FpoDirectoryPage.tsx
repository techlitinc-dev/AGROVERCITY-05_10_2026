import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  approveFpoJoin,
  listFpos,
  requestFpoJoin,
  type Fpo,
} from '../../lib/api/fpo';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * FPO discovery + join flow (robust.md §7.11, F19). Each FPO renders its
 * membership state from the server (non-member → join request; pending → badge
 * + dev-approve; member → member view). The real approval is the phase-07 admin
 * verification console (A8); the dev-approve button exists only to exercise the
 * farmer flow before that console lands.
 */
export default function FpoDirectoryPage() {
  const t = useT();
  const [fpos, setFpos] = useState<Fpo[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setFpos(await listFpos());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const join = async (fpo: Fpo) => {
    setBusyId(fpo.id);
    try {
      await requestFpoJoin(fpo.id);
      toast(t('fpoJoinSent'));
      await load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusyId(null);
    }
  };

  const approve = async (fpo: Fpo) => {
    setBusyId(fpo.id);
    try {
      await approveFpoJoin(fpo.id);
      toast(t('fpoMembershipMember'));
      await load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusyId(null);
    }
  };

  const membershipLabel = (fpo: Fpo) =>
    fpo.membership === 'member'
      ? t('fpoMembershipMember')
      : fpo.membership === 'pending'
        ? t('fpoMembershipPending')
        : t('fpoMembershipNone');

  return (
    <ToolShell toolId="fpo">
      <section className="dash-section">
        <h3>{t('fpoDirectoryTitle')}</h3>
        <p className="trade-hint">{t('fpoDirectoryHint')}</p>
        {loading ? <p className="trade-hint">{t('commonLoading')}</p> : null}
        {failed ? <p className="trade-hint">{t('fpoLoadFailed')}</p> : null}
        {!loading && !failed && fpos.length === 0 ? (
          <EmptyState icon="👥" titleKey="fpoEmpty" />
        ) : null}

        {fpos.map((fpo) => (
          <div className="trade-card" key={fpo.id} style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">{fpo.name}</span>
              <span className="trade-card-amount">{membershipLabel(fpo)}</span>
            </div>
            <p className="trade-card-sub">
              {fpo.district} · {t('fpoMemberCount', { count: fpo.memberCount })}
            </p>
            <p className="trade-card-sub">
              {fpo.verification_status === 'verified'
                ? `✅ ${t('fpoVerificationVerified')}`
                : `🕓 ${t('fpoVerificationUnverified')}`}
            </p>

            {fpo.membership === 'none' ? (
              <div className="trade-actions-row">
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  disabled={busyId === fpo.id}
                  onClick={() => void join(fpo)}
                >
                  {busyId === fpo.id ? <span className="av-spinner" aria-hidden /> : t('fpoJoin')}
                </button>
              </div>
            ) : null}

            {fpo.membership === 'pending' ? (
              <div className="trade-actions-row">
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  disabled={busyId === fpo.id}
                  onClick={() => void approve(fpo)}
                >
                  {busyId === fpo.id ? <span className="av-spinner" aria-hidden /> : t('fpoJoinApproveDev')}
                </button>
              </div>
            ) : null}

            {fpo.membership === 'member' ? (
              <p className="trade-card-sub">✅ {t('fpoJoinAlreadyMember')}</p>
            ) : null}
          </div>
        ))}
      </section>
    </ToolShell>
  );
}
