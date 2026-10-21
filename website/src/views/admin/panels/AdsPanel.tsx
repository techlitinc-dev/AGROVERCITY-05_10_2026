import React, { useState } from 'react';
import { Megaphone, CheckCircle2, XCircle, BarChart3, IndianRupee, Eye, X } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin, apiErrorMessage } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  Btn,
  Field,
  TextInput,
  Select,
  Banner,
  idOf,
  str,
  num,
  money,
  useAsync,
  useReasonModal,
  asRow,
  type Row,
} from './shared';

/**
 * Ads & Campaign Oversight — admin surface for the self-serve ads product.
 *
 * Campaign list + approval decisions (POST /admin/ads/{id}/approve|reject),
 * per-campaign analytics (GET /admin/ads/{id}/analytics), and the platform
 * pricing floor (GET/PUT /admin/platform-config/ads-pricing).
 */

const AD_STATUSES = ['pending_approval', 'active', 'paused', 'completed', 'draft'];

export const AdsPanel: React.FC = () => {
  const [status, setStatus] = useState('pending_approval');
  const { request, modal } = useReasonModal();
  const campaigns = useAsync(
    () => admin.ads.campaigns({ ...(status ? { status } : {}) }),
    [status]
  );

  const rows = (campaigns.data ?? []) as Row[];

  return (
    <>
      <PanelShell
        title="Ad Campaigns"
        subtitle="Self-serve advertiser campaigns. Approving starts serving immediately; rejecting pauses the campaign with the recorded reason."
        icon={Megaphone}
        loading={campaigns.loading}
        error={campaigns.error}
        onRefresh={campaigns.reload}
        actions={
          <Field label="Status filter" className="w-48">
            <Select
              value={status}
              onChange={setStatus}
              options={[{ value: '', label: 'All' }, ...AD_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))]}
            />
          </Field>
        }
      >
        <DataTable
          rows={rows}
          empty="No campaigns in this bucket."
          columns={[
            {
              header: 'Campaign',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'title', 'name', 'headline')}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
                </div>
              ),
            },
            {
              header: 'Advertiser',
              cell: (r) => (
                <div>
                  <p className="font-semibold text-slate-700">{str(r, 'advertiserName', 'advertiserId')}</p>
                  <p className="text-[10px] text-slate-400">{str(r, 'advertiserPersona')}</p>
                </div>
              ),
            },
            {
              header: 'Budget / Spent',
              cell: (r) => (
                <div>
                  <p className="font-bold">{money(num(r, 'budgetRupees', 'budget'))}</p>
                  <p className="text-[10px] text-slate-400">spent {money(num(r, 'spentRupees', 'spent'))}</p>
                </div>
              ),
            },
            {
              header: 'Reach',
              cell: (r) => (
                <span className="text-slate-600">
                  {num(r, 'impressions') ?? 0} impr • {num(r, 'clicks') ?? 0} clicks
                </span>
              ),
            },
            { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status')} /> },
            {
              header: 'Actions',
              className: 'text-right',
              cell: (r) => {
                const s = str(r, 'status');
                const decidable = ['pending_approval', 'paused', 'draft'].includes(s);
                return (
                  <div className="flex justify-end gap-1.5">
                    <CampaignAnalyticsButton adId={idOf(r)} title={str(r, 'title', 'name')} />
                    <Btn
                      tone="primary"
                      disabled={!decidable}
                      onClick={() =>
                        request({
                          title: `Approve campaign ${idOf(r)}`,
                          description: `“${str(r, 'title', 'name')}” starts serving on the public surfaces.`,
                          defaultReason: 'Creative + landing page reviewed',
                          confirmLabel: 'Approve & activate',
                          action: (reason) => admin.ads.approve(idOf(r), reason),
                          onDone: campaigns.reload,
                        })
                      }
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </Btn>
                    <Btn
                      tone="danger"
                      disabled={!decidable}
                      onClick={() =>
                        request({
                          title: `Reject campaign ${idOf(r)}`,
                          description: 'The campaign is paused and the reason is recorded on it (min 3 chars).',
                          confirmLabel: 'Reject campaign',
                          tone: 'danger',
                          action: (reason) => admin.ads.reject(idOf(r), { reason }, reason),
                          onDone: campaigns.reload,
                        })
                      }
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </Btn>
                  </div>
                );
              },
            },
          ]}
        />
      </PanelShell>

      <AdsPricingCard />
      {modal}
    </>
  );
};

