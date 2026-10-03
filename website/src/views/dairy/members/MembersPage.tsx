import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ToolShell from '../../../components/trade/ToolShell';
import { useEnsureProfile } from '../../../components/trade/useEnsureProfile';
import { listMembers, type DairyMember, type EntityStatus } from '../../../lib/api/dairy';
import { useT } from '../../../lib/i18n';
import EmptyState from '../components/EmptyState';
import StatusChip from '../components/StatusChip';

const STATUS_FILTERS: { value: EntityStatus | 'all'; labelKey: string }[] = [
  { value: 'all', labelKey: 'commonAll' },
  { value: 'active', labelKey: 'dairy_status_active' },
  { value: 'inactive', labelKey: 'dairy_status_inactive' },
];

/** Member farmer book (P3) — search + status filter, row opens detail/edit. */
export default function MembersPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('dairyManager');

  const [members, setMembers] = useState<DairyMember[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<EntityStatus | 'all'>('all');

  const load = useCallback(() => {
    setFailed(false);
    listMembers({ status: 'all', pageSize: 500 })
      .then((res) => setMembers(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (members ?? []).filter((m) => {
      if (status !== 'all' && m.status !== status) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.village.toLowerCase().includes(q) ||
        m.memberCode.toLowerCase().includes(q)
      );
    });
  }, [members, query, status]);

  return (
    <ToolShell toolId="dairyConsole" backTo="/dairy/console">
      <div className="dairy-wrap">
        <div className="dairy-actions" style={{ marginTop: 4 }}>
          <button
            type="button"
            className="av-btn av-btn-primary"
            onClick={() => navigate('/dairy/console/members/new')}
          >
            ＋ {t('dairyMemberNew')}
          </button>
        </div>

        <input
          className="av-input"
          style={{ marginTop: 12 }}
          placeholder={t('dairyMembersSearch')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="dairy-chip-row">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`av-chip${status === f.value ? ' selected' : ''}`}
              onClick={() => setStatus(f.value)}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>

        {members === null && !failed ? <p className="dairy-hint">{t('commonLoading')}</p> : null}

        {failed ? (
          <EmptyState
            icon="📡"
            titleKey="dairyLoadFailed"
            action={
              <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                ↻ {t('retry')}
              </button>
            }
          />
        ) : null}

        {members !== null && visible.length === 0 ? (
          <EmptyState
            icon="👨‍🌾"
            titleKey="dairyMembersEmpty"
            bodyKey="dairyMembersEmptyBody"
            action={
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={() => navigate('/dairy/console/members/new')}
              >
                ＋ {t('dairyMemberNew')}
              </button>
            }
          />
        ) : null}

        <div className="dairy-list">
          {visible.map((member) => (
            <button
              key={member.id}
              type="button"
              className="dairy-card"
              onClick={() => navigate(`/dairy/console/members/${member.id}`)}
            >
              <span className="dairy-card-row">
                <span className="dairy-card-title">{member.name}</span>
                <StatusChip status={member.status} />
              </span>
              <span className="dairy-card-sub">
                {member.memberCode}
                {member.village ? ` · ${member.village}` : ''}
                {member.deduction > 0 ? ` · ${t('dairyDeduction')} ${member.deduction}` : ''}
              </span>
            </button>
          ))}
        </div>
      </div>
    </ToolShell>
  );
}
