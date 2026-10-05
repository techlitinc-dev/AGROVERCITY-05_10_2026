import { useCallback, useEffect, useMemo, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { fmtINR, listGaushalaReceipts, receiptPdfUrl, type GaushalaReceipt } from '../../lib/api/gaushala';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.gaushala';
import '../../lib/i18n/locales/hi.gaushala';
import '../../theme/gaushala.css';

const KIND_FILTERS = [
  { value: 'all', labelKey: 'commonAll' },
  { value: 'adoption', labelKey: 'gaushalaReceipt_adoption' },
  { value: 'donation', labelKey: 'gaushalaReceipt_donation' },
] as const;

const KIND_COLORS: Record<string, string> = {
  adoption: '#0D9488',
  donation: '#16A34A',
};

const fmtDate = (value: string): string =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** 80G receipts ledger (P8) — kind filter, certificate cards. */
export default function ReceiptsPage() {
  const t = useT();
  useEnsureProfile('dairyManager');

  const [receipts, setReceipts] = useState<GaushalaReceipt[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [kind, setKind] = useState<'all' | 'adoption' | 'donation'>('all');

  const load = useCallback(() => {
    setFailed(false);
    listGaushalaReceipts({ pageSize: 500 })
      .then((res) => setReceipts(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const visible = useMemo(
    () => (receipts ?? []).filter((r) => kind === 'all' || r.kind === kind),
    [receipts, kind]
  );

  return (
    <ToolShell toolId="gaushalaConsole" backTo="/gaushala/console">
      <div className="gaushala-wrap">
        <div className="gaushala-chip-row" style={{ marginTop: 4 }}>
          {KIND_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`av-chip${kind === f.value ? ' selected' : ''}`}
              onClick={() => setKind(f.value)}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>

        {receipts === null && !failed ? <p className="gaushala-hint">{t('commonLoading')}</p> : null}

        {failed ? (
          <div className="gaushala-empty">
            <span className="gaushala-empty-icon" aria-hidden>
              📡
            </span>
            <p className="gaushala-empty-title">{t('gaushalaLoadFailed')}</p>
            <div className="gaushala-empty-action">
              <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                ↻ {t('retry')}
              </button>
            </div>
          </div>
        ) : null}

        {receipts !== null && visible.length === 0 ? (
          <div className="gaushala-empty">
            <span className="gaushala-empty-icon" aria-hidden>
              🧾
            </span>
            <p className="gaushala-empty-title">{t('gaushalaReceiptsEmpty')}</p>
            <p className="gaushala-empty-body">{t('gaushalaReceiptsEmptyBody')}</p>
          </div>
        ) : null}

        <div className="gaushala-list">
          {visible.map((r) => {
            const color = KIND_COLORS[r.kind] ?? '#64748B';
            const kindLabel =
              t(`gaushalaReceipt_${r.kind}`) !== `gaushalaReceipt_${r.kind}` ? t(`gaushalaReceipt_${r.kind}`) : r.kind;
            return (
              <div key={r.id} className="gaushala-card">
                <div className="gaushala-card-row">
                  <span
                    className="gaushala-pill"
                    style={{ background: `${color}1A`, color, borderColor: `${color}55` }}
                  >
                    {kindLabel}
                  </span>
                  <span className="gaushala-card-amount">{fmtINR(r.amount)}</span>
                </div>
                <div className="gaushala-card-row">
                  <span className="gaushala-card-title">{r.personName}</span>
                  {r.eightyGEligible ? (
                    <span className="gaushala-pill gaushala-pill-warn">✓ {t('gaushalaReceipt80g')}</span>
                  ) : null}
                </div>
                <span className="gaushala-mono">{r.certificateNumber}</span>
                <span className="gaushala-card-sub">
                  {fmtDate(r.issuedAt)}
                  {r.gaushalaName ? ` · ${r.gaushalaName}` : ''}
                </span>
                {receiptPdfUrl(r) ? (
                  <div className="gaushala-card-row">
                    <a
                      className="av-btn av-btn-ghost"
                      href={receiptPdfUrl(r)}
                      target="_blank"
                      rel="noreferrer"
                      download
                    >
                      ⬇ {t('gaushalaReceiptDownload')}
                    </a>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </ToolShell>
  );
}
