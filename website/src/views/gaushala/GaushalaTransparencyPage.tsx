import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  fmtPaisa,
  getGaushalaTransparency,
  type GaushalaTransparency,
} from '../../lib/api/gaushala';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.gaushala';
import '../../lib/i18n/locales/hi.gaushala';
import '../../theme/gaushala.css';

const fmtDate = (value: string): string => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value.slice(0, 10)
    : parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Public (no-auth) gaushala transparency page — WS-06 §6.12.
 *
 * Renders the `/livestock/gaushala/{id}/transparency` aggregate for a
 * logged-out visitor. The payload carries ZERO PII by construction: donor
 * names are omitted ("anonymous") unless the donor opted in, and no phone or
 * email is ever returned.
 */
export default function GaushalaTransparencyPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<GaushalaTransparency | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!id) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setData(null);
    getGaushalaTransparency(id)
      .then(setData)
      .catch(() => setFailed(true));
  }, [id]);

  const donorLabel = (donor: string): string =>
    !donor || donor === 'anonymous' ? t('gaushalaTransparencyAnonymous') : donor;

  return (
    <div className="gaushala-wrap" style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <header className="gaushala-card" style={{ marginBottom: 12 }}>
        <div className="gaushala-card-row">
          <span className="gaushala-card-title">🛕 {data?.name || t('gaushalaTransparencyTitle')}</span>
        </div>
        {data?.district ? <span className="gaushala-card-sub">{data.district}</span> : null}
        <span className="gaushala-card-sub">{t('gaushalaTransparencyIntro')}</span>
        <span className="gaushala-card-sub">🔒 {t('gaushalaTransparencyPrivacy')}</span>
      </header>

      {!data && !failed ? <p className="gaushala-hint">{t('commonLoading')}</p> : null}

      {failed ? (
        <div className="gaushala-empty">
          <span className="gaushala-empty-icon" aria-hidden>
            📡
          </span>
          <p className="gaushala-empty-title">{t('gaushalaLoadFailed')}</p>
        </div>
      ) : null}

      {data ? (
        <>
          <section className="gaushala-card" style={{ marginBottom: 12 }}>
            <div className="gaushala-card-row">
              <span className="gaushala-card-sub">{t('gaushalaTransparencyDonations')}</span>
              <span className="gaushala-card-amount">{fmtPaisa(data.donations.totalPaisa)}</span>
            </div>
            <div className="gaushala-card-row">
              <span className="gaushala-pill gaushala-pill-warn">
                {t('gaushalaTransparencyCount', { count: data.donations.count })}
              </span>
              <span className="gaushala-pill gaushala-pill-warn">
                ✓ {t('gaushalaTransparency80g', { count: data.donations.eightyGReceiptCount })}
              </span>
            </div>
          </section>

          <section className="gaushala-card" style={{ marginBottom: 12 }}>
            <span className="gaushala-card-title">{t('gaushalaTransparencyLedger')}</span>
            {data.donations.ledger.length === 0 ? (
              <p className="gaushala-hint">{t('gaushalaTransparencyEmpty')}</p>
            ) : (
              <div className="gaushala-list">
                {data.donations.ledger.map((row, index) => (
                  <div key={`${row.date}-${index}`} className="gaushala-card-row">
                    <span className="gaushala-card-sub">{donorLabel(row.donor)}</span>
                    <span>{fmtPaisa(row.amountPaisa)}</span>
                    <span className="gaushala-card-sub">{fmtDate(row.date)}</span>
                    {row.receiptNumber ? (
                      <span className="gaushala-mono">{row.receiptNumber}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="gaushala-card" style={{ marginBottom: 12 }}>
            <span className="gaushala-card-title">{t('gaushalaTransparencyExpenses')}</span>
            {Object.keys(data.expensesByCategory).length === 0 ? (
              <p className="gaushala-hint">{t('gaushalaTransparencyEmpty')}</p>
            ) : (
              <div className="gaushala-list">
                {Object.entries(data.expensesByCategory).map(([category, paisa]) => (
                  <div key={category} className="gaushala-card-row">
                    <span className="gaushala-card-sub">
                      {t(`gaushalaExp_${category}`) !== `gaushalaExp_${category}`
                        ? t(`gaushalaExp_${category}`)
                        : category}
                    </span>
                    <span>{fmtPaisa(paisa)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="gaushala-card">
            <span className="gaushala-card-title">{t('gaushalaTransparencyCattle')}</span>
            <div className="gaushala-list">
              {Object.entries(data.cattleByStatus).map(([status, count]) => (
                <div key={status} className="gaushala-card-row">
                  <span className="gaushala-card-sub">
                    {t(`gaushala_status_${status.replace(/-/g, '_')}`) !==
                    `gaushala_status_${status.replace(/-/g, '_')}`
                      ? t(`gaushala_status_${status.replace(/-/g, '_')}`)
                      : status}
                  </span>
                  <span>{count}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