const CampaignAnalyticsButton: React.FC<{ adId: string; title: string }> = ({ adId, title }) => {
  const [open, setOpen] = useState(false);
  const analytics = useAsync(() => (open ? admin.ads.analytics(adId) : Promise.resolve(null)), [open, adId]);
  const a = asRow(analytics.data);

  return (
    <>
      <Btn onClick={() => setOpen(true)}>
        <BarChart3 className="w-3.5 h-3.5" /> Analytics
      </Btn>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" role="dialog" aria-modal>
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-lg p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">Campaign analytics</h4>
                <p className="text-xs text-slate-500 mt-1">{title} ({adId})</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            {analytics.loading ? (
              <p className="text-xs text-slate-400">Loading…</p>
            ) : analytics.error ? (
              <Banner kind="error">{analytics.error}</Banner>
            ) : (
              a && (
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Impressions" value={String(num(a, 'impressions') ?? 0)} />
                  <Stat label="Clicks" value={String(num(a, 'clicks') ?? 0)} />
                  <Stat label="CTR" value={`${num(a, 'ctrPercent') ?? 0}%`} />
                  <Stat label="Status" value={str(a, 'status')} />
                  <Stat label="Spent" value={money(num(a, 'spentRupees'))} />
                  <Stat label="Budget" value={money(num(a, 'budgetRupees'))} />
                  <Stat label="Remaining" value={money(num(a, 'remainingBudgetRupees'))} />
                </div>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) =>
  !value ? null : (
    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-extrabold text-slate-900">{value}</p>
    </div>
  );

const AdsPricingCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const pricing = useAsync(() => admin.ads.pricing().catch(() => null), []);
  const cfg = asRow(pricing.data);

  const [cpc, setCpc] = useState('');
  const [cpm, setCpm] = useState('');
  const [minBudget, setMinBudget] = useState('');
  const dirty = cpc !== '' || cpm !== '' || minBudget !== '';

  const save = async (reason: string) => {
    await admin.ads.updatePricing(
      {
        ...(cpc !== '' ? { cpcPaise: Number(cpc) } : {}),
        ...(cpm !== '' ? { cpmPaise: Number(cpm) } : {}),
        ...(minBudget !== '' ? { minBudgetPaise: Number(minBudget) } : {}),
      },
      reason
    );
    setCpc('');
    setCpm('');
    setMinBudget('');
    pricing.reload();
  };

  const rupees = (paise: number | null): string =>
    paise === null ? '—' : `₹${(paise / 100).toLocaleString('en-IN')}`;

  return (
    <PanelShell
      title="Ads Pricing Floor"
      subtitle="CPC / CPM rates and the minimum campaign budget (GET/PUT /admin/platform-config/ads-pricing). Values below are in paise — shown with the ₹ equivalent."
      icon={IndianRupee}
      loading={pricing.loading}
      onRefresh={pricing.reload}
      actions={
        dirty ? (
          <div className="flex gap-2">
            <Btn onClick={() => { setCpc(''); setCpm(''); setMinBudget(''); }}>Cancel</Btn>
            <Btn
              tone="primary"
              onClick={() =>
                request({
                  title: 'Update ads pricing',
                  defaultReason: 'Ads pricing floor update',
                  confirmLabel: 'Save pricing',
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
      {pricing.error && <Banner kind="error">{pricing.error}</Banner>}
      {cfg && (
        <div className="flex flex-wrap items-end gap-3">
          <Field label={`CPC (paise) — current ${num(cfg, 'cpcPaise') ?? '—'} (${rupees(num(cfg, 'cpcPaise'))})`} className="w-52">
            <TextInput type="number" inputMode="numeric" value={cpc} onChange={setCpc} placeholder={String(num(cfg, 'cpcPaise') ?? 200)} />
          </Field>
          <Field label={`CPM (paise) — current ${num(cfg, 'cpmPaise') ?? '—'} (${rupees(num(cfg, 'cpmPaise'))})`} className="w-52">
            <TextInput type="number" inputMode="numeric" value={cpm} onChange={setCpm} placeholder={String(num(cfg, 'cpmPaise') ?? 50000)} />
          </Field>
          <Field label={`Min budget (paise) — current ${num(cfg, 'minBudgetPaise') ?? '—'} (${rupees(num(cfg, 'minBudgetPaise'))})`} className="w-56">
            <TextInput type="number" inputMode="numeric" value={minBudget} onChange={setMinBudget} placeholder={String(num(cfg, 'minBudgetPaise') ?? 50000)} />
          </Field>
          <p className="text-[11px] text-slate-400 pb-2.5 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> Targeting options: {str(cfg, 'targetingOptions')}
          </p>
        </div>
      )}
    </PanelShell>
  );
};
