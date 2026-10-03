import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ToolShell from '../../../components/trade/ToolShell';
import { useEnsureProfile } from '../../../components/trade/useEnsureProfile';
import { toast } from '../../../components/toast';
import { isApiError } from '../../../lib/api/client';
import { fmtINR, fmtL, getMemberStatement, type MemberStatement } from '../../../lib/api/dairy';
import { csvDate, downloadCsv } from '../../../lib/csv';
import { useT } from '../../../lib/i18n';
import EmptyState from '../components/EmptyState';
import SlipCard, { fmtDate } from '../components/SlipCard';
import StatusChip from '../components/StatusChip';

/** Member ledger — header card, date-range filter, collections + payments + totals. */
export default function MemberStatementPage() {
  const t = useT();
  const navigate = useNavigate();
  const { memberId } = useParams<{ memberId: string }>();
  useEnsureProfile('dairyManager');

  const [statement, setStatement] = useState<MemberStatement | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [failed, setFailed] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(() => {
    if (!memberId) return;
    setFailed(false);
    getMemberStatement(memberId, applied.from || undefined, applied.to || undefined)
      .then(setStatement)
      .catch((e) => {
        if (isApiError(e) && (e.code === 'MEMBER_NOT_FOUND' || e.status === 404)) {
          setNotFound(true);
        } else {
          setFailed(true);
        }
      });
  }, [memberId, applied]);

  useEffect(load, [load]);

  const member = statement?.member;

  /** P11 — one combined sheet: collection rows + payment rows, sorted by date. */
  const exportCsv = useCallback(() => {
    if (!statement || !member) return;
    const rows = [
      ...statement.collections.map((s) => ({
        date: s.date,
        kind: t('dairyCsvCollection'),
        shift: t(`dairyShift_${s.shift}`),
        liters: s.liters,
        rate: s.ratePerLiter,
        amount: s.totalAmount,
      })),
      ...statement.payments.map((p) => ({
        date: p.createdAt,
        kind: t('dairyCsvPayment'),
        shift: '',
        liters: p.liters,
        rate: '',
        amount: p.netAmount,
      })),
    ]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => [csvDate(r.date), r.shift, r.kind, r.liters, r.rate, r.amount]);
    downloadCsv(
      `member-statement-${member.memberCode}-${applied.from || 'start'}-${applied.to || 'today'}.csv`,
      [t('dairyCsvDate'), t('dairyFormShift'), t('dairyCsvType'), t('dairyFormLiters'), t('dairyCsvRate'), t('dairyCsvAmount')],
      rows
    );
    toast(t('dairyCsvDone'));
  }, [statement, member, applied, t]);

  if (notFound) {
    return (
      <ToolShell toolId="dairyConsole" backTo="/dairy/console/members">
        <EmptyState
          icon="🔍"
          titleKey="dairyMemberNotFound"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={() => navigate('/dairy/console/members')}>
              ← {t('dairyQaMembers')}
            </button>
          }
        />
      </ToolShell>
    );
  }

  return (
    <ToolShell toolId="dairyConsole" backTo="/dairy/console/members">
      <div className="dairy-wrap">
        {!statement && !failed ? <p className="dairy-hint">{t('commonLoading')}</p> : null}

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

        {statement && member ? (
          <>
            <div className="dairy-card" style={{ marginTop: 12 }}>
              <div className="dairy-card-row">
                <span className="dairy-card-title">{member.name}</span>
                <StatusChip status={member.status} />
              </div>
              <span className="dairy-card-sub">
                {t('dairyMemberCode')}: {member.memberCode}
                {member.village ? ` · ${t('dairyVillage')}: ${member.village}` : ''}
              </span>
              <span className="dairy-card-sub">
                {member.bankDetails?.accountNumber
                  ? `${t('dairyMemberAccount')}: ${member.bankDetails.accountNumber} · ${t('dairyMemberIfsc')}: ${member.bankDetails.ifsc || '—'}`
                  : t('commonNotAvailable')}
              </span>
              {member.deduction > 0 ? (
                <span className="dairy-card-sub">
                  {t('dairyDeduction')}: {fmtINR(member.deduction)}
                </span>
              ) : null}
              <div className="dairy-actions-row">
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => navigate(`/dairy/console/members/${member.id}`)}
                >
                  ✏️ {t('commonEdit')}
                </button>
                <button type="button" className="av-btn av-btn-ghost" onClick={exportCsv}>
                  ⬇ {t('dairyCsvExportCsv')}
                </button>
              </div>
            </div>

            <div className="dairy-section">
              <div className="dairy-card-row">
                <LabeledDate label={t('dairyStmtFrom')} value={from} onChange={setFrom} />
                <LabeledDate label={t('dairyStmtTo')} value={to} onChange={setTo} />
              </div>
              <div className="dairy-actions" style={{ marginTop: 4 }}>
                <button
                  type="button"
                  className="av-btn av-btn-plain"
                  onClick={() => setApplied({ from, to })}
                >
                  {t('dairyStmtApply')}
                </button>
              </div>
            </div>

            <div className="dairy-totals">
              <div className="dairy-totals-item">
                <div className="dairy-totals-label">{t('dairyStmtTotalLiters')}</div>
                <div className="dairy-totals-value">{statement.totals.liters.toFixed(2)} L</div>
              </div>
              <div className="dairy-totals-item">
                <div className="dairy-totals-label">{t('dairyStmtTotalAmount')}</div>
                <div className="dairy-totals-value">{fmtINR(statement.totals.amount)}</div>
              </div>
              <div className="dairy-totals-item">
                <div className="dairy-totals-label">{t('dairyStmtTotalPaid')}</div>
                <div className="dairy-totals-value">{fmtINR(statement.totals.paid)}</div>
              </div>
            </div>

            <div className="dairy-section">
              <span className="dairy-section-title">🧾 {t('dairyStmtCollections')}</span>
              {statement.collections.length === 0 ? (
                <EmptyState icon="🧾" titleKey="dairyStmtEmpty" />
              ) : (
                <div className="dairy-list" style={{ marginTop: 0 }}>
                  {statement.collections.map((slip) => (
                    <SlipCard key={slip.id} slip={slip} />
                  ))}
                </div>
              )}
            </div>

            <div className="dairy-section">
              <span className="dairy-section-title">💸 {t('dairyStmtPayments')}</span>
              {statement.payments.length === 0 ? (
                <EmptyState icon="💸" titleKey="dairyStmtEmpty" />
              ) : (
                <div className="dairy-list" style={{ marginTop: 0 }}>
                  {statement.payments.map((entry) => (
                    <div key={entry.id} className="dairy-card">
                      <div className="dairy-card-row">
                        <span className="dairy-card-sub">{fmtDate(entry.createdAt)}</span>
                        <StatusChip status={entry.status} />
                      </div>
                      <div className="dairy-card-row">
                        <span className="dairy-card-sub">
                          {fmtL(entry.liters)} L
                          {entry.payoutRef ? ` · ${t('dairyPayPayoutRef')}: ${entry.payoutRef}` : ''}
                        </span>
                        <span className="dairy-card-amount">{fmtINR(entry.netAmount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </ToolShell>
  );
}

function LabeledDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="av-field" style={{ flex: 1, marginBottom: 0 }}>
      <label className="av-label">{label}</label>
      <input className="av-input" type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
