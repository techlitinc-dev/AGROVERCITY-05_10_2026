import React, { useState } from 'react';
import { Coins, Gift, Flag, ScrollText, Settings2, Trash2, Handshake } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  KV,
  Btn,
  Tabs,
  Field,
  TextInput,
  Select,
  Banner,
  JsonConfigCard,
  idOf,
  str,
  num,
  useAsync,
  useReasonModal,
  asRow,
  type Row,
} from './shared';

/**
 * SOP-22 — Gamification & Referral Economy.
 * Coin circulation, ledger with manual adjustment (MPIN step-up), rewards,
 * referral fraud screens, coins configuration and the referral program
 * economics config.
 */
export const EconomyPanel: React.FC = () => {
  const [tab, setTab] = useState('circulation');
  return (
    <>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'circulation', label: 'Circulation' },
          { id: 'ledger', label: 'Ledger' },
          { id: 'adjust', label: 'Adjust coins' },
          { id: 'rewards', label: 'Rewards' },
          { id: 'fraud', label: 'Referral fraud' },
          { id: 'config', label: 'Coins config' },
          { id: 'referrals', label: 'Referral config' },
        ]}
      />
      {tab === 'circulation' && <CirculationCard />}
      {tab === 'ledger' && <LedgerCard />}
      {tab === 'adjust' && <AdjustCard />}
      {tab === 'rewards' && <RewardsCard />}
      {tab === 'fraud' && <FraudCard />}
      {tab === 'config' && (
        <JsonConfigCard
          title="SOP-22: Coins Configuration"
          subtitle="Earning / redemption rules for Kisan Coins (GET/PUT /admin/platform-config/coins)."
          icon={Settings2}
          load={() => admin.platform.coinConfig()}
          save={(payload, reason) => admin.platform.updateCoinConfig(payload, reason)}
        />
      )}
      {tab === 'referrals' && <ReferralConfigCard />}
    </>
  );
};

const CirculationCard: React.FC = () => {
  const circulation = useAsync(() => admin.economy.coinCirculation().catch(() => null), []);
  return (
    <PanelShell
      title="SOP-22: Coin Circulation"
      subtitle="Total issued, redeemed and outstanding Kisan Coins (GET /admin/gamification/circulation)."
      icon={Coins}
      loading={circulation.loading}
      onRefresh={circulation.reload}
    >
      {circulation.error ? (
        <p className="text-xs text-slate-400">{circulation.error}</p>
      ) : (
        <KV record={asRow(circulation.data)} />
      )}
    </PanelShell>
  );
};

