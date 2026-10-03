import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { inr } from '../../lib/api/trade';
import { getBilty, type BiltyDoc } from '../../lib/api/transport';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const MASK = '•• •••• ••••';

/** The bilty doc is synthetic and may embed phone-ish strings — mask them (T15/F17). */
const maskIfPhone = (value: string | undefined): string => {
  if (!value) return '';
  const compact = value.replace(/[\s-]/g, '');
  if (/^(\+?91)?\d{10}$/.test(compact) || /^\d{10}$/.test(value.replace(/\D/g, ''))) return MASK;
  return value;
};

const text = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/**
 * Bilty (lorry receipt) lookup — enter a trip id (or follow a ?trip= deep
 * link from the trip page) to render the LR: consignor/consignee, route,
 * vehicle, goods and freight charges. Name/route/vehicle/fare fields only;
 * anything that looks like a phone number is masked.
 */
export default function BiltyPage() {
  const t = useT();
  useEnsureProfile('transport');
  const [searchParams] = useSearchParams();

  const [tripId, setTripId] = useState(searchParams.get('trip') ?? '');
  const [bilty, setBilty] = useState<BiltyDoc | null>(null);
  const [searched, setSearched] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const lookup = useCallback((id: string) => {
    if (!id.trim()) return;
    setBusy(true);
    setFailed(false);
    getBilty(id.trim())
      .then((doc) => {
        setBilty(doc);
        setSearched(true);
      })
      .catch(() => setFailed(true))
      .finally(() => setBusy(false));
  }, []);

  // Deep link from the trip page (?trip=<id>) loads the receipt immediately.
  useEffect(() => {
    const fromQuery = searchParams.get('trip');
    if (fromQuery) lookup(fromQuery);
  }, [searchParams, lookup]);

  const consignorName = maskIfPhone(text(bilty?.consignor?.name));
  const consigneeName = maskIfPhone(text(bilty?.consignee?.name));

  return (
    <ToolShell toolId="biltyView">
      <LabeledTextField
        label={t('trBilty')}
        value={tripId}
        onChange={setTripId}
        placeholder={t('trTripTitle')}
      />
      <div className="trade-actions">
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => lookup(tripId)}
          disabled={busy || !tripId.trim()}
        >
          {busy ? <span className="av-spinner" aria-hidden /> : t('commonSubmit')}
        </button>
      </div>

      {failed ? (
        <EmptyState
          icon="📡"
          titleKey="tradeLoadFailed"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={() => lookup(tripId)}>
              ↻ {t('retry')}
            </button>
          }
        />
      ) : null}

      {!failed && searched && !bilty ? (
        <EmptyState icon="📄" titleKey="trBilty" />
      ) : null}

      {bilty ? (
        <>
          <div className="trade-card" style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">
                {t('trBilty')}
                {bilty.lrNumber ? ` · ${bilty.lrNumber}` : ''}
              </span>
              <span className="trade-card-sub">{bilty.date ? fmtDate(bilty.date) : ''}</span>
            </div>
            {bilty.bookingId ? (
              <div className="trade-card-row">
                <span className="trade-card-sub">{bilty.bookingId}</span>
              </div>
            ) : null}
          </div>

          <p className="trade-section-title">{t('trPickup')} → {t('trDrop')}</p>
          <div className="trade-detail-grid">
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('trCommodity')}</div>
              <div className="trade-detail-value">
                {text(bilty.goods?.commodity) ?? t('commonNotAvailable')}
              </div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('trWeight')}</div>
              <div className="trade-detail-value">
                {bilty.goods?.weightQuintals != null
                  ? `${bilty.goods.weightQuintals} ${t('unitQuintal')}`
                  : t('commonNotAvailable')}
              </div>
            </div>
            {text(bilty.goods?.packaging) ? (
              <div className="trade-detail-item">
                <div className="trade-detail-label">{t('trPackaging')}</div>
                <div className="trade-detail-value">{text(bilty.goods?.packaging)}</div>
              </div>
            ) : null}
          </div>

          <div className="trade-detail-grid">
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('trPickup')}</div>
              <div className="trade-detail-value">
                {text(bilty.consignor?.origin) ?? t('commonNotAvailable')}
              </div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('trDrop')}</div>
              <div className="trade-detail-value">
                {text(bilty.consignee?.destination) ??
                  text(bilty.consignor?.destination) ??
                  t('commonNotAvailable')}
              </div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('trVehicle')}</div>
              <div className="trade-detail-value">
                {[
                  text(bilty.vehicleDetails?.vehicleType),
                  maskIfPhone(text(bilty.vehicleDetails?.vehicleNo)),
                ]
                  .filter(Boolean)
                  .join(' · ') || t('commonNotAvailable')}
              </div>
            </div>
            {text(bilty.vehicleDetails?.driverName) ? (
              <div className="trade-detail-item">
                <div className="trade-detail-label">{t('trDriver')}</div>
                <div className="trade-detail-value">
                  {maskIfPhone(text(bilty.vehicleDetails?.driverName))}
                </div>
              </div>
            ) : null}
          </div>

          {consignorName || consigneeName ? (
            <div className="trade-detail-grid">
              {consignorName ? (
                <div className="trade-detail-item">
                  <div className="trade-detail-label">{t('trPickup')}</div>
                  <div className="trade-detail-value">{consignorName}</div>
                </div>
              ) : null}
              {consigneeName ? (
                <div className="trade-detail-item">
                  <div className="trade-detail-label">{t('trDrop')}</div>
                  <div className="trade-detail-value">{consigneeName}</div>
                </div>
              ) : null}
            </div>
          ) : null}

          <p className="trade-section-title">{t('trFare')}</p>
          <div className="trade-invoice-box">
            {bilty.freightCharges?.grossFare != null ? (
              <div className="trade-invoice-row">
                <span>{t('trGrossFare')}</span>
                <span>{inr(bilty.freightCharges.grossFare)}</span>
              </div>
            ) : null}
            {bilty.freightCharges?.loadingLabor != null ? (
              <div className="trade-invoice-row">
                <span>{t('trLoadingLabor')}</span>
                <span>{inr(bilty.freightCharges.loadingLabor)}</span>
              </div>
            ) : null}
            {bilty.freightCharges?.advancePaid != null ? (
              <div className="trade-invoice-row">
                <span>{t('trFreightAdvance')}</span>
                <span>{inr(bilty.freightCharges.advancePaid)}</span>
              </div>
            ) : null}
            {bilty.freightCharges?.balancePayable != null ? (
              <div className="trade-invoice-total trade-invoice-row">
                <span>{t('trFreightBalance')}</span>
                <span>{inr(bilty.freightCharges.balancePayable)}</span>
              </div>
            ) : null}
          </div>

          {bilty.qrVerificationCode ? (
            <div className="trade-card" style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">{t('trQrVerify')}</span>
                <span className="trade-card-amount">{bilty.qrVerificationCode}</span>
              </div>
            </div>
          ) : null}

          {bilty.terms ? <p className="trade-hint">{bilty.terms}</p> : null}
        </>
      ) : null}
    </ToolShell>
  );
}
