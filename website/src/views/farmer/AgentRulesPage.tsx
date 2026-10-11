import { useCallback, useEffect, useState } from 'react';
import ConfirmSheet from '../../components/trade/ConfirmSheet';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  createRule,
  deleteRule,
  listRules,
  parseRule,
  pauseRule,
  type AgentRule,
  type ParsedRule,
} from '../../lib/api/agentRules';
import { isApiError } from '../../lib/api/client';
import { useT } from '../../lib/i18n';
import { useOnboardingStore } from '../../stores/onboarding';
import { rupeesFromPaisa } from '../bank/money';
import '../../theme/trade.css';

/**
 * M29 farmer standing-agent rules (phase-08 WS-01, tasks 1.35/1.36) — the
 * management page behind the `agentRules` tool. Rules list with active/paused
 * state + pause/delete controls, an audit-history section (fire → outcome),
 * and a guided creation form: vernacular text is parsed for review and
 * persisted only after an explicit inline confirmation. No blocking browser
 * dialogs anywhere.
 * A fire never auto-executes — it surfaces a one-tap confirm task (DashboardHome).
 */

const MODULES = ['offers', 'mandi_prices', 'rate_postings'] as const;

function langPick(lang: string, bilingual: { en?: string; hi?: string } | undefined): string {
  if (!bilingual) return '';
  return lang === 'hi' ? bilingual.hi || bilingual.en || '' : bilingual.en || bilingual.hi || '';
}

/** Condition value — money-shaped fields render in ₹, others verbatim. */
function conditionText(rule: Pick<AgentRule, 'condition'>): string {
  const { field, op, value } = rule.condition;
  const shown =
    typeof value === 'number' && field.includes('paisa') ? rupeesFromPaisa(value) : String(value);
  return `${field} ${op} ${shown}`;
}

