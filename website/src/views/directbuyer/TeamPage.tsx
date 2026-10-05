import { useCallback, useEffect, useState } from 'react';
import LabeledTextField from '../../components/LabeledTextField';
import MaskedPhoneText from '../../components/broker/MaskedPhoneText';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  getOrg,
  inviteMember,
  removeMember,
  type BuyerOrg,
  type BuyerOrgRole,
} from '../../lib/api/buyerOrg';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const ROLES: BuyerOrgRole[] = ['admin', 'procurement', 'qa', 'finance'];

const ROLE_LABEL_KEYS: Record<BuyerOrgRole, string> = {
  admin: 'teamRoleAdmin',
  procurement: 'teamRoleProcurement',
  qa: 'teamRoleQa',
  finance: 'teamRoleFinance',
};

/**
 * TeamPage (P12) — the Enterprise-tier buyer org roster: invite registered
 * users by phone (role select) and remove members. Not a paywall page: the
 * server enforces the tier; this screen renders the org the caller can see.
 */
export default function TeamPage() {
  const t = useT();
  useEnsureProfile('directBuyer');

  const [org, setOrg] = useState<BuyerOrg | null>(null);
  const [failed, setFailed] = useState(false);
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<BuyerOrgRole>('procurement');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    setOrg(null);
    getOrg()
      .then(setOrg)
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const submitInvite = async () => {
    if (busy) return;
    const trimmed = phone.trim();
    if (!trimmed) {
      setError(t('commonRequired'));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await inviteMember({ phone: trimmed, role });
      setOrg(res.org);
      setPhone('');
      toast(t('teamInvited'));
    } catch (e) {
      if (isApiError(e)) {
        if (e.code === 'USER_NOT_FOUND') {
          toast(t('teamInviteNotFound'), { error: true });
        } else if (e.code === 'ENTITLEMENT_EXCEEDED') {
          toast(t('teamInviteEntitlement'), { error: true });
        } else {
          toast(e.message || t('actionFailed'), { error: true });
        }
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (uid: string) => {
    setBusy(true);
    try {
      const res = await removeMember(uid);
      setOrg((prev) => (prev ? { ...prev, members: res.members } : prev));
      toast(t('teamRemoved'));
    } catch (e) {
      if (isApiError(e) && e.code === 'CANNOT_REMOVE_ADMIN') {
        toast(t('teamCannotRemoveAdmin'), { error: true });
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="contracts" backTo="/dashboard/p/contracts">
      <p className="trade-section-title" style={{ marginTop: 4 }}>
        {t('teamTitle')}
      </p>
      <p className="trade-hint">{t('teamSubtitle')}</p>

      {org === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

      {failed ? (
        <EmptyState
          icon="📡"
          titleKey="tradeLoadFailed"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={load}>
              ↻ {t('retry')}
            </button>
          }
        />
      ) : null}

      {org ? (
        <>
          {org.companyName ? (
            <p className="trade-hint">
              {t('teamCompany')}: {org.companyName}
            </p>
          ) : null}

          <p className="trade-section-title">{t('teamMembers')}</p>
          <div className="trade-list" style={{ marginTop: 0 }}>
            {org.members.map((m) => (
              <div key={m.uid} className="trade-card" style={{ cursor: 'default' }}>
                <div className="trade-card-row">
                  <span className="trade-card-title">{m.name || m.uid}</span>
                  <span className="trade-pill">{t(ROLE_LABEL_KEYS[m.role] ?? m.role)}</span>
                </div>
                <div className="trade-card-row">
                  <span className="trade-card-sub">
                    <MaskedPhoneText phone={m.phone} />
                  </span>
                  {m.uid !== org.adminUid ? (
                    <button
                      type="button"
                      className="av-btn av-btn-plain"
                      style={{ background: 'var(--av-error)' }}
                      disabled={busy}
                      onClick={() => void remove(m.uid)}
                    >
                      {t('teamRemove')}
                    </button>
                  ) : (
                    <span className="trade-card-sub">{t('teamAdminBadge')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="trade-section-title">{t('teamInvite')}</p>
          <LabeledTextField
            label={t('teamPhone')}
            value={phone}
            onChange={setPhone}
            placeholder={t('teamPhonePlaceholder')}
            inputMode="tel"
            required
            error={error ?? undefined}
          />
          <div className="av-field">
            <span className="av-label">{t('teamRole')}</span>
            <select
              className="av-input"
              value={role}
              onChange={(e) => setRole(e.target.value as BuyerOrgRole)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(ROLE_LABEL_KEYS[r])}
                </option>
              ))}
            </select>
          </div>
          <div className="trade-actions">
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => void submitInvite()}
              disabled={busy}
            >
              {busy ? <span className="av-spinner" aria-hidden /> : t('teamInviteSubmit')}
            </button>
          </div>
        </>
      ) : null}
    </ToolShell>
  );
}
