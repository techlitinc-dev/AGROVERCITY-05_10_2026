import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LeadPipelineChips from '../../components/broker/LeadPipelineChips';
import MaskedPhoneText from '../../components/broker/MaskedPhoneText';
import ConfirmSheet from '../../components/trade/ConfirmSheet';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { dropLead, inr, updateLead, type Lead, type LeadStatus } from '../../lib/api/broker';
import { useT } from '../../lib/i18n';
import { useBrokerStore } from '../../stores/broker';
import LeadFormSheet from './LeadFormSheet';
import '../../theme/trade.css';
import '../../theme/broker.css';

const STATUS_FILTERS: Array<{ value: LeadStatus | 'all'; labelKey: string }> = [
  { value: 'all', labelKey: 'commonAll' },
  { value: 'active', labelKey: 'leadStatus_active' },
  { value: 'contacted', labelKey: 'leadStatus_contacted' },
  { value: 'negotiating', labelKey: 'leadStatus_negotiating' },
  { value: 'converted', labelKey: 'leadStatus_converted' },
  { value: 'dropped', labelKey: 'leadStatus_dropped' },
];

/**
 * Contacts & Leads (`buyers` tool) — the broker's lightweight CRM: pipeline
 * chip filters, name/commodity/location search, per-card status transitions,
 * edit sheet, and "Make deal" which pre-fills the deal form and marks the
 * lead converted on success (plan §2.10).
 */
export default function LeadsPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('broker');

  const leads = useBrokerStore((s) => s.leads);
  const refreshLeads = useBrokerStore((s) => s.refreshLeads);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [dropping, setDropping] = useState<Lead | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    refreshLeads().catch(() => setFailed(true));
  }, [refreshLeads]);

  useEffect(load, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (leads ?? []).filter((lead) => {
      if (filter !== 'all' && lead.status !== filter) return false;
      if (!q) return true;
      return [lead.name, lead.commodity, lead.location]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [leads, filter, query]);

  const changeStatus = async (lead: Lead, status: LeadStatus) => {
    try {
      await updateLead(lead.id, { status });
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    }
  };

  const confirmDrop = async () => {
    if (!dropping || busy) return;
    setBusy(true);
    try {
      await dropLead(dropping.id);
      toast(t('leadsDroppedToast'));
      setDropping(null);
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const makeDeal = (lead: Lead) => {
    const params = new URLSearchParams({ leadId: lead.id });
    if (lead.type === 'farmer') {
      params.set('sellerName', lead.name);
      params.set('sellerPhone', lead.phone);
    } else {
      params.set('buyerName', lead.name);
      params.set('buyerPhone', lead.phone);
    }
    if (lead.commodity) params.set('commodity', lead.commodity);
    if (lead.quantityExpected) params.set('quantityQuintals', String(lead.quantityExpected));
    if (lead.targetRate) params.set('targetRate', String(lead.targetRate));
    navigate(`/dashboard/p/broker/deals/new?${params.toString()}`);
  };

  return (
    <ToolShell toolId="buyers">
      <div className="trade-actions" style={{ marginTop: 4 }}>
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          ＋ {t('leadsNew')}
        </button>
      </div>

      <div className="av-field" style={{ marginTop: 8 }}>
        <input
          className="av-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('leadsSearchPlaceholder')}
          aria-label={t('commonSearch')}
        />
      </div>

      <div className="trade-filter-row">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`av-chip${filter === f.value ? ' selected' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {leads === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {leads !== null && visible.length === 0 ? (
        <EmptyState icon="📇" titleKey="leadsEmpty" bodyKey="leadsEmptyBody" />
      ) : null}

      <div className="trade-list">
        {visible.map((lead) => (
          <div key={lead.id} className="trade-card" style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">
                {lead.type === 'farmer' ? '🌾' : lead.type === 'buyer' ? '🏪' : '⚖️'} {lead.name}
              </span>
              <span className="trade-card-sub">{t(`leadStatus_${lead.status}`)}</span>
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {lead.commodity ? `${lead.commodity} · ` : ''}
                {lead.quantityExpected ? `${lead.quantityExpected} ${t('unitQuintalShort')} · ` : ''}
                {lead.targetRate ? `${inr(lead.targetRate)}${t('perQuintal')} · ` : ''}
                {lead.location ?? ''}
              </span>
              <MaskedPhoneText phone={lead.phone} className="trade-card-sub" />
            </div>
            {lead.notes ? <p className="trade-card-sub">{lead.notes}</p> : null}
            <LeadPipelineChips lead={lead} onChange={(status) => void changeStatus(lead, status)} />
            <div className="trade-actions-row">
              {!['converted', 'dropped'].includes(lead.status) ? (
                <button type="button" className="av-btn av-btn-primary" onClick={() => makeDeal(lead)}>
                  🤝 {t('leadsMakeDeal')}
                </button>
              ) : null}
              <button
                type="button"
                className="av-btn av-btn-ghost"
                onClick={() => {
                  setEditing(lead);
                  setFormOpen(true);
                }}
              >
                {t('commonEdit')}
              </button>
              {lead.status !== 'dropped' ? (
                <button
                  type="button"
                  className="av-btn av-btn-plain"
                  style={{ background: 'var(--av-error)' }}
                  onClick={() => setDropping(lead)}
                >
                  {t('leadsDrop')}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <LeadFormSheet
        lead={editing}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />

      <ConfirmSheet
        open={dropping !== null}
        title={t('leadsDrop')}
        body={t('leadsDropConfirm')}
        confirmLabel={t('leadsDrop')}
        onConfirm={() => void confirmDrop()}
        onClose={() => setDropping(null)}
        busy={busy}
      />
    </ToolShell>
  );
}
