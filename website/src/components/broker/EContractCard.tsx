import { dealMath, inr, type Deal } from '../../lib/api/broker';
import { useT } from '../../lib/i18n';
import MaskedPhoneText from './MaskedPhoneText';

const fmtDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * C5 e-contract summary rendered from the deal doc — parties (phones masked
 * per C1), lot, locked rate/qty, commission %, payment terms, and the
 * acceptance log timestamp (server updatedAt). No signature flow: the server
 * timestamps are the audit trail.
 */
export default function EContractCard({ deal }: { deal: Deal }) {
  const t = useT();
  const math = dealMath(deal.quantityQuintals, deal.agreedRate, deal.brokerCommissionPct);

  return (
    <div className="trade-card broker-contract">
      <p className="trade-section-title" style={{ margin: 0 }}>
        📜 {t('ecTitle')}
      </p>
      <div className="trade-detail-grid">
        <div className="trade-detail-item">
          <p className="trade-detail-label">{t('ecBuyer')}</p>
          <p className="trade-detail-value">{deal.buyerName}</p>
          <MaskedPhoneText phone={deal.buyerPhone} className="trade-card-sub" />
        </div>
        <div className="trade-detail-item">
          <p className="trade-detail-label">{t('ecSeller')}</p>
          <p className="trade-detail-value">{deal.sellerName}</p>
          <MaskedPhoneText phone={deal.sellerPhone} className="trade-card-sub" />
        </div>
        <div className="trade-detail-item">
          <p className="trade-detail-label">{t('ecLot')}</p>
          <p className="trade-detail-value">
            {deal.commodity}
            {deal.variety ? ` · ${deal.variety}` : ''}
            {deal.grade ? ` · ${deal.grade}` : ''}
          </p>
          <p className="trade-card-sub">
            {deal.quantityQuintals} {t('unitQuintalShort')} × {inr(deal.agreedRate)}
          </p>
        </div>
        <div className="trade-detail-item">
          <p className="trade-detail-label">{t('ecCommission')}</p>
          <p className="trade-detail-value">{deal.brokerCommissionPct}%</p>
          <p className="trade-card-sub">{inr(math.commission)}</p>
        </div>
      </div>
      <div className="trade-invoice-box" style={{ marginTop: 0 }}>
        <div className="trade-invoice-row">
          <span>{t('mathGross')}</span>
          <span>{inr(math.gross)}</span>
        </div>
        <div className="trade-invoice-row trade-invoice-total">
          <span>{t('mathPayout')}</span>
          <span>{inr(math.payout)}</span>
        </div>
      </div>
      {deal.paymentTerms ? (
        <p className="trade-card-sub">
          {t('ecPaymentTerms')}: {deal.paymentTerms}
        </p>
      ) : null}
      {deal.deliveryLocation ? (
        <p className="trade-card-sub">
          {t('ecDelivery')}: {deal.deliveryLocation}
        </p>
      ) : null}
      <p className="trade-hint">
        {t('ecAcceptedAt')}: {fmtDateTime(deal.updatedAt)}
      </p>
    </div>
  );
}
