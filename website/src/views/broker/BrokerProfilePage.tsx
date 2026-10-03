import { useCallback, useEffect, useState } from 'react';
import MultiChipWithCustom from '../../components/MultiChipWithCustom';
import LabeledTextField from '../../components/LabeledTextField';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { mandiList } from '../../lib/api/mandi';
import { savePersonaSetup } from '../../lib/api/users';
import { useT } from '../../lib/i18n';
import { useSessionStore } from '../../stores/session';
import '../../theme/trade.css';
import '../../theme/broker.css';

interface BrokerPrefs {
  pct: number;
  paymentTerms: string;
}

const prefsKey = (uid: string) => `agvc-broker-prefs-${uid}`;

function loadPrefs(uid: string): BrokerPrefs {
  try {
    const raw = localStorage.getItem(prefsKey(uid));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BrokerPrefs>;
      return { pct: parsed.pct ?? 2, paymentTerms: parsed.paymentTerms ?? '' };
    }
  } catch {
    // fall through
  }
  return { pct: 2, paymentTerms: '' };
}

/**
 * Broker service profile — marketsServed persists to the backend broker role
 * profile via PUT /users/me/persona-setup (the only role-profile write that
 * exists backend-side; BrokerRoleProfile has just marketsServed). The
 * commission rate card and default payment terms have no backend fields yet
 * (plan §11), so they live in per-uid localStorage and pre-fill the deal form.
 */
export default function BrokerProfilePage() {
  const t = useT();
  useEnsureProfile('broker');

  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);
  const uid = user?.id ?? user?.uid ?? 'anon';

  const [markets, setMarkets] = useState<string[]>([]);
  const [mandiOptions, setMandiOptions] = useState<string[]>([]);
  const [pct, setPct] = useState(2);
  const [paymentTerms, setPaymentTerms] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const roleProfile = (user?.roleProfiles as Record<string, { marketsServed?: string[] }> | undefined)
      ?.broker;
    const prefs = loadPrefs(uid);
    setMarkets(roleProfile?.marketsServed ?? []);
    setPct(prefs.pct);
    setPaymentTerms(prefs.paymentTerms);
    setLoaded(true);
    mandiList()
      .then((res) => setMandiOptions(res.data.map((m) => m.name)))
      .catch(() => setMandiOptions([]));
  }, [user, uid]);

  const toggleMarket = (option: string) => {
    setMarkets((prev) =>
      prev.includes(option) ? prev.filter((m) => m !== option) : [...prev, option]
    );
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const profiles = user?.linkedProfiles?.length ? user.linkedProfiles : ['broker'];
      const primary = user?.primaryProfile ?? profiles[0];
      const updated = await savePersonaSetup({
        profiles,
        primaryProfile: primary,
        roleProfiles: { broker: { marketsServed: markets } },
      });
      setUser(updated);
      try {
        localStorage.setItem(prefsKey(uid), JSON.stringify({ pct, paymentTerms }));
      } catch {
        // storage full — non-fatal
      }
      toast(t('bpSaved'));
    } catch (e) {
      if (isApiError(e) && e.fieldErrors) {
        toast(t('bpInvalid'), { error: true });
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="brokerProfile">
      {!loaded ? <p className="trade-hint">{t('commonLoading')}</p> : null}
      {loaded ? (
        <>
          <p className="trade-hint" style={{ marginTop: 4 }}>
            {t('bpIntro')}
          </p>

          <div className="av-field" style={{ marginTop: 12 }}>
            <span className="av-label">{t('bpMarkets')}</span>
            <MultiChipWithCustom
              options={mandiOptions}
              selected={markets}
              onToggle={toggleMarket}
              addLabel={t('bpAddCustom')}
              placeholder={t('bpMarketsPlaceholder')}
            />
          </div>

          <LabeledTextField
            label={t('bpCommissionDefault')}
            value={String(pct)}
            onChange={(v) => setPct(Math.min(10, Math.max(0, Number(v) || 0)))}
            type="number"
            inputMode="decimal"
            prefix="%"
          />
          <LabeledTextField
            label={t('bpPaymentTermsDefault')}
            value={paymentTerms}
            onChange={setPaymentTerms}
            placeholder="100% Bank Transfer on Delivery"
          />
          <p className="trade-hint">{t('bpLocalNote')}</p>

          <div className="trade-actions">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void save()} disabled={busy}>
              {busy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
            </button>
          </div>
        </>
      ) : null}
    </ToolShell>
  );
}
