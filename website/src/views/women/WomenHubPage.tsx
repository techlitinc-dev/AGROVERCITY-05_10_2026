import { useCallback, useEffect, useState, type FormEvent } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  backyardLivestock,
  createEnterpriseLine,
  createGardenPlan,
  createShgGroup,
  createShgMeeting,
  homeEnterprise,
  listGardenPlans,
  markAttendance,
  publishEnterpriseListing,
  recordShgCollection,
  shgDeposit,
  shgOverview,
  type EnterpriseSummary,
  type GardenItem,
  type GardenPlan,
  type HerdRow,
  type ShgOverview,
} from '../../lib/api/women';
import { useT } from '../../lib/i18n';
import { rupeesFromPaisa } from '../bank/money';
import '../../theme/trade.css';
import '../../theme/women.css';

/**
 * Women Farmer Hub (robust.md §7.12) — 4 tabs on real collections:
 *   (a) SHG savings ledger + meeting workflow (`shg_groups`/`shg_meetings`)
 *   (b) kitchen-garden planner (`garden_plans`)
 *   (c) livestock health — joins the herd registry (`/v1/livestock/animals`)
 *   (d) home-enterprise income + marketplace publishing (`home_enterprises`)
 * Money is integer paisa; rendered in ₹. The rose theme overlay lives in
 * `theme/women.css` and is scoped to `.women-hub`.
 *
 * # SHG federation is a future Enterprise-tier feature — note only, not built.
 */
type Tab = 'shg' | 'garden' | 'livestock' | 'enterprise';

const TABS: Array<{ id: Tab; key: string }> = [
  { id: 'shg', key: 'womenTabShg' },
  { id: 'garden', key: 'womenTabGarden' },
  { id: 'livestock', key: 'womenTabLivestock' },
  { id: 'enterprise', key: 'womenTabEnterprise' },
];