const LedgerCard: React.FC = () => {
  const [kind, setKind] = useState('');
  const ledger = useAsync(() => admin.economy.coinLedger({ ...(kind ? { kind } : {}) }), [kind]);

  return (
    <PanelShell
      title="SOP-22: Coins Ledger"
      subtitle="Every coin mint / burn / transfer across the platform."
      icon={ScrollText}
      loading={ledger.loading}
      error={ledger.error}
      onRefresh={ledger.reload}
      actions={
        <Field label="Type" className="w-44">
          <Select
            value={kind}
            onChange={setKind}
            options={[
              { value: '', label: 'All' },
              { value: 'earned', label: 'Earned' },
              { value: 'redeemed', label: 'Redeemed' },
              { value: 'referral', label: 'Referral' },
              { value: 'adjustment', label: 'Adjustment' },
            ]}
          />
        </Field>
      }
    >
      <DataTable
        rows={(ledger.data ?? []) as Row[]}
        empty="No ledger entries."
        columns={[
          {
            header: 'Entry',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'kind', 'type', 'reason')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
              </div>
            ),
          },
          { header: 'User', cell: (r) => <span className="text-slate-600">{str(r, 'userName', 'userId', 'uid')}</span> },
          {
            header: 'Coins',
            cell: (r) => {
              const n = num(r, 'coins', 'amount', 'delta') ?? 0;
              return <span className={`font-bold ${n >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{n >= 0 ? '+' : ''}{n}</span>;
            },
          },
          { header: 'Balance', cell: (r) => <span className="text-slate-500">{num(r, 'balanceAfter', 'balance') ?? '—'}</span> },
          { header: 'When', cell: (r) => <span className="text-slate-500">{str(r, 'createdAt', 'at')}</span> },
        ]}
      />
    </PanelShell>
  );
};

const AdjustCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const [uid, setUid] = useState('');
  const [coins, setCoins] = useState('');
  const [why, setWhy] = useState('');

  return (
    <PanelShell
      title="SOP-22: Manual Coin Adjustment"
      subtitle="Mint or claw back coins for a user — destructive, requires MPIN step-up."
      icon={Coins}
    >
      <div className="flex flex-wrap items-end gap-2 max-w-3xl">
        <Field label="User ID" className="flex-1 min-w-44">
          <TextInput value={uid} onChange={setUid} placeholder="usr_…" />
        </Field>
        <Field label="Coins (+/−)" className="w-32">
          <TextInput type="number" value={coins} onChange={setCoins} placeholder="-250" />
        </Field>
        <Field label="Adjustment kind" className="w-40">
          <Select
            value={why}
            onChange={setWhy}
            options={[
              { value: '', label: 'Select…' },
              { value: 'correction', label: 'Ledger correction' },
              { value: 'goodwill', label: 'Goodwill grant' },
              { value: 'fraud_reversal', label: 'Fraud reversal' },
              { value: 'promo', label: 'Promo credit' },
            ]}
          />
        </Field>
        <Btn
          tone="warn"
          disabled={!uid.trim() || !coins || !why}
          onClick={() =>
            request({
              title: `Adjust ${coins} coins for ${uid.trim()}`,
              confirmLabel: 'Apply adjustment',
              requireMpin: true,
              tone: 'warn',
              action: (reason) =>
                admin.economy.adjustCoins({ userId: uid.trim(), coins: Number(coins), kind: why, reason }, reason),
              onDone: () => {
                setUid('');
                setCoins('');
                setWhy('');
              },
            })
          }
        >
          Apply adjustment
        </Btn>
      </div>
      {modal}
    </PanelShell>
  );
};

const RewardsCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('');

  return (
    <PanelShell
      title="SOP-22: Reward Catalogue"
      subtitle="Redeemable rewards farmers can unlock with coins."
      icon={Gift}
      actions={
        <div className="flex items-end gap-2">
          <Field label="Reward" className="w-48">
            <TextInput value={title} onChange={setTitle} placeholder="5kg urea voucher" />
          </Field>
          <Field label="Cost (coins)" className="w-28">
            <TextInput type="number" value={cost} onChange={setCost} placeholder="500" />
          </Field>
          <Btn
            tone="primary"
            disabled={!title.trim() || !cost}
            onClick={() =>
              request({
                title: `Create reward ${title.trim()}`,
                confirmLabel: 'Create',
                action: (reason) => admin.economy.createReward({ title: title.trim(), cost: Number(cost) }, reason),
                onDone: () => {
                  setTitle('');
                  setCost('');
                },
              })
            }
          >
            Add reward
          </Btn>
        </div>
      }
    >
      <p className="text-xs text-slate-400">New rewards are appended via POST /admin/gamification/rewards.</p>
      {modal}
    </PanelShell>
  );
};

const FraudCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fraud = useAsync(() => admin.economy.referralFraud(), []);
  const audit = useAsync(() => admin.economy.referralsAudit(), []);
  const fraudRows = (fraud.data ?? []) as Row[];
  const selected = selectedId ? fraudRows.find((r) => idOf(r) === selectedId) ?? null : null;

  return (
    <>
      <PanelShell
        title="SOP-22: Referral Fraud Screen"
        subtitle="Referral patterns flagged as self-referral / device farms / velocity abuse."
        icon={Flag}
        loading={fraud.loading}
        error={fraud.error}
        onRefresh={fraud.reload}
      >
        <DataTable
          rows={fraudRows}
          empty="No referral fraud flagged."
          columns={[
            {
              header: 'Flag',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'reason', 'flag', 'pattern', 'type')}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
                </div>
              ),
            },
            { header: 'User', cell: (r) => <span className="text-slate-600">{str(r, 'userName', 'userId', 'uid')}</span> },
            { header: 'Referrals', cell: (r) => <span>{num(r, 'referralCount', 'count') ?? '—'}</span> },
            { header: 'Coins at risk', cell: (r) => <span className="font-bold text-rose-600">{num(r, 'coinsAtRisk', 'coins') ?? '—'}</span> },
            {
              header: 'Actions',
              className: 'text-right',
              cell: (r) => (
                <div className="flex justify-end gap-1.5">
                  <Btn onClick={() => setSelectedId(idOf(r))}>Detail</Btn>
                  <Btn
                    tone="danger"
                    onClick={() => {
                      const ratingId = str(r, 'ratingId');
                      if (ratingId && ratingId !== '—') {
                        request({
                          title: `Delete rating ${ratingId}`,
                          confirmLabel: 'Delete rating',
                          requireMpin: true,
                          tone: 'danger',
                          action: (reason) => admin.economy.deleteRating(ratingId, reason),
                          onDone: fraud.reload,
                        });
                      } else {
                        request({
                          title: `Reverse fraudulent coins — ${str(r, 'userId', 'uid')}`,
                          confirmLabel: 'Reverse coins',
                          requireMpin: true,
                          tone: 'danger',
                          action: (reason) =>
                            admin.economy.adjustCoins(
                              { userId: str(r, 'userId', 'uid'), coins: -(num(r, 'coinsAtRisk', 'coins') ?? 0), kind: 'fraud_reversal', reason },
                              reason
                            ),
                          onDone: fraud.reload,
                        });
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Reverse
                  </Btn>
                </div>
              ),
            },
          ]}
        />
      </PanelShell>

      {selected && (
        <PanelShell
          title={`Fraud case ${idOf(selected)}`}
          subtitle="Flag detail."
          icon={Flag}
          actions={<Btn onClick={() => setSelectedId(null)}>Close</Btn>}
        >
          <KV record={selected} />
        </PanelShell>
      )}

      <PanelShell
        title="SOP-22: Referrals Audit Trail"
        subtitle="Immutable referral event log."
        icon={ScrollText}
        loading={audit.loading}
        error={audit.error}
        onRefresh={audit.reload}
      >
        <DataTable
          rows={(audit.data ?? []) as Row[]}
          empty="No referral events."
          columns={[
            { header: 'When', cell: (r) => <span className="text-slate-500">{str(r, 'createdAt', 'at')}</span> },
            { header: 'Referrer', cell: (r) => <span className="text-slate-600">{str(r, 'referrer', 'referrerId')}</span> },
            { header: 'Referred', cell: (r) => <span className="text-slate-600">{str(r, 'referred', 'referredId', 'newUser')}</span> },
            { header: 'Coins', cell: (r) => <span>{num(r, 'coins', 'reward') ?? '—'}</span> },
            { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
          ]}
        />
      </PanelShell>
      {modal}
    </>
  );
};

const ReferralConfigCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const cfgRes = useAsync(() => admin.economy.referralConfig().catch(() => null), []);
  const cfg = asRow(cfgRes.data);

  const [referrer, setReferrer] = useState('');
  const [referee, setReferee] = useState('');
  const [maxPerMonth, setMaxPerMonth] = useState('');
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [minKycTier, setMinKycTier] = useState('');
  const dirty = referrer !== '' || referee !== '' || maxPerMonth !== '' || enabled !== null || minKycTier !== '';

  const save = async (reason: string) => {
    await admin.economy.updateReferralConfig(
      {
        ...(referrer !== '' ? { referrerRewardCoins: Number(referrer) } : {}),
        ...(referee !== '' ? { refereeRewardCoins: Number(referee) } : {}),
        ...(maxPerMonth !== '' ? { maxReferralsPerMonth: Number(maxPerMonth) } : {}),
        ...(enabled !== null ? { enabled } : {}),
        ...(minKycTier !== '' ? { minKycTier: Number(minKycTier) } : {}),
      },
      reason
    );
    setReferrer('');
    setReferee('');
    setMaxPerMonth('');
    setEnabled(null);
    setMinKycTier('');
    cfgRes.reload();
  };

  return (
    <PanelShell
      title="SOP-22: Referral Program Config"
      subtitle="Reward coins, monthly caps and the KYC gate applied to every referral attribution (GET/PUT /admin/platform-config/referrals)."
      icon={Handshake}
      loading={cfgRes.loading}
      onRefresh={cfgRes.reload}
      actions={
        dirty ? (
          <div className="flex gap-2">
            <Btn
              onClick={() => {
                setReferrer('');
                setReferee('');
                setMaxPerMonth('');
                setEnabled(null);
                setMinKycTier('');
              }}
            >
              Cancel
            </Btn>
            <Btn
              tone="primary"
              onClick={() =>
                request({
                  title: 'Update referral program config',
                  defaultReason: 'Referral economics tuning from SOP-22 desk',
                  confirmLabel: 'Save referral config',
                  action: save,
                })
              }
            >
              Save (audited)
            </Btn>
          </div>
        ) : undefined
      }
    >
      {cfgRes.error && <Banner kind="error">{cfgRes.error}</Banner>}
      {cfg && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={`Referrer reward (coins) — current ${num(cfg, 'referrerRewardCoins') ?? '—'}`} className="w-52">
              <TextInput type="number" inputMode="numeric" value={referrer} onChange={setReferrer} placeholder={String(num(cfg, 'referrerRewardCoins') ?? 100)} />
            </Field>
            <Field label={`Referee reward (coins) — current ${num(cfg, 'refereeRewardCoins') ?? '—'}`} className="w-52">
              <TextInput type="number" inputMode="numeric" value={referee} onChange={setReferee} placeholder={String(num(cfg, 'refereeRewardCoins') ?? 50)} />
            </Field>
            <Field label={`Max referrals / month — current ${num(cfg, 'maxReferralsPerMonth') ?? '—'}`} className="w-52">
              <TextInput type="number" inputMode="numeric" value={maxPerMonth} onChange={setMaxPerMonth} placeholder={String(num(cfg, 'maxReferralsPerMonth') ?? 20)} />
            </Field>
            <Field label={`Enabled — currently ${String(cfg.enabled ?? true)}`} className="w-44">
              <Select
                value={enabled === null ? '' : String(enabled)}
                onChange={(v) => setEnabled(v === '' ? null : v === 'true')}
                options={[
                  { value: '', label: 'Keep current' },
                  { value: 'true', label: 'Enabled' },
                  { value: 'false', label: 'Disabled' },
                ]}
              />
            </Field>
            <Field label={`Min KYC tier — current ${num(cfg, 'minKycTier') ?? '—'}`} className="w-44">
              <TextInput type="number" inputMode="numeric" value={minKycTier} onChange={setMinKycTier} placeholder={String(num(cfg, 'minKycTier') ?? 0)} />
            </Field>
          </div>
          <p className="text-[11px] text-slate-400">
            Last updated {str(cfg, 'updatedAt')} by {str(cfg, 'updatedBy')}. Changes apply to new attributions only —
            already-credited coins are never clawed back automatically.
          </p>
        </>
      )}
    </PanelShell>
  );
};
