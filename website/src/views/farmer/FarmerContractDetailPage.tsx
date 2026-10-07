import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import {
  contractFrequencyLabel,
  contractScheduleSummary,
  listContractDeliveries,
  listContractsMine,
  type Contract,
  type ContractDeliveriesResponse,
} from '../../lib/api/intelligence';
import { fetchMsp, type MspEntry } from '../../lib/api/reference';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';
import '../../theme/contracts.css';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** contracts.attractiveness.v1 annotation (WS-07 M18) — optional on the doc. */
interface ContractAttractiveness {
  incomeVsMandi?: number;
  riskFlags?: string[];
  explanation?: string;
  decisionId?: string;
}

/**
 * Farmer read-only contract detail — offer terms + the supply/delivery rows
 * generated so far. Resolves from /contracts/mine?role=farmer (no GET-single
 * endpoint); purchase state machine lives on the purchase pages.
 */
export default function FarmerContractDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const { contractId } = useParams();
  useEnsureProfile('farmer');

  const [contract, setContract] = useState<Contract | null>(null);
  const [deliveries, setDeliveries] = useState<ContractDeliveriesResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  // MSP reference (WS-01 task 1.26) — null until loaded / on failure; a missing
  // crop shows the "unavailable" label rather than an invented number.
  const [msp, setMsp] = useState<MspEntry[] | null>(null);

  useEffect(() => {
    fetchMsp()
      .then(setMsp)
      .catch(() => setMsp(null));
  }, []);

  useEffect(() => {
    listContractsMine('farmer')
      .then((res) => {
        const found = res.data.find((c: Contract) => c.id === contractId);
        if (!found) {
          setNotFound(true);
          return;
        }
        setContract(found);
      })
      .catch(() => setNotFound(true));
    listContractDeliveries(contractId ?? '')
      .then(setDeliveries)
      .catch(() => setDeliveries({ data: [], fulfilment: { total: 0, completed: 0, cancelled: 0, pending: 0 } }));
  }, [contractId]);

  if (notFound) {
    return (
      <ToolShell toolId="myContracts" backTo="/dashboard/p/myContracts">
        <EmptyState
          icon="📜"
          titleKey="ctNotFound"
          action={
            <button
              type="button"
              className="av-btn av-btn-ghost"
              onClick={() => navigate('/dashboard/p/myContracts')}
            >
              ← {t('tool_myContracts')}
            </button>
          }
        />
      </ToolShell>
    );
  }

  if (!contract) {
    return (
      <ToolShell toolId="myContracts" backTo="/dashboard/p/myContracts">
        <p className="trade-hint">{t('commonLoading')}</p>
      </ToolShell>
    );
  }

  const fulfilment = deliveries?.fulfilment;
  const attractiveness = (contract as Contract & { attractiveness?: ContractAttractiveness })
    .attractiveness;
  const mspEntry = msp?.find((m) => m.crop?.toLowerCase() === contract.crop?.toLowerCase());

  return (
    <ToolShell toolId="myContracts" backTo="/dashboard/p/myContracts">
      <div className="trade-card" style={{ cursor: 'default' }}>
        <div className="trade-card-row">
          <span className="trade-card-title">
            {contract.crop}
            {contract.quantityTotal ? ` · ${t('ctQtyTotal', { qty: contract.quantityTotal })}` : ''}
          </span>
          <StatusPill status={contract.status} />
        </div>
        <div className="trade-card-row">
          <span className="trade-card-sub">
            {t('ctBuyer')}: {contract.buyerCompany ?? contract.buyerId ?? t('commonNotAvailable')}
          </span>
          {contract.currentPrice != null ? (
            <span className="ct-current-price">
              {inr(contract.currentPrice)}
              <small>{t('perQuintal')}</small>
            </span>
          ) : null}
          {msp ? (
            <span className="ct-formula-chip">
              {t('contractMspLabel')}:{' '}
              {mspEntry ? inr(mspEntry.msp_paisa) : t('contractMspUnavailable')}
            </span>
          ) : null}
        </div>
      </div>

      <p className="trade-section-title">{t('ctFormulaTitle')}</p>
      <div className="trade-detail-grid" style={{ marginTop: 0 }}>
        <div className="trade-detail-item">
          <p className="trade-detail-label">{t('ctBaseRateLabel')}</p>
          <p className="trade-detail-value">
            {contract.priceType === 'fixed' && contract.baseRate !== undefined
              ? `${inr(contract.baseRate)}${t('perQuintal')}`
              : t('commonNotAvailable')}
          </p>
        </div>
        <div className="trade-detail-item">
          <p className="trade-detail-label">{t('ctPremiumLabel')}</p>
          <p className="trade-detail-value">
            {contract.priceType === 'mandiLinked' && contract.premiumPerQuintal !== undefined
              ? `${inr(contract.premiumPerQuintal)}${t('perQuintal')}`
              : t('commonNotAvailable')}
          </p>
        </div>
        <div className="trade-detail-item">
          <p className="trade-detail-label">{t('ctMandiLabel')}</p>
          <p className="trade-detail-value">{contract.mandiName ?? t('commonNotAvailable')}</p>
        </div>
        <div className="trade-detail-item">
          <p className="trade-detail-label">{t('ctPaymentLabel')}</p>
          <p className="trade-detail-value">
            {contract.paymentTermsDays !== undefined
              ? t('ctNetDays', { days: contract.paymentTermsDays })
              : t('commonNotAvailable')}
          </p>
        </div>
        <div className="trade-detail-item">
          <p className="trade-detail-label">{t('ctQtyPerDeliveryLabel')}</p>
          <p className="trade-detail-value">
            {contract.schedule
              ? `${contract.schedule.qtyPerDelivery} ${t('unitQuintal')}`
              : t('commonNotAvailable')}
          </p>
        </div>
        <div className="trade-detail-item">
          <p className="trade-detail-label">{t('ctScheduleLabel')}</p>
          <p className="trade-detail-value">
            {contract.schedule
              ? `${contractFrequencyLabel(t, contract.schedule.frequency)} · ${fmtDate(contract.schedule.startDate)} → ${fmtDate(contract.schedule.endDate)}`
              : t('commonNotAvailable')}
          </p>
        </div>
        {contract.deliveryLocation ? (
          <div className="trade-detail-item">
            <p className="trade-detail-label">{t('ctLocationLabel')}</p>
            <p className="trade-detail-value">{contract.deliveryLocation}</p>
          </div>
        ) : null}
      </div>
      {contract.schedule ? (
        <p className="trade-hint">{contractScheduleSummary(t, contract.schedule)}</p>
      ) : null}
      {contract.termsText ? <p className="trade-hint">{contract.termsText}</p> : null}

      {/* ---- Grow-for-us decision card: income vs mandi + agronomy risk notes.
          Rendered from contracts.attractiveness.v1 when present (AI flag on);
          the static fallback renders when the flag is off. ---- */}
      <p className="trade-section-title">{t('ctAttractTitle')}</p>
      {attractiveness && typeof attractiveness.incomeVsMandi === 'number' ? (
        <div className="trade-detail-grid" style={{ marginTop: 0 }}>
          <div className="trade-detail-item" style={{ gridColumn: '1 / -1' }}>
            <p className="trade-detail-value" style={{ fontWeight: 700 }}>
              {attractiveness.incomeVsMandi >= 0
                ? t('ctAttractVsMandiBetter', { pct: Math.round(attractiveness.incomeVsMandi) })
                : t('ctAttractVsMandiWorse', { pct: Math.round(Math.abs(attractiveness.incomeVsMandi)) })}
            </p>
          </div>
        </div>
      ) : (
        <p className="trade-hint">{t('ctAttractFallback')}</p>
      )}
      {attractiveness?.explanation ? (
        <details className="ct-past" style={{ marginTop: 8 }}>
          <summary>{t('ctAttractExplain')}</summary>
          <p className="trade-hint" style={{ marginTop: 8 }}>
            {attractiveness.explanation}
          </p>
        </details>
      ) : null}

      <p className="trade-section-title">{t('ctAgronomyTitle')}</p>
      {attractiveness?.riskFlags && attractiveness.riskFlags.length > 0 ? (
        <ul className="trade-hint" style={{ marginTop: 0, paddingLeft: 18 }}>
          {attractiveness.riskFlags.map((flag, idx) => (
            <li key={idx}>{flag}</li>
          ))}
        </ul>
      ) : (
        <p className="trade-hint">{t('ctAgronomyRiskFallback')}</p>
      )}

      <p className="trade-section-title">{t('ctDeliveriesTitle')}</p>
      {fulfilment ? (
        <p className="trade-hint">
          {t('ctFulfilment', {
            completed: fulfilment.completed,
            total: fulfilment.total,
            pending: fulfilment.pending,
          })}
        </p>
      ) : null}

      {deliveries && deliveries.data.length === 0 ? (
        <EmptyState icon="🚚" titleKey="ctDeliveriesEmpty" bodyKey="ctDeliveriesEmptyBody" />
      ) : null}

      <div className="trade-list">
        {(deliveries?.data ?? []).map((row) => (
          <div
            key={`${row.slotDate}-${row.purchaseId}`}
            className="trade-card"
            style={{ cursor: 'default' }}
          >
            <div className="trade-card-row">
              <span className="trade-card-title">{fmtDate(row.slotDate)}</span>
              <StatusPill status={row.status} />
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {row.finalAmount !== undefined ? inr(row.finalAmount) : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ToolShell>
  );
}