export default function AgentRulesPage({ embedded }: { embedded?: boolean }) {
  const t = useT();
  const lang = useOnboardingStore((s) => s.language);

  const [rules, setRules] = useState<AgentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Guided creation form (task 1.36).
  const [text, setText] = useState('');
  const [module, setModule] = useState<string>('offers');
  const [parsing, setParsing] = useState(false);
  const [review, setReview] = useState<ParsedRule | null>(null);
  const [creating, setCreating] = useState(false);

  // Delete flow — inline sheet, never a blocking browser dialog.
  const [deleting, setDeleting] = useState<AgentRule | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const page = await listRules();
      setRules(page.items);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runParse = async () => {
    if (!text.trim() || parsing) return;
    setParsing(true);
    try {
      setReview(await parseRule(text.trim(), module));
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setParsing(false);
    }
  };

  /** createRule runs only after the user explicitly confirms the review card. */
  const confirmCreate = async () => {
    if (!review || creating) return;
    setCreating(true);
    try {
      await createRule({
        condition: review.condition,
        action: review.action,
        max_value_paisa: review.max_value_paisa,
        module: review.module,
        summary: review.summary,
        text: text.trim(),
      });
      toast(t('agentRules.createdToast'));
      setText('');
      setReview(null);
      await load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setCreating(false);
    }
  };

  const togglePause = async (rule: AgentRule) => {
    if (busyId) return;
    setBusyId(rule.ruleId);
    try {
      await pauseRule(rule.ruleId);
      toast(t(rule.active ? 'agentRules.pausedToast' : 'agentRules.resumedToast'));
      await load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteRule(deleting.ruleId);
      toast(t('agentRules.deletedToast'));
      setDeleting(null);
      await load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setDeleteBusy(false);
    }
  };

  const content = (
    <div style={{ padding: '1rem', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>{t('agentRules.title')}</h2>
      <p style={{ margin: '0.25rem 0 0.75rem', color: '#666', fontSize: '0.9rem' }}>
        {t('agentRules.sub')}
      </p>

      {/* ---- Guided creation form (task 1.36) ---- */}
      <div className="trade-card" style={{ padding: '1rem', marginBottom: '0.9rem' }}>
        <span className="trade-card-title">{t('agentRules.createTitle')}</span>
        <div className="av-field" style={{ marginTop: 8 }}>
          <label className="av-label" htmlFor="rule-module">
            {t('agentRules.moduleLabel')}
          </label>
          <select
            id="rule-module"
            className="av-input"
            value={module}
            onChange={(e) => {
              setModule(e.target.value);
              setReview(null);
            }}
          >
            {MODULES.map((m) => (
              <option key={m} value={m}>
                {t(`agentRules.module_${m}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="av-field">
          <label className="av-label" htmlFor="rule-text">
            {t('agentRules.textLabel')}
          </label>
          <textarea
            id="rule-text"
            className="av-input"
            rows={2}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setReview(null);
            }}
          />
        </div>
        <p className="trade-hint" style={{ margin: '4px 0' }}>
          💬 {t('agentRules.examplesTitle')}
        </p>
        <div className="trade-actions-row" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="av-btn av-btn-ghost"
            style={{ padding: '4px 10px', fontSize: 12 }}
            onClick={() => {
              setText(t('agentRules.exampleEn'));
              setReview(null);
            }}
          >
            {t('agentRules.exampleEn')}
          </button>
          <button
            type="button"
            className="av-btn av-btn-ghost"
            style={{ padding: '4px 10px', fontSize: 12 }}
            onClick={() => {
              setText(t('agentRules.exampleHi'));
              setReview(null);
            }}
          >
            {t('agentRules.exampleHi')}
          </button>
        </div>
        <div className="trade-actions-row">
          <button
            type="button"
            className="av-btn av-btn-primary"
            onClick={() => void runParse()}
            disabled={parsing || !text.trim() || !!review}
          >
            {parsing ? <span className="av-spinner" aria-hidden /> : t('agentRules.parse')}
          </button>
        </div>

        {review ? (
          <div
            role="group"
            aria-label={t('agentRules.reviewTitle')}
            style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#F0FDF4', borderRadius: 8, border: '1px solid #BBF7D0' }}
          >
            <span className="trade-card-title">{t('agentRules.reviewTitle')}</span>
            <p className="trade-card-sub" style={{ margin: '6px 0' }}>
              {langPick(lang, review.summary)}
            </p>
            <p className="trade-card-sub" style={{ margin: '6px 0' }}>
              {t('agentRules.conditionLabel')}: {conditionText(review)}
              {' · '}
              {t('agentRules.actionLabel')}: {review.action}
              {review.max_value_paisa > 0
                ? ` · ${t('agentRules.maxValueLabel')}: ${rupeesFromPaisa(review.max_value_paisa)}`
                : ''}
            </p>
            <div className="trade-actions-row" style={{ marginTop: 6 }}>
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={() => void confirmCreate()}
                disabled={creating}
              >
                {creating ? <span className="av-spinner" aria-hidden /> : t('agentRules.confirm')}
              </button>
              <button
                type="button"
                className="av-btn av-btn-ghost"
                onClick={() => setReview(null)}
                disabled={creating}
              >
                {t('agentRules.edit')}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* ---- Rules list (task 1.35) ---- */}
      {loading ? (
        <p className="trade-hint">{t('commonLoading')}</p>
      ) : failed ? (
        <EmptyState
          icon="📡"
          titleKey="tradeLoadFailed"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={() => void load()}>
              ↻ {t('retry')}
            </button>
          }
        />
      ) : rules.length === 0 ? (
        <EmptyState icon="🤖" titleKey="agentRules.empty" bodyKey="agentRules.emptyBody" />
      ) : (
        <div className="trade-list">
          {rules.map((rule) => (
            <div className="trade-card" key={rule.ruleId} style={{ padding: '1rem', cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">{langPick(lang, rule.summary) || rule.text || rule.ruleId}</span>
                <span className="women-chip">
                  {t(rule.active ? 'agentRules.active' : 'agentRules.paused')}
                </span>
              </div>
              <span className="trade-card-sub">
                {t(`agentRules.module_${rule.module}`)} · {t('agentRules.conditionLabel')}:{' '}
                {conditionText(rule)}
                {rule.max_value_paisa > 0
                  ? ` · ${t('agentRules.maxValueLabel')}: ${rupeesFromPaisa(rule.max_value_paisa)}`
                  : ''}
              </span>
              <div className="trade-actions-row">
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  disabled={busyId === rule.ruleId}
                  onClick={() => void togglePause(rule)}
                >
                  {t(rule.active ? 'agentRules.pause' : 'agentRules.resume')}
                </button>
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  disabled={busyId === rule.ruleId}
                  onClick={() => setDeleting(rule)}
                >
                  {t('agentRules.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- Audit history (task 1.35): fire → confirm/dismiss → outcome ---- */}
      {!loading && !failed && rules.length > 0 ? (
        <div style={{ marginTop: '1rem' }}>
          <p className="trade-section-title">{t('agentRules.auditTitle')}</p>
          <div className="trade-invoice-box" style={{ marginTop: 0 }}>
            {rules.map((rule) => (
              <div key={`audit-${rule.ruleId}`} className="trade-invoice-row" style={{ display: 'block', padding: '8px 10px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {langPick(lang, rule.summary) || rule.ruleId}
                </span>
                <span className="trade-card-sub" style={{ display: 'block' }}>
                  {t('agentRules.auditCreated')}: {rule.createdAt}
                  {' · '}
                  {rule.lastFiredAt
                    ? `${t('agentRules.auditLastFired')}: ${rule.lastFiredAt}`
                    : t('agentRules.auditNeverFired')}
                  {' · '}
                  {t(rule.active ? 'agentRules.active' : 'agentRules.paused')}
                </span>
              </div>
            ))}
          </div>
          <p className="trade-hint" style={{ marginTop: 6 }}>{t('agentRules.auditHint')}</p>
        </div>
      ) : null}

      <ConfirmSheet
        open={deleting !== null}
        title={t('agentRules.delete')}
        body={t('agentRules.deleteConfirm')}
        confirmLabel={t('agentRules.delete')}
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </div>
  );

  if (embedded) return content;
  return <ToolShell toolId="agentRules">{content}</ToolShell>;
}
