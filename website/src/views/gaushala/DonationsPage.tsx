import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  createDonation,
  fmtINR,
  getMyGaushala,
  listGaushalaDonations,
  receiptPdfUrl,
  updateDonationStatus,
  type DonationType,
  type FodderDonation,
  type GaushalaReceipt,
} from '../../lib/api/gaushala';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.gaushala';
import '../../lib/i18n/locales/hi.gaushala';
import '../../theme/gaushala.css';

const DONATION_TYPES: DonationType[] = ['green_fodder', 'dry_fodder', 'mineral_mixture', 'cash_seva'];

const TYPE_COLORS: Record<string, string> = {
  green_fodder: '#16A34A',
  dry_fodder: '#D97706',
  mineral_mixture: '#7C3AED',
  cash_seva: '#0D9488',
};

const STATUS_COLORS: Record<string, string> = {
  received: '#D97706',
  acknowledged: '#16A34A',
  rejected: '#DC2626',
};

const fmtDate = (value: string): string =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Donations queue (P8) — fodder/cash seva list, record offline donation, acknowledge/reject with 80G receipt. */
export default function DonationsPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('dairyManager');

  const [gaushalaId, setGaushalaId] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [donations, setDonations] = useState<FodderDonation[] | null>(null);
  const [failed, setFailed] = useState(false);

  const [recordOpen, setRecordOpen] = useState(false);
  const [receipt, setReceipt] = useState<GaushalaReceipt | null>(null);
  const [busy, setBusy] = useState(false);

  const [donorName, setDonorName] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [donationType, setDonationType] = useState<DonationType>('green_fodder');
  const [qtyDesc, setQtyDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setFailed(false);
    getMyGaushala()
      .then((p) => {
        setGaushalaId(p.id);
        return listGaushalaDonations(p.id);
      })
      .then((rows) => setDonations(rows))
      .catch((e) => {
        if (isApiError(e) && e.status === 404) setNeedsSetup(true);
        else setFailed(true);
      });
  }, []);

  useEffect(load, [load]);

  const openRecord = () => {
    setDonorName('');
    setDonorPhone('');
    setDonationType('green_fodder');
    setQtyDesc('');
    setAmount('');
    setErrors({});
    setRecordOpen(true);
  };

  const submitRecord = async () => {
    if (busy || !gaushalaId) return;
    const nextErrors: Record<string, string> = {};
    if (!donorName.trim()) nextErrors.donorName = t('commonRequired');
    if (amount.trim() === '' || Number.isNaN(Number(amount))) nextErrors.amountInr = t('commonRequired');
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await createDonation({
        gaushalaId,
        donorName: donorName.trim(),
        donorPhone: donorPhone.trim(),
        donationType,
        quantityDescription: qtyDesc.trim(),
        amountInr: Math.floor(Number(amount)) || 0,
      });
      toast(t('gaushalaDonCreated'));
      setRecordOpen(false);
      load();
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors);
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const act = async (donation: FodderDonation, next: 'acknowledged' | 'rejected') => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await updateDonationStatus(donation.id, next);
      toast(t(next === 'acknowledged' ? 'gaushalaDonAcked' : 'gaushalaDonRejected'));
      if (next === 'acknowledged' && res.receipt) setReceipt(res.receipt);
      load();
    } catch (e) {
      if (isApiError(e) && e.status === 404) {
        toast(t('actionFailed'), { error: true });
        load();
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const setupPrompt = (
    <div className="gaushala-empty">
      <span className="gaushala-empty-icon" aria-hidden>
        🛕
      </span>
      <p className="gaushala-empty-title">{t('gaushalaCattleSetupFirst')}</p>
      <p className="gaushala-empty-body">{t('gaushalaCattleSetupBody')}</p>
      <div className="gaushala-empty-action">
        <button type="button" className="av-btn av-btn-primary" onClick={() => navigate('/gaushala/console')}>
          {t('gaushalaCattleSetupCta')}
        </button>
      </div>
    </div>
  );

  return (
    <ToolShell toolId="gaushalaConsole" backTo="/gaushala/console">
      <div className="gaushala-wrap">
        {needsSetup ? (
          setupPrompt
        ) : (
          <>
            <div className="gaushala-actions" style={{ marginTop: 4 }}>
              <button type="button" className="av-btn av-btn-primary" onClick={openRecord}>
                ＋ {t('gaushalaDonRecord')}
              </button>
            </div>

            {donations === null && !failed ? <p className="gaushala-hint">{t('commonLoading')}</p> : null}

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

            {donations !== null && donations.length === 0 ? (
              <div className="gaushala-empty">
                <span className="gaushala-empty-icon" aria-hidden>
                  🌾
                </span>
                <p className="gaushala-empty-title">{t('gaushalaDonEmpty')}</p>
                <p className="gaushala-empty-body">{t('gaushalaDonEmptyBody')}</p>
              </div>
            ) : null}

            <div className="gaushala-list">
              {(donations ?? []).map((d) => {
                const typeColor = TYPE_COLORS[d.donationType] ?? '#64748B';
                const status = d.status ?? 'received';
                const statusColor = STATUS_COLORS[status] ?? '#64748B';
                const typeLabel =
                  t(`gaushalaDonType_${d.donationType}`) !== `gaushalaDonType_${d.donationType}`
                    ? t(`gaushalaDonType_${d.donationType}`)
                    : d.donationType;
                return (
                  <div key={d.id} className="gaushala-card">
                    <div className="gaushala-card-row">
                      <span className="gaushala-card-title">{d.donorName}</span>
                      <span className="gaushala-card-amount">{fmtINR(d.amountInr)}</span>
                    </div>
                    <div className="gaushala-card-row">
                      <span
                        className="gaushala-pill"
                        style={{ background: `${typeColor}1A`, color: typeColor, borderColor: `${typeColor}55` }}
                      >
                        {typeLabel}
                      </span>
                      <span
                        className="gaushala-pill"
                        style={{ background: `${statusColor}1A`, color: statusColor, borderColor: `${statusColor}55` }}
                      >
                        {t(`gaushala_status_${status}`) !== `gaushala_status_${status}`
                          ? t(`gaushala_status_${status}`)
                          : status}
                      </span>
                    </div>
                    {d.quantityDescription ? <span className="gaushala-card-sub">{d.quantityDescription}</span> : null}
                    <span className="gaushala-card-sub">
                      {fmtDate(d.createdAt)}
                      {d.receiptNumber ? ` · ${d.receiptNumber}` : ''}
                      {d.donorPhone ? ` · ${d.donorPhone}` : ''}
                    </span>
                    {!d.status ? (
                      <div className="gaushala-actions-row">
                        <button
                          type="button"
                          className="av-btn av-btn-primary"
                          onClick={() => void act(d, 'acknowledged')}
                          disabled={busy}
                        >
                          ✔ {t('gaushalaDonAcknowledge')}
                        </button>
                        <button
                          type="button"
                          className="av-btn av-btn-plain"
                          style={{ background: 'var(--av-error)' }}
                          onClick={() => void act(d, 'rejected')}
                          disabled={busy}
                        >
                          ✕ {t('gaushalaAdoptReject')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <ModalSheet open={recordOpen} onClose={() => !busy && setRecordOpen(false)} title={t('gaushalaDonRecord')}>
        <div className="gaushala-form">
          <LabeledTextField
            label={t('gaushalaFieldDonorName')}
            value={donorName}
            onChange={setDonorName}
            error={errors.donorName}
            required
          />
          <LabeledTextField
            label={t('gaushalaFieldDonorPhone')}
            value={donorPhone}
            onChange={setDonorPhone}
            type="tel"
            inputMode="tel"
            error={errors.donorPhone}
          />
          <div className="av-field">
            <label className="av-label">{t('gaushalaFieldDonationType')}</label>
            <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
              {DONATION_TYPES.map((dt) => (
                <button
                  key={dt}
                  type="button"
                  className={`av-chip${donationType === dt ? ' selected' : ''}`}
                  onClick={() => setDonationType(dt)}
                >
                  {t(`gaushalaDonType_${dt}`)}
                </button>
              ))}
            </div>
          </div>
          <LabeledTextField
            label={t('gaushalaFieldQtyDesc')}
            value={qtyDesc}
            onChange={setQtyDesc}
            error={errors.quantityDescription}
          />
          <LabeledTextField
            label={t('gaushalaFieldAmount')}
            value={amount}
            onChange={setAmount}
            type="number"
            inputMode="numeric"
            error={errors.amountInr}
            required
          />
          <div className="gaushala-actions">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void submitRecord()} disabled={busy}>
              {busy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
            </button>
            <button type="button" className="av-btn av-btn-ghost" onClick={() => setRecordOpen(false)} disabled={busy}>
              {t('commonCancel')}
            </button>
          </div>
        </div>
      </ModalSheet>

      <ModalSheet open={receipt !== null} onClose={() => setReceipt(null)} title={t('gaushalaReceiptTitle')}>
        {receipt ? (
          <div className="gaushala-receipt">
            <span className="gaushala-receipt-badge">{t('gaushalaReceipt80g')}</span>
            <div>
              <div className="gaushala-detail-cell-label">{t('gaushalaReceiptCert')}</div>
              <div className="gaushala-receipt-cert">{receipt.certificateNumber}</div>
            </div>
            <div className="gaushala-receipt-row">
              <span>{t('gaushalaReceiptPerson')}</span>
              <span>{receipt.personName}</span>
            </div>
            <div className="gaushala-receipt-row">
              <span>{t('gaushalaReceiptAmount')}</span>
              <span>{fmtINR(receipt.amount)}</span>
            </div>
            <div className="gaushala-receipt-row">
              <span>{t('gaushalaReceiptIssued')}</span>
              <span>{fmtDate(receipt.issuedAt)}</span>
            </div>
            <div className="gaushala-actions">
              {receiptPdfUrl(receipt) ? (
                <a
                  className="av-btn av-btn-ghost"
                  href={receiptPdfUrl(receipt)}
                  target="_blank"
                  rel="noreferrer"
                  download
                >
                  ⬇ {t('gaushalaReceiptDownload')}
                </a>
              ) : null}
              <button type="button" className="av-btn av-btn-primary" onClick={() => setReceipt(null)}>
                {t('gaushalaReceiptClose')}
              </button>
            </div>
          </div>
        ) : null}
      </ModalSheet>
    </ToolShell>
  );
}
