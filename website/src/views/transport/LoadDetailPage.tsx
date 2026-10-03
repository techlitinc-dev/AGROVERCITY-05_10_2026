import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChipSelect from '../../components/ChipSelect';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import ConfirmSheet from '../../components/trade/ConfirmSheet';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { inr } from '../../lib/api/trade';
import {
  acceptLoadBid,
  loadBids,
  myVehicles,
  openLoads,
  placeBid,
  type LoadBid,
  type OpenLoad,
  type OwnerVehicle,
} from '../../lib/api/transport';
import { useT } from '../../lib/i18n';
import { ensureProfile } from '../../stores/dashboard';
import { useSessionStore } from '../../stores/session';
import '../../theme/trade.css';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Load detail (plan §4.2) — shared page, no ensure on mount. The owner
 * (farmer) sees incoming bids sorted by fare and accepts one (booking is
 * born accepted); everyone else with a transporter profile can place a bid.
 * Role drift self-heals via ensureProfile + one retry on each action.
 */
export default function LoadDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const { loadId } = useParams();
  const uid = useSessionStore((s) => s.user?.id ?? s.user?.uid);

  const [load, setLoad] = useState<OpenLoad | null>(null);
  const [bids, setBids] = useState<LoadBid[]>([]);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accepting, setAccepting] = useState<LoadBid | null>(null);
  const [bidSheetOpen, setBidSheetOpen] = useState(false);
  const [vehicles, setVehicles] = useState<OwnerVehicle[]>([]);
  const [bidFare, setBidFare] = useState('');
  const [bidEta, setBidEta] = useState('');
  const [bidVehicleId, setBidVehicleId] = useState('');
  const [bidNotes, setBidNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadAll = useCallback(() => {
    if (!loadId) return;
    setFailed(false);
    openLoads()
      .then((res) => {
        const found = res.data.find((l) => l.id === loadId) ?? null;
        setLoad(found);
        if (found && found.userId === uid && found.status === 'open') {
          loadBids(loadId)
            .then((b) => setBids(b.data))
            .catch(() => setBids([]));
        }
      })
      .catch(() => setFailed(true));
  }, [loadId, uid]);

  useEffect(loadAll, [loadAll]);

  const isOwner = !!uid && load?.userId === uid;

  const failToast = (e: unknown) => {
    if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
      setErrors(e.fieldErrors);
    } else {
      toast(t('actionFailed'), { error: true });
    }
  };

  /** Role-aware action runner: on FORBIDDEN_ROLE, activate the needed profile and retry once. */
  const withRoleHeal = async <T,>(
    role: 'farmer' | 'transport',
    fn: () => Promise<T>,
    retried = false
  ): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      if (isApiError(e) && e.code === 'FORBIDDEN_ROLE' && !retried) {
        const fixed = await ensureProfile(role);
        if (fixed) {
          return withRoleHeal(role, fn, true);
        }
      }
      throw e;
    }
  };

  const confirmAcceptBid = async () => {
    if (!accepting || !loadId) return;
    setBusy(true);
    try {
      const res = await withRoleHeal('farmer', () => acceptLoadBid(loadId, accepting.id));
      toast(t('trBookingCreated'));
      setAccepting(null);
      navigate(`/dashboard/p/transport/trips/${res.booking.id}`);
    } catch (e) {
      failToast(e);
    } finally {
      setBusy(false);
    }
  };

  const openBidSheet = () => {
    setErrors({});
    setBidFare(load ? String(load.targetFare) : '');
    setBidEta('');
    setBidVehicleId('');
    setBidNotes('');
    setBidSheetOpen(true);
    myVehicles()
      .then(setVehicles)
      .catch(() => setVehicles([]));
  };

  const submitBid = async () => {
    if (!loadId) return;
    const next: Record<string, string> = {};
    if (!(Number(bidFare) > 0)) next.bidFare = t('commonRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    try {
      await withRoleHeal('transport', () =>
        placeBid(loadId, {
          quotedFare: Math.round(Number(bidFare)),
          vehicleId: bidVehicleId || undefined,
          estimatedPickupTime: bidEta.trim() || undefined,
          notes: bidNotes.trim() || undefined,
        })
      );
      toast(t('trBidSent'));
      setBidSheetOpen(false);
    } catch (e) {
      failToast(e);
    } finally {
      setBusy(false);
    }
  };

  const sortedBids = [...bids].sort((a, b) => a.quotedFare - b.quotedFare);

  return (
    <ToolShell toolId="loadBoard" backTo="/dashboard/p/loadBoard">
      {load === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

      {failed ? (
        <EmptyState
          icon="📡"
          titleKey="tradeLoadFailed"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={loadAll}>
              ↻ {t('retry')}
            </button>
          }
        />
      ) : null}

      {load ? (
        <>
          <div className="trade-card" style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">
                {load.crop} · {load.quantityQuintals} {t('unitQuintal')}
              </span>
              <StatusPill status={load.status} />
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {load.pickupLocation} → {load.dropLocation}
              </span>
              <span className="trade-card-amount">{inr(load.targetFare)}</span>
            </div>
          </div>

          {load.status === 'booked' ? <p className="trade-hint">{t('trLoadBookedBanner')}</p> : null}

          <div className="trade-detail-grid">
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('trPickup')}</div>
              <div className="trade-detail-value">{load.pickupLocation}</div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('trDrop')}</div>
              <div className="trade-detail-value">{load.dropLocation}</div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('trPickupDate')}</div>
              <div className="trade-detail-value">{fmtDate(load.pickupDate)}</div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('trPreferredVehicle')}</div>
              <div className="trade-detail-value">{load.preferredVehicleType}</div>
            </div>
            {load.distanceKm ? (
              <div className="trade-detail-item">
                <div className="trade-detail-label">{t('trDistance')}</div>
                <div className="trade-detail-value">
                  {load.distanceKm} {t('trKm')}
                </div>
              </div>
            ) : null}
            {load.packaging ? (
              <div className="trade-detail-item">
                <div className="trade-detail-label">{t('trPackaging')}</div>
                <div className="trade-detail-value">{load.packaging}</div>
              </div>
            ) : null}
            {load.notes ? (
              <div className="trade-detail-item" style={{ gridColumn: '1 / -1' }}>
                <div className="trade-detail-label">{t('commonNotes')}</div>
                <div className="trade-detail-value" style={{ fontWeight: 600 }}>
                  {load.notes}
                </div>
              </div>
            ) : null}
          </div>

          {isOwner && load.status === 'open' ? (
            <>
              <p className="trade-section-title">{t('trBidsTitle')}</p>
              {sortedBids.length === 0 ? <p className="trade-hint">{t('trEmptyBids')}</p> : null}
              <div className="trade-list">
                {sortedBids.map((bid) => (
                  <div key={bid.id} className="trade-card" style={{ cursor: 'default' }}>
                    <div className="trade-card-row">
                      <span className="trade-card-title">{bid.transporterName}</span>
                      <span className="trade-card-amount">{inr(bid.quotedFare)}</span>
                    </div>
                    <div className="trade-card-row">
                      <span className="trade-card-sub">
                        {[bid.vehicleNo, bid.estimatedPickupTime]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      <StatusPill status={bid.status} />
                    </div>
                    {bid.notes ? (
                      <div className="trade-card-row">
                        <span className="trade-card-sub">{bid.notes}</span>
                      </div>
                    ) : null}
                    {bid.status === 'pending' ? (
                      <div className="trade-actions-row">
                        <button
                          type="button"
                          className="av-btn av-btn-primary"
                          onClick={() => setAccepting(bid)}
                          disabled={busy}
                        >
                          {t('trAcceptBid')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {!isOwner && load.status === 'open' ? (
            <div className="trade-actions">
              <button type="button" className="av-btn av-btn-primary" onClick={openBidSheet} disabled={busy}>
                {t('trBidNow')}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <ConfirmSheet
        open={accepting !== null}
        title={t('trAcceptBid')}
        body={t('trAcceptBidConfirm')}
        confirmLabel={t('trAcceptBid')}
        onConfirm={() => void confirmAcceptBid()}
        onClose={() => setAccepting(null)}
        busy={busy}
      />

      <ModalSheet open={bidSheetOpen} onClose={() => setBidSheetOpen(false)} title={t('trBidNow')}>
        <LabeledTextField
          label={t('trBidFare')}
          value={bidFare}
          onChange={setBidFare}
          type="number"
          inputMode="numeric"
          required
          error={errors.bidFare}
        />
        {vehicles.length > 0 ? (
          <div className="av-field">
            <span className="av-label">{t('trBidVehicle')}</span>
            <ChipSelect
              options={vehicles.map((v) => v.registrationNo)}
              selected={vehicles.filter((v) => v.id === bidVehicleId).map((v) => v.registrationNo)}
              onToggle={(label) => {
                const found = vehicles.find((v) => v.registrationNo === label);
                setBidVehicleId(found?.id ?? '');
              }}
              single
            />
          </div>
        ) : null}
        <LabeledTextField
          label={t('trBidEta')}
          value={bidEta}
          onChange={setBidEta}
          placeholder={t('trBidEta')}
        />
        <LabeledTextField label={t('commonNotes')} value={bidNotes} onChange={setBidNotes} />
        <div className="trade-actions">
          <button
            type="button"
            className="av-btn av-btn-primary"
            onClick={() => void submitBid()}
            disabled={busy}
          >
            {busy ? <span className="av-spinner" aria-hidden /> : t('trBidSubmit')}
          </button>
          <button
            type="button"
            className="av-btn av-btn-ghost"
            onClick={() => setBidSheetOpen(false)}
            disabled={busy}
          >
            {t('commonCancel')}
          </button>
        </div>
      </ModalSheet>
    </ToolShell>
  );
}
