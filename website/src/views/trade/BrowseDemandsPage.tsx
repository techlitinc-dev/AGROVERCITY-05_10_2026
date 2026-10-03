import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import EmptyState from '../../components/trade/EmptyState';
import QuantityStepper from '../../components/trade/QuantityStepper';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { listDemands, type Demand } from '../../lib/api/demands';
import { createOffer } from '../../lib/api/offers';
import { openDirectChat } from '../../lib/api/chat';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Browse open demands (farmer view, spec F8) — every buyer "wanted order"
 * with a crop filter; farmers answer a demand with a structured supply offer
 * (the only pre-booking channel, spec G1).
 */

const GONE_CODES = new Set(['DEMAND_NOT_FOUND', 'DEMAND_CLOSED']);

const fmtDate = (value: string): string =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function BrowseDemandsPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('farmer');

  const [demands, setDemands] = useState<Demand[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [cropInput, setCropInput] = useState('');
  const [cropFilter, setCropFilter] = useState('');

  const [offering, setOffering] = useState<Demand | null>(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [chattingId, setChattingId] = useState<string | null>(null);
  const [offerQty, setOfferQty] = useState(0);
  const [offerMsg, setOfferMsg] = useState('');
  const [offerErrors, setOfferErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    listDemands({ status: 'open', crop: cropFilter || undefined })
      .then((res) => setDemands(res.data))
      .catch(() => setFailed(true));
  }, [cropFilter]);

  useEffect(load, [load]);

  const unitOf = (d: Demand): string => (d.unit === 'kg' ? t('unitKg') : t('unitQuintal'));

  const openOfferSheet = (demand: Demand) => {
    setOffering(demand);
    setOfferPrice('');
    setOfferQty(demand.quantity);
    setOfferMsg('');
    setOfferErrors({});
  };

  const startChat = async (demandId: string) => {
    setChattingId(demandId);
    try {
      const room = await openDirectChat({ demandId });
      navigate(`/dashboard/p/chats/${room.id}`);
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setChattingId(null);
    }
  };

  const submitOffer = async () => {
    if (!offering || busy) return;
    const price = Number(offerPrice);
    const next: Record<string, string> = {};
    if (!(price > 0)) next.pricePerUnit = t('commonRequired');
    if (!(offerQty > 0)) next.quantity = t('commonRequired');
    setOfferErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    try {
      const offer = await createOffer({
        targetType: 'demand',
        targetId: offering.id,
        pricePerUnit: Math.round(price),
        quantity: offerQty,
        message: offerMsg.trim() || undefined,
      });
      setOffering(null);
      toast(t('offerSentToast'));
      navigate(`/dashboard/p/myOffers/${offer.id}/chat`);
    } catch (e) {
      if (isApiError(e) && e.fieldErrors) {
        setOfferErrors(e.fieldErrors);
      } else if (isApiError(e) && GONE_CODES.has(e.code)) {
        setOffering(null);
        toast(t('offerTargetGone'), { error: true });
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="buyDemands">
      <div className="trade-filter-row">
        <input
          className="av-input"
          style={{ minWidth: 180, alignSelf: 'center' }}
          value={cropInput}
          onChange={(e) => setCropInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setCropFilter(cropInput.trim());
          }}
          placeholder={t('commonSearch')}
          aria-label={t('discoverFilterCrop')}
        />
        <button
          type="button"
          className="av-btn av-btn-ghost"
          style={{ flexShrink: 0, alignSelf: 'center' }}
          onClick={() => setCropFilter(cropInput.trim())}
        >
          {t('discoverApply')}
        </button>
      </div>

      {demands === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {demands !== null && demands.length === 0 ? (
        <EmptyState icon="📣" titleKey="browseDemandsEmpty" />
      ) : null}

      <div className="trade-list">
        {demands?.map((demand) => (
          <div key={demand.id} className="trade-card">
            <div className="trade-card-row">
              <span className="trade-card-title">
                {demand.crop} · {demand.quantity} {unitOf(demand)}
              </span>
              <span className="trade-card-amount">
                {inr(demand.maxPrice)}
                {t('perQuintal')}
              </span>
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {t('browseDemandsBuyer')}: {demand.buyerName}
                {demand.buyerCompany ? ` · ${demand.buyerCompany}` : ''}
              </span>
              {demand.offersCount > 0 ? (
                <span className="trade-card-sub">
                  {t('demandsOffersCount', { count: demand.offersCount })}
                </span>
              ) : null}
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {t('demandsGrade')}: {demand.qualityGrade} · {t(`freq_${demand.frequency}`)}
                {demand.neededBy ? ` · ${t('demandsNeededBy')}: ${fmtDate(demand.neededBy)}` : ''}
                {demand.deliveryLocation ? ` · ${demand.deliveryLocation}` : ''}
              </span>
            </div>
            {demand.notes ? <span className="trade-card-sub">{demand.notes}</span> : null}
            <div className="trade-actions-row">
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={() => openOfferSheet(demand)}
              >
                {t('browseDemandsOffer')}
              </button>
              <button
                type="button"
                className="av-btn av-btn-ghost"
                disabled={chattingId === demand.id}
                onClick={() => void startChat(demand.id)}
              >
                {chattingId === demand.id ? (
                  <span className="av-spinner" aria-hidden />
                ) : (
                  `💬 ${t('chatWithBuyer')}`
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <ModalSheet
        open={offering !== null}
        onClose={() => setOffering(null)}
        title={t('offerMakeTitle')}
      >
        {offering ? (
          <>
            <p className="trade-hint" style={{ marginBottom: 12 }}>
              {t('demandsFor')}: {offering.crop} · {offering.quantity} {unitOf(offering)} ·{' '}
              {t('demandsMaxPrice')} {inr(offering.maxPrice)}
              {t('perQuintal')}
            </p>
            <LabeledTextField
              label={t('offerYourPrice')}
              value={offerPrice}
              onChange={setOfferPrice}
              type="number"
              inputMode="numeric"
              prefix="₹"
              required
              error={offerErrors.pricePerUnit}
            />
            <div className="av-field">
              <span className="av-label">{t('offerQtyLabel')}</span>
              <QuantityStepper
                value={offerQty}
                onChange={setOfferQty}
                step={0.5}
                min={0.5}
                max={offering.quantity}
                unit={unitOf(offering)}
              />
              {offerErrors.quantity ? <p className="av-field-error">{offerErrors.quantity}</p> : null}
            </div>
            <LabeledTextField
              label={t('offerMessageLabel')}
              value={offerMsg}
              onChange={setOfferMsg}
              maxLength={200}
            />
            <div className="trade-actions">
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={() => void submitOffer()}
                disabled={busy}
              >
                {busy ? <span className="av-spinner" aria-hidden /> : t('offerSubmit')}
              </button>
              <p className="trade-hint" style={{ textAlign: 'center', width: '100%' }}>
                💬 {t('offerChatHint')}
              </p>
              <button
                type="button"
                className="av-btn av-btn-ghost"
                onClick={() => setOffering(null)}
                disabled={busy}
              >
                {t('commonCancel')}
              </button>
            </div>
          </>
        ) : null}
      </ModalSheet>
    </ToolShell>
  );
}