function parseAmount(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function rupeesToPaisa(value: string): number | null {
  const rupees = parseAmount(value);
  return rupees === null ? null : Math.round(rupees * 100);
}

function ShgTab() {
  const t = useT();
  const [overview, setOverview] = useState<ShgOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [depositMonth, setDepositMonth] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingAgenda, setMeetingAgenda] = useState('');
  const [collectionMeeting, setCollectionMeeting] = useState('');
  const [collectionMember, setCollectionMember] = useState('');
  const [collectionAmount, setCollectionAmount] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setOverview(await shgOverview());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const guard = async (fn: () => Promise<void>, successKey: string) => {
    setBusy(true);
    try {
      await fn();
      toast(t(successKey));
      await load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="trade-hint">{t('commonLoading')}</p>;
  if (failed) return <p className="trade-hint">{t('womenLoadFailed')}</p>;

  const group = overview?.group ?? null;
  if (!group) {
    return (
      <div className="women-card">
        <EmptyState icon="🤝" titleKey="womenShgEmpty" />
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!groupName.trim()) return;
            void guard(() => createShgGroup({ name: groupName.trim() }).then(() => undefined), 'womenShgCreate');
          }}
        >
          <label className="trade-card-sub" htmlFor="shg-name">
            {t('womenShgName')}
          </label>
          <input
            id="shg-name"
            className="av-input"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <div className="trade-actions-row">
            <button type="submit" className="av-btn av-btn-primary" disabled={busy}>
              {t('womenShgCreate')}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="women-card">
        <div className="trade-card-row">
          <span className="trade-card-title">{group.name}</span>
          <span className="women-chip">{t('womenShgMemberCount')}: {group.memberCount}</span>
        </div>
        <span className="women-metric">{t('womenShgCorpus')}: {rupeesFromPaisa(group.corpusPaisa)}</span>
        <span className="trade-card-sub">
          {t('womenShgLoanFund')}: {rupeesFromPaisa(group.loanFundPaisa)} ·{' '}
          {t('womenShgMonthlyDeposit')}: {rupeesFromPaisa(group.monthlyDepositPaisa)}
        </span>
      </div>

      <h4>{t('womenShgDepositTitle')}</h4>
      <form
        className="women-card"
        onSubmit={(e) => {
          e.preventDefault();
          const amountPaisa = rupeesToPaisa(depositAmount);
          if (!depositMonth.trim() || amountPaisa === null) return;
          void guard(
            () => shgDeposit({ amountPaisa, month: depositMonth.trim() }).then(() => undefined),
            'womenShgDeposited'
          );
        }}
      >
        <label className="trade-card-sub" htmlFor="shg-month">
          {t('womenShgDepositMonth')}
        </label>
        <input
          id="shg-month"
          className="av-input"
          placeholder={t('womenShgDepositMonthPlaceholder')}
          value={depositMonth}
          onChange={(e) => setDepositMonth(e.target.value)}
        />
        <label className="trade-card-sub" htmlFor="shg-amount">
          {t('womenShgDepositAmount')}
        </label>
        <input
          id="shg-amount"
          className="av-input"
          inputMode="numeric"
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
        />
        <div className="trade-actions-row">
          <button type="submit" className="av-btn av-btn-primary" disabled={busy}>
            {t('womenShgDepositSubmit')}
          </button>
        </div>
      </form>

      <h4>{t('womenShgDepositsTitle')}</h4>
      {(overview?.deposits.length ?? 0) === 0 ? (
        <EmptyState icon="💰" titleKey="womenShgDepositsEmpty" />
      ) : (
        <div className="trade-list">
          {overview?.deposits.map((deposit) => (
            <div className="trade-card" key={deposit.id} style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-sub">{deposit.month}</span>
                <span className="trade-card-amount">{rupeesFromPaisa(deposit.amountPaisa)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <h4>{t('womenShgMeetingsTitle')}</h4>
      <form
        className="women-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (!meetingDate.trim()) return;
          void guard(
            () =>
              createShgMeeting({ date: meetingDate.trim(), agenda: meetingAgenda }).then(
                () => undefined
              ),
            'womenShgMeetingCreated'
          );
        }}
      >
        <span className="trade-card-title">{t('womenShgMeetingNew')}</span>
        <label className="trade-card-sub" htmlFor="shg-meeting-date">
          {t('womenShgMeetingDate')}
        </label>
        <input
          id="shg-meeting-date"
          className="av-input"
          placeholder="2026-10-05"
          value={meetingDate}
          onChange={(e) => setMeetingDate(e.target.value)}
        />
        <label className="trade-card-sub" htmlFor="shg-meeting-agenda">
          {t('womenShgMeetingAgenda')}
        </label>
        <input
          id="shg-meeting-agenda"
          className="av-input"
          value={meetingAgenda}
          onChange={(e) => setMeetingAgenda(e.target.value)}
        />
        <div className="trade-actions-row">
          <button type="submit" className="av-btn av-btn-primary" disabled={busy}>
            {t('womenShgMeetingCreate')}
          </button>
        </div>
      </form>

      {(overview?.meetings.length ?? 0) === 0 ? (
        <EmptyState icon="🗓️" titleKey="womenShgMeetingsEmpty" />
      ) : (
        <div className="trade-list">
          {overview?.meetings.map((meeting) => (
            <div className="women-card" key={meeting.id}>
              <div className="trade-card-row">
                <span className="trade-card-title">{meeting.date}</span>
                <span className="trade-card-sub">{meeting.agenda}</span>
              </div>
              <span className="trade-card-sub">
                {t('womenShgAttendance')}:{' '}
                {meeting.attendance.filter((a) => a.present).length}/{group.memberCount}
              </span>
              <div className="trade-actions-row">
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  disabled={busy}
                  onClick={() =>
                    void guard(
                      () =>
                        markAttendance(meeting.id, {
                          memberUid: group.memberUid,
                          present: true,
                        }).then(() => undefined),
                      'womenShgAttendanceMark'
                    )
                  }
                >
                  {t('womenShgAttendanceMark')}
                </button>
              </div>
              <div className="trade-card-row">
                <input
                  className="av-input"
                  placeholder={t('womenShgCollectionMember')}
                  value={collectionMeeting === meeting.id ? collectionMember : ''}
                  onChange={(e) => {
                    setCollectionMeeting(meeting.id);
                    setCollectionMember(e.target.value);
                  }}
                />
                <input
                  className="av-input"
                  inputMode="numeric"
                  placeholder={t('womenShgCollectionAmount')}
                  value={collectionMeeting === meeting.id ? collectionAmount : ''}
                  onChange={(e) => {
                    setCollectionMeeting(meeting.id);
                    setCollectionAmount(e.target.value);
                  }}
                />
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  disabled={busy}
                  onClick={() => {
                    const amountPaisa = rupeesToPaisa(collectionAmount);
                    if (!collectionMember.trim() || amountPaisa === null) return;
                    void guard(
                      () =>
                        recordShgCollection(meeting.id, {
                          memberUid: collectionMember.trim(),
                          amountPaisa,
                        }).then(() => undefined),
                      'womenShgCollectionSubmit'
                    );
                  }}
                >
                  {t('womenShgCollectionSubmit')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function GardenTab() {
  const t = useT();
  const [plans, setPlans] = useState<GardenPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState('');
  const [cropName, setCropName] = useState('');
  const [cropDays, setCropDays] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setPlans((await listGardenPlans()).data);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!category.trim() || !cropName.trim()) return;
    const days = parseAmount(cropDays);
    const items: GardenItem[] = [
      { name: cropName.trim(), daysToHarvest: days === null ? 0 : Math.round(days) },
    ];
    setBusy(true);
    try {
      await createGardenPlan({ category: category.trim(), items });
      toast(t('womenGardenCreated'));
      setCategory('');
      setCropName('');
      setCropDays('');
      await load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="trade-hint">{t('commonLoading')}</p>;
  if (failed) return <p className="trade-hint">{t('womenLoadFailed')}</p>;

  return (
    <>
      <div className="trade-list">
        {plans.length === 0 ? <EmptyState icon="🌱" titleKey="womenGardenEmpty" /> : null}
        {plans.map((plan) => (
          <div className="women-card" key={plan.id}>
            <div className="trade-card-row">
              <span className="trade-card-title">{plan.category}</span>
              <span className="women-chip">{t('womenGardenCategory')}</span>
            </div>
            {plan.items.map((item) => (
              <div key={item.name}>
                <span className="trade-card-sub">
                  <strong>{item.vernacularName || item.name}</strong> ({item.name})
                </span>
                <p className="trade-card-sub">
                  {t('womenGardenNutrition')}: {item.nutrition} ·{' '}
                  {t('womenGardenCompanion')}: {item.companion}
                </p>
                <p className="trade-card-sub">
                  {t('womenGardenDays', { days: item.daysToHarvest ?? 0 })}
                </p>
              </div>
            ))}
          </div>
        ))}
      </div>

      <form className="women-card" onSubmit={(e) => void create(e)}>
        <span className="trade-card-title">{t('womenGardenNewTitle')}</span>
        <label className="trade-card-sub" htmlFor="garden-category">
          {t('womenGardenNewCategory')}
        </label>
        <input
          id="garden-category"
          className="av-input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <label className="trade-card-sub" htmlFor="garden-crop">
          {t('womenGardenItemName')}
        </label>
        <input
          id="garden-crop"
          className="av-input"
          value={cropName}
          onChange={(e) => setCropName(e.target.value)}
        />
        <label className="trade-card-sub" htmlFor="garden-days">
          {t('womenGardenItemDays')}
        </label>
        <input
          id="garden-days"
          className="av-input"
          inputMode="numeric"
          value={cropDays}
          onChange={(e) => setCropDays(e.target.value)}
        />
        <div className="trade-actions-row">
          <button type="submit" className="av-btn av-btn-primary" disabled={busy}>
            {t('womenGardenCreate')}
          </button>
        </div>
      </form>
    </>
  );
}

function LivestockTab() {
  const t = useT();
  const [herd, setHerd] = useState<HerdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setFailed(false);
      try {
        setHerd((await backyardLivestock()).data);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="trade-hint">{t('commonLoading')}</p>;
  if (failed) return <p className="trade-hint">{t('womenLoadFailed')}</p>;
  if (herd.length === 0) return <EmptyState icon="🐄" titleKey="womenLivestockEmpty" />;

  return (
    <div className="trade-list">
      {herd.map((row) => (
        <div className="women-card" key={row.id}>
          <div className="trade-card-row">
            <span className="trade-card-title">
              {row.vernacularName || row.name || row.animal}
            </span>
            <span className="women-chip">{row.animal}</span>
          </div>
          {row.yieldLabel ? (
            <span className="trade-card-sub">
              {t('womenLivestockYield')}: {row.yieldLabel}
            </span>
          ) : null}
          {row.vaccine ? (
            <span className="trade-card-sub">
              {t('womenLivestockVaccine')}: {row.vaccine} ·{' '}
              {t('womenLivestockVaccineDue', { date: row.vaccineDue })}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function EnterpriseTab() {
  const t = useT();
  const [summary, setSummary] = useState<EnterpriseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [product, setProduct] = useState('');
  const [profit, setProfit] = useState('');
  const [listingTitle, setListingTitle] = useState('');
  const [listingCategory, setListingCategory] = useState('');
  const [listingMrp, setListingMrp] = useState('');
  const [listingPrice, setListingPrice] = useState('');
  const [listingStock, setListingStock] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setSummary(await homeEnterprise());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addLine = async (event: FormEvent) => {
    event.preventDefault();
    const monthlyProfitPaisa = rupeesToPaisa(profit);
    if (!product.trim() || monthlyProfitPaisa === null) return;
    setBusy(true);
    try {
      await createEnterpriseLine({ product: product.trim(), monthlyProfitPaisa });
      toast(t('womenEnterpriseAdded'));
      setProduct('');
      setProfit('');
      await load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const publish = async (event: FormEvent) => {
    event.preventDefault();
    const mrp = parseAmount(listingMrp);
    const price = parseAmount(listingPrice);
    if (!listingTitle.trim() || !listingCategory.trim() || mrp === null || price === null) return;
    const stock = parseAmount(listingStock);
    setBusy(true);
    try {
      await publishEnterpriseListing({
        title: listingTitle.trim(),
        category: listingCategory.trim(),
        mrp: Math.round(mrp),
        discountedPrice: Math.round(price),
        stock: stock === null ? 0 : Math.round(stock),
      });
      toast(t('womenEnterprisePublished'));
      setListingTitle('');
      setListingCategory('');
      setListingMrp('');
      setListingPrice('');
      setListingStock('');
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="trade-hint">{t('commonLoading')}</p>;
  if (failed) return <p className="trade-hint">{t('womenLoadFailed')}</p>;

  return (
    <>
      <div className="women-card">
        <span className="trade-card-title">{t('womenEnterpriseTotal')}</span>
        <span className="women-metric">
          {rupeesFromPaisa(summary?.totalMonthlyProfitPaisa ?? 0)}
        </span>
        <span className="trade-card-sub">{t('womenPaisaHint')}</span>
      </div>

      {(summary?.lines.length ?? 0) === 0 ? (
        <EmptyState icon="🏠" titleKey="womenEnterpriseEmpty" />
      ) : (
        <div className="trade-list">
          {summary?.lines.map((line) => (
            <div className="trade-card" key={line.id} style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">{line.product}</span>
                <span className="trade-card-amount">
                  {rupeesFromPaisa(line.monthlyProfitPaisa)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <form className="women-card" onSubmit={(e) => void addLine(e)}>
        <span className="trade-card-title">{t('womenEnterpriseAddTitle')}</span>
        <label className="trade-card-sub" htmlFor="ent-product">
          {t('womenEnterpriseProduct')}
        </label>
        <input
          id="ent-product"
          className="av-input"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
        />
        <label className="trade-card-sub" htmlFor="ent-profit">
          {t('womenEnterpriseProfit')}
        </label>
        <input
          id="ent-profit"
          className="av-input"
          inputMode="numeric"
          value={profit}
          onChange={(e) => setProfit(e.target.value)}
        />
        <div className="trade-actions-row">
          <button type="submit" className="av-btn av-btn-primary" disabled={busy}>
            {t('womenEnterpriseAdd')}
          </button>
        </div>
      </form>

      <form className="women-card" onSubmit={(e) => void publish(e)}>
        <span className="trade-card-title">{t('womenEnterprisePublishTitle')}</span>
        <p className="trade-card-sub">{t('womenEnterprisePublishHint')}</p>
        <label className="trade-card-sub" htmlFor="list-title">
          {t('womenEnterpriseTitleField')}
        </label>
        <input
          id="list-title"
          className="av-input"
          value={listingTitle}
          onChange={(e) => setListingTitle(e.target.value)}
        />
        <label className="trade-card-sub" htmlFor="list-category">
          {t('womenEnterpriseCategory')}
        </label>
        <input
          id="list-category"
          className="av-input"
          value={listingCategory}
          onChange={(e) => setListingCategory(e.target.value)}
        />
        <label className="trade-card-sub" htmlFor="list-mrp">
          {t('womenEnterpriseMrp')}
        </label>
        <input
          id="list-mrp"
          className="av-input"
          inputMode="numeric"
          value={listingMrp}
          onChange={(e) => setListingMrp(e.target.value)}
        />
        <label className="trade-card-sub" htmlFor="list-price">
          {t('womenEnterprisePrice')}
        </label>
        <input
          id="list-price"
          className="av-input"
          inputMode="numeric"
          value={listingPrice}
          onChange={(e) => setListingPrice(e.target.value)}
        />
        <label className="trade-card-sub" htmlFor="list-stock">
          {t('womenEnterpriseStock')}
        </label>
        <input
          id="list-stock"
          className="av-input"
          inputMode="numeric"
          value={listingStock}
          onChange={(e) => setListingStock(e.target.value)}
        />
        <div className="trade-actions-row">
          <button type="submit" className="av-btn av-btn-primary" disabled={busy}>
            {t('womenEnterprisePublish')}
          </button>
        </div>
      </form>
    </>
  );
}

export default function WomenHubPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('shg');

  return (
    <ToolShell toolId="womenFarmer">
      <div className="women-hub">
        <section className="dash-section">
          <h3>{t('womenTitle')}</h3>
          <p className="trade-hint">{t('womenHint')}</p>

          <div className="women-tabs" role="tablist">
            {TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                className={tab === entry.id ? 'women-tab women-tab-active' : 'women-tab'}
                onClick={() => setTab(entry.id)}
              >
                {t(entry.key)}
              </button>
            ))}
          </div>

          {tab === 'shg' ? <ShgTab /> : null}
          {tab === 'garden' ? <GardenTab /> : null}
          {tab === 'livestock' ? <LivestockTab /> : null}
          {tab === 'enterprise' ? <EnterpriseTab /> : null}
        </section>
      </div>
    </ToolShell>
  );
}
