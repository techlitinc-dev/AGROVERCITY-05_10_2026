import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import EmptyState from '../../components/trade/EmptyState';
import PriceWithBenchmark from '../../components/trade/PriceWithBenchmark';
import QuantityStepper from '../../components/trade/QuantityStepper';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { saveFarmer } from '../../lib/api/discovery';
import { createOffer } from '../../lib/api/offers';
import { openDirectChat } from '../../lib/api/chat';
import { createPurchase } from '../../lib/api/purchases';
import { myBookings, type MyBookingsResponse } from '../../lib/api/transport';
import { isApiError } from '../../lib/api/client';
import { getLot, inr, type Lot } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Lot detail (buyer view, spec V2/V5) — photos, facts grid, live mandi
 * benchmark, save-farmer, Book-Now (instant booking at list rate) and
 * Make-offer (structured negotiation entry point).
 */

const GONE_CODES = new Set(['LOT_NOT_FOUND', 'LOT_NOT_OPEN']);

const fmtDate = (value: string): string =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function LotDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const { lotId } = useParams();
  useEnsureProfile('seller');

  const [lot, setLot] = useState<Lot | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [savingFarmer, setSavingFarmer] = useState(false);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookQty, setBookQty] = useState(0);
  const [booking, setBooking] = useState(false);

  const [offerOpen, setOfferOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerQty, setOfferQty] = useState(0);
  const [offerMsg, setOfferMsg] = useState('');
  const [offerErrors, setOfferErrors] = useState<Record<string, string>>({});
  const [offering, setOffering] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [transportLeg, setTransportLeg] = useState<MyBookingsResponse["transport"][number] | null>(null);

  const load = useCallback(() => {
    if (!lotId) return;
    setFailed(false);
    setLoading(true);
    getLot(lotId)
      .then((l) => {
        setLot(l);
        setBookQty(l.quantityQuintals);
        setOfferQty(l.quantityQuintals);
        setOfferPrice(String(l.expectedRate));
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [lotId]);

  useEffect(load, [load]);

  // Produce lot → pickup → delivery: show this lot's transport leg when one
  // of the viewer's transport bookings is tied to it (F12).
  useEffect(() => {
    if (!lotId) return;
    myBookings(undefined, lotId)
      .then((res) => setTransportLeg(res.transport?.[0] ?? null))
      .catch(() => setTransportLeg(null));
  }, [lotId]);

  const openOfferSheet = () => {
    if (!lot) return;
    setOfferErrors({});
    setOfferPrice(String(lot.expectedRate));
    setOfferQty(lot.quantityQuintals);
    setOfferMsg('');
    setOfferOpen(true);
  };

  const confirmSaveFarmer = async () => {
    if (!lot || savingFarmer) return;
    setSavingFarmer(true);
    try {
      await saveFarmer(lot.farmerId);
      setSaved(true);
      toast(t('savedAdded'));
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setSavingFarmer(false);
    }
  };

  const confirmBooking = async () => {
    if (!lot || booking) return;
    setBooking(true);
    try {
      const purchase = await createPurchase({ lotId: lot.id, quantity: bookQty });
      setBookingOpen(false);
      toast(t('purchaseBookNowDone'));
      navigate(`/dashboard/p/purchases/${purchase.id}/chat`);
    } catch (e) {
      setBookingOpen(false);
      if (isApiError(e) && GONE_CODES.has(e.code)) {
        toast(t('offerTargetGone'), { error: true });
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBooking(false);
    }
  };

  const startChat = async () => {
    if (!lot) return;
    setChatting(true);
    try {
      const room = await openDirectChat({ lotId: lot.id });
      navigate(`/dashboard/p/chats/${room.id}`);
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setChatting(false);
    }
  };

  const submitOffer = async () => {
    if (!lot || offering) return;
    const price = Number(offerPrice);
    const next: Record<string, string> = {};
    if (!(price > 0)) next.pricePerUnit = t('commonRequired');
    if (!(offerQty > 0)) next.quantity = t('commonRequired');
    setOfferErrors(next);
    if (Object.keys(next).length > 0) return;
    setOffering(true);
    try {
      const offer = await createOffer({
        targetType: 'lot',
        targetId: lot.id,
        pricePerUnit: Math.round(price),
        quantity: offerQty,
        message: offerMsg.trim() || undefined,
      });
      setOfferOpen(false);
      toast(t('offerSentToast'));
      navigate(`/dashboard/p/myOffers/${offer.id}/chat`);
    } catch (e) {
      if (isApiError(e) && e.fieldErrors) {
        setOfferErrors(e.fieldErrors);
      } else if (isApiError(e) && GONE_CODES.has(e.code)) {
        setOfferOpen(false);
        toast(t('offerTargetGone'), { error: true });
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setOffering(false);
    }
  };

  const locationText = lot?.location
    ? [lot.location.village, lot.location.district, lot.location.state].filter(Boolean).join(', ')
    : '';

  if (loading) {
    return (
      <ToolShell toolId="browseLots" backTo="/dashboard/p/browseLots">
        <p className="trade-hint">{t('commonLoading')}</p>
      </ToolShell>
    );
  }

  if (failed || !lot) {
    return (
      <ToolShell toolId="browseLots" backTo="/dashboard/p/browseLots">
        <EmptyState
          icon="📡"
          titleKey="tradeLoadFailed"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={load}>
              ↻ {t('retry')}
            </button>
          }
        />
      </ToolShell>
    );
  }

  const isOpen = lot.status === 'open';

  return (
    <ToolShell toolId="browseLots" backTo="/dashboard/p/browseLots">
      <div className="trade-card-row" style={{ marginTop: 4 }}>
        <span className="trade-section-title" style={{ margin: 0 }}>
          {lot.crop} · {lot.quantityQuintals} {t('unitQuintal')}
        </span>
        <StatusPill status={lot.status} />
      </div>

      {lot.status === 'sold' ? <p className="trade-hint">{t('lotSoldHint')}</p> : null}
      {lot.status === 'withdrawn' ? <p className="trade-hint">{t('lotWithdrawnHint')}</p> : null}

      {lot.photos?.length ? (
        <div className="trade-card-photos" style={{ marginTop: 8 }}>
          {lot.photos.slice(0, 6).map((url) => (
            <img key={url} src={url} alt={lot.crop} loading="lazy" />
          ))}
        </div>
      ) : null}

      <div className="trade-detail-grid">
        <div className="trade-detail-item">
          <div className="trade-detail-label">{t('lotDetailQuantity')}</div>
          <div className="trade-detail-value">
            {lot.quantityQuintals} {t('unitQuintal')}
          </div>
        </div>
        <div className="trade-detail-item">
          <div className="trade-detail-label">{t('lotDetailHarvest')}</div>
          <div className="trade-detail-value">{lot.harvestDate ? fmtDate(lot.harvestDate) : t('commonNotAvailable')}</div>
        </div>
        <div className="trade-detail-item">
          <div className="trade-detail-label">{t('lotDetailLocation')}</div>
          <div className="trade-detail-value">{locationText || t('commonNotAvailable')}</div>
        </div>
        <div className="trade-detail-item">
          <div className="trade-detail-label">{t('lotDetailFarmer')}</div>
          <div className="trade-detail-value">{lot.farmerName ?? t('commonNotAvailable')}</div>
        </div>
      </div>

      <PriceWithBenchmark crop={lot.crop} quantityQuintals={lot.quantityQuintals} price={lot.expectedRate} />

      {transportLeg ? (
        <section className="trade-card" style={{ marginTop: 12 }}>
          <div className="trade-card-row">
            <span className="trade-section-title" style={{ margin: 0 }}>
              {t('lotTransportLegTitle')}
            </span>
            <StatusPill status={transportLeg.status} />
          </div>
          <p className="trade-hint" style={{ margin: '8px 0 4px' }}>
            🚚 {transportLeg.vehicleType} · {transportLeg.pickup} → {transportLeg.drop}
          </p>
          <div className="trade-actions">
            <button
              type="button"
              className="av-btn av-btn-ghost"
              onClick={() => navigate(`/dashboard/p/transport/trips/${transportLeg.id}`)}
            >
              {t('lotTransportLegCta')}
            </button>
          </div>
        </section>
      ) : null}

      {isOpen ? (
        <div className="trade-actions">
          <button
            type="button"
            className="av-btn av-btn-ghost"
            onClick={() => void confirmSaveFarmer()}
            disabled={saved || savingFarmer}
          >
            {saved ? t('lotDetailSaved') : t('lotDetailSaveFarmer')}
          </button>
          <button type="button" className="av-btn av-btn-primary" onClick={() => setBookingOpen(true)}>
            {t('lotDetailBookNow')} · {inr(lot.expectedRate * lot.quantityQuintals)}
          </button>
          <button type="button" className="av-btn av-btn-ghost" onClick={openOfferSheet}>
            {t('lotDetailMakeOffer')}
          </button>
          <button
            type="button"
            className="av-btn av-btn-ghost"
            disabled={chatting}
            onClick={() => void startChat()}
          >
            {chatting ? <span className="av-spinner" aria-hidden /> : `💬 ${t('chatWithFarmer')}`}
          </button>
        </div>
      ) : null}

      <ModalSheet open={bookingOpen} onClose={() => setBookingOpen(false)} title={t('purchaseBookNowTitle')}>
        <div className="av-field">
          <span className="av-label">{t('commonQuantity')}</span>
          <QuantityStepper
            value={bookQty}
            onChange={setBookQty}
            step={0.5}
            min={0.5}
            max={lot.quantityQuintals}
            unit={t('unitQuintal')}
          />
        </div>
        <div className="trade-invoice-box">
          <div className="trade-invoice-row">
            <span>{t('purchaseAgreedPrice')}</span>
            <span>
              {inr(lot.expectedRate)}
              {t('perQuintal')}
            </span>
          </div>
          <div className="trade-invoice-total">
            <div className="trade-invoice-row">
              <span>{t('purchaseBookNowTotal')}</span>
              <span>{inr(lot.expectedRate * bookQty)}</span>
            </div>
          </div>
        </div>
        <div className="trade-actions">
          <button type="button" className="av-btn av-btn-primary" onClick={() => void confirmBooking()} disabled={booking}>
            {booking ? <span className="av-spinner" aria-hidden /> : t('purchaseBookNowSubmit')}
          </button>
          <button type="button" className="av-btn av-btn-ghost" onClick={() => setBookingOpen(false)} disabled={booking}>
            {t('commonCancel')}
          </button>
        </div>
      </ModalSheet>

      <ModalSheet open={offerOpen} onClose={() => setOfferOpen(false)} title={t('offerMakeTitle')}>
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
            max={lot.quantityQuintals}
            unit={t('unitQuintal')}
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
          <button type="button" className="av-btn av-btn-primary" onClick={() => void submitOffer()} disabled={offering}>
            {offering ? <span className="av-spinner" aria-hidden /> : t('offerSubmit')}
          </button>
          <button type="button" className="av-btn av-btn-ghost" onClick={() => setOfferOpen(false)} disabled={offering}>
            {t('commonCancel')}
          </button>
        </div>
        <p className="trade-hint" style={{ textAlign: 'center' }}>💬 {t('offerChatHint')}</p>
      </ModalSheet>
    </ToolShell>
  );
}
