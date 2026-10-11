import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';
import AllToolsSheet from '../../components/dashboard/AllToolsSheet';
import BottomMenuBar from '../../components/dashboard/BottomMenuBar';
import MenuBar from '../../components/dashboard/MenuBar';
import ProfileSwitcherBar from '../../components/dashboard/ProfileSwitcherBar';
import ProfileSwitcherSheet from '../../components/dashboard/ProfileSwitcherSheet';
import { PersonaBanner, PromoBanner, SectionTitle, ToolTile } from '../../components/dashboard/tiles';
import AgroMitraCard from '../../components/scene/AgroMitraCard';
import AgroAiBar from '../../components/scene/AgroAiBar';
import SceneScaffold from '../../components/scene/SceneScaffold';
import AiBadge from '../../components/ai/AiBadge';
import ConfidenceGate from '../../components/ai/ConfidenceGate';
import KisanMitraSheet from '../../components/chatbot/KisanMitraSheet';
import RatePrompt from '../../components/RatePrompt';
import BreakingBanner from '../../components/news/BreakingBanner';
import InsightsPanel from '../../components/intelligence/InsightsPanel';
import SellerHomeBoard from '../../components/dashboard/SellerHomeBoard';
import { toast } from '../../components/toast';
import { getIntelligence, type IntelligenceResponse } from '../../lib/api/intelligence';
import { acceptOffer } from '../../lib/api/offers';
import { getToday, markDismiss, markDone, summary as fetchSummary, type Task, type TaskSummary } from '../../lib/api/tasks';
import { canAccess, personaHomeConfig } from '../../lib/dashboard';
import { ZERO } from '../../lib/numDefaults';
import { PERSONAS, personaByType, personaLabel } from '../../lib/personas';
import { isKnownRoute } from '../../lib/routes';
import { pendingCount, subscribe } from '../../lib/offline/outbox';
import { track } from '../../lib/analytics';
import { useT } from '../../lib/i18n';
import { useOnboardingStore } from '../../stores/onboarding';
import { useDashboardStore } from '../../stores/dashboard';
import { useSessionStore } from '../../stores/session';
import { TransportHomeBoard } from '../transport';
import { BrokerHomeBoard } from '../broker';
import { BuyerHomeBoard } from '../directbuyer';
import LandlordHomeBoard from '../landlord/LandlordHomeBoard';
import EquipmentOwnerHomeBoard from '../equipment/EquipmentOwnerHomeBoard';
import { EMarketHome } from '../customer';
import InstructorHome from '../instructor/InstructorHome';
import DairyManagerHomeBoard from '../dairyMarket/DairyManagerHomeBoard';
import '../../theme/dashboard.css';

function greetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'dashGoodMorning';
  if (hour < 17) return 'dashGoodAfternoon';
  return 'dashGoodEvening';
}

/** Paisa → ₹ string (client-side formatting only; never a fallback number). */
function formatPaisa(paisa: number): string {
  return (paisa / 100).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
}

const MODULE_ORDER = [
  'trade',
  'transport',
  'equipment',
  'land',
  'dairy',
  'courses',
  'broker',
  'contracts',
  'purchases',
] as const;

const MODULE_ICON: Record<string, string> = {
  trade: '🌾',
  transport: '🚚',
  equipment: '🚜',
  land: '🏞️',
  dairy: '🥛',
  courses: '🎓',
  broker: '🤝',
  contracts: '📜',
  purchases: '🧾',
};

/** Module → ACL toolId used to decide whether the persona gets a grid card. */
const MODULE_ACL_TOOL: Record<string, string> = {
  trade: 'myOffers',
  transport: 'vehicleCalendar',
  equipment: 'machineManage',
  land: 'landlordLeases',
  dairy: 'dairyConsole',
  courses: 'courses',
  broker: 'deals',
  contracts: 'contracts',
  purchases: 'purchases',
};

/** M29 rule-fire tasks (phase-08 WS-01, task 1.37) — kind emitted by the
 *  agent_rules service; the confirm action calls the EXISTING offer-accept
 *  endpoint, dismiss records the dismissal. Nothing else auto-executes. */
const RULE_FIRE_KIND = 'rule_fire_confirm';
const OFFER_ACCEPT_RE = /^\/v1\/offers\/([^/]+)\/accept$/;

function ruleFireOfferId(endpoint: string | undefined): string | null {
  if (!endpoint) return null;
  const match = endpoint.match(OFFER_ACCEPT_RE);
  return match ? match[1] : null;
}

function mergedModuleCounts(summaryData: TaskSummary | null, personaType: string, aggregate: boolean): Record<string, number> {
  if (!summaryData) return {};
  const personas = summaryData.personas ?? {};
  const keys = aggregate ? Object.keys(personas) : [personaType];
  const counts: Record<string, number> = {};
  for (const key of keys) {
    const bucket = personas[key];
    if (!bucket) continue;
    for (const [module, count] of Object.entries(bucket.moduleCounts ?? {})) {
      const current = counts[module];
      counts[module] = current === undefined ? count : current + count;
    }
  }
  return counts;
}

function decrementSummary(prev: TaskSummary | null, persona: string, module: string): TaskSummary | null {
  if (!prev) return prev;
  const bucket = prev.personas?.[persona];
  if (!bucket) return prev;
  const count = bucket.moduleCounts?.[module];
  if (count === undefined) return prev;
  return {
    personas: {
      ...prev.personas,
      [persona]: {
        ...bucket,
        moduleCounts: { ...bucket.moduleCounts, [module]: Math.max(0, count - 1) },
        topUrgent: bucket.topUrgent.filter((task) => !(task.module === module)),
      },
    },
  };
}

/**
 * Dashboard home — the Action Center (phase-01 WS-02). Sections: hero
 * next-best-action mount point, urgent strip, today's tasks, module summary
 * grid, money snapshot, persona/aggregate switcher; persona home boards stay
 * mounted below (refactored in phases 02–04).
 */
export default function DashboardHome() {
  const t = useT();
  const navigate = useNavigate();
  const lang = useOnboardingStore((s) => s.language);
  const user = useSessionStore((s) => s.user);
  const syncFromUser = useDashboardStore((s) => s.syncFromUser);
  const activeProfile = useDashboardStore((s) => s.activeProfile);
  const linkedProfiles = useDashboardStore((s) => s.linkedProfiles);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mitraOpen, setMitraOpen] = useState(false);
  const [pendingSync, setPendingSync] = useState(() => pendingCount());
  const shownTasksRef = useRef<Set<string>>(new Set());

  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [summaryData, setSummaryData] = useState<TaskSummary | null>(null);
  const [intel, setIntel] = useState<IntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [aggregate, setAggregate] = useState(false);
  const [justDone, setJustDone] = useState<string | null>(null);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  /** Verdant Glass §9.4 — persona-switch cinematic runs after the UI responds. */
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    syncFromUser(user);
  }, [user, syncFromUser]);

  const personaType = activeProfile && personaByType(activeProfile) ? activeProfile : 'farmer';
  const persona = personaByType(personaType) ?? PERSONAS[0];
  const config = personaHomeConfig(personaType);
  const isFarmer = personaType === 'farmer';

  // Farmer is the super-user: aggregate mode defaults ON (robust.md §4.2).
  useEffect(() => {
    setAggregate(personaType === 'farmer');
  }, [personaType]);

  // §9.4 persona-switch cinematic: 700 ms scene crossfade + glass toast.
  const prevPersonaRef = useRef(personaType);
  useEffect(() => {
    if (prevPersonaRef.current === personaType) return;
    prevPersonaRef.current = personaType;
    setSwitching(true);
    toast(t('vgSwitchToast', { persona: personaLabel(personaType) }));
    const id = window.setTimeout(() => setSwitching(false), 700);
    return () => window.clearTimeout(id);
  }, [personaType, t]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([getToday(), fetchSummary(aggregate ? 'all' : personaType), getIntelligence()]).then(
      ([todayRes, summaryRes, intelRes]) => {
        setTasks(todayRes.status === 'fulfilled' ? todayRes.value.items : null);
        setSummaryData(summaryRes.status === 'fulfilled' ? summaryRes.value : null);
        setIntel(intelRes.status === 'fulfilled' ? intelRes.value : null);
        setLoading(false);
      }
    );
  }, [aggregate, personaType]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleTasks = (tasks ?? []).filter(
    (task) => aggregate || task.persona === personaType
  );
  const urgentTasks = visibleTasks.filter((task) => task.priority === 'urgent');
  const headlineTask = visibleTasks.find((task) => task.headline_task) ?? null;
  const moduleCounts = mergedModuleCounts(summaryData, personaType, aggregate);
  const gridModules = MODULE_ORDER.filter((module) => {
    const count = moduleCounts[module];
    const aclTool = MODULE_ACL_TOOL[module];
    return (count !== undefined && count > 0) || (aclTool ? canAccess(personaType, aclTool) : false);
  });

  // Verdant Glass §10 — hero metric + tri-card derive from REAL data only.
  const openTaskCount = visibleTasks.filter((task) => task.status === 'open').length;
  const acres = typeof user?.landAreaAcres === 'number' ? user.landAreaAcres : null;
  const mitraAdviceKey = `vgAdvice_${personaType}`;
  const mitraAdvice = t(mitraAdviceKey);
  const heroShowsLand = isFarmer && acres !== null;
  const heroRows = gridModules.slice(0, 3);

  const taskTitle = (task: Task): string => {
    if (lang === 'hi') return task.title?.hi || task.title?.en || '';
    return task.title?.en || task.title?.hi || '';
  };

  const complete = async (task: Task) => {
    if (busyTask) return;
    setBusyTask(task.taskId);
    try {
      await markDone(task.taskId, task.decisionId ?? undefined);
      track('task_completed', { taskId: task.taskId, module: task.module });
      setTasks((prev) =>
        prev ? prev.map((item) => (item.taskId === task.taskId ? { ...item, status: 'done' as const } : item)) : prev
      );
      setSummaryData((prev) => decrementSummary(prev, task.persona, task.module));
      setJustDone(task.taskId);
      window.setTimeout(() => {
        setTasks((prev) => (prev ? prev.filter((item) => item.taskId !== task.taskId) : prev));
        setJustDone((id) => (id === task.taskId ? null : id));
      }, 1400);
      toast(
        task.coinsAwarded > 0
          ? t('dashCoinsEarned', { count: task.coinsAwarded })
          : t('dashTaskDoneToast')
      );
    } catch {
      toast(t('dashTaskActionFailed'), { error: true });
    } finally {
      setBusyTask(null);
    }
  };

  const openTask = (task: Task) => {
    track('task_clicked', { taskId: task.taskId, module: task.module });
    if (isKnownRoute(task.deepLink)) navigate(task.deepLink);
  };

  /** Post-success UI for a settled task (done/dismissed) — shared by the
   *  checklist check and the M29 confirm/dismiss buttons. */
  const settleTask = (task: Task, status: 'done' | 'dismissed') => {
    setTasks((prev) =>
      prev
        ? prev.map((item) => (item.taskId === task.taskId ? { ...item, status } : item))
        : prev
    );
    setSummaryData((prev) => decrementSummary(prev, task.persona, task.module));
    setJustDone(task.taskId);
    window.setTimeout(() => {
      setTasks((prev) => (prev ? prev.filter((item) => item.taskId !== task.taskId) : prev));
      setJustDone((id) => (id === task.taskId ? null : id));
    }, 1400);
  };

  /** M29 (task 1.37): confirm a rule-fire task — the confirm action is the
   *  EXISTING offer-accept endpoint from task 1.32 (never a privileged path);
   *  then the task itself is marked done. */
  const confirmFireTask = async (task: Task) => {
    if (busyTask || task.status !== 'open') return;
    setBusyTask(task.taskId);
    try {
      const offerId = ruleFireOfferId(task.actionEndpoint);
      if (offerId) await acceptOffer(offerId);
      await markDone(task.taskId, task.decisionId ?? undefined);
      track('task_completed', { taskId: task.taskId, module: task.module });
      settleTask(task, 'done');
      toast(t('dashTaskDoneToast'));
    } catch {
      toast(t('dashTaskActionFailed'), { error: true });
    } finally {
      setBusyTask(null);
    }
  };

  const dismissFireTask = async (task: Task) => {
    if (busyTask || task.status !== 'open') return;
    setBusyTask(task.taskId);
    try {
      await markDismiss(task.taskId);
      settleTask(task, 'dismissed');
    } catch {
      toast(t('dashTaskActionFailed'), { error: true });
    } finally {
      setBusyTask(null);
    }
  };

  const moneyRows: Array<{ key: string; labelKey: string; paisa: number | undefined }> = [
    { key: 'receivables', labelKey: 'dashReceivables', paisa: intel?.pendingReceivablesPaisa },
    { key: 'payables', labelKey: 'dashPayables', paisa: intel?.pendingPayablesPaisa },
    { key: 'settlements', labelKey: 'dashSettlements', paisa: intel?.pendingSettlementsPaisa },
  ];
  const moneyVisible = moneyRows.filter((row) => row.paisa !== undefined);

  useEffect(() => subscribe(() => setPendingSync(pendingCount())), []);

  // WS-09 task 9.6 — fire task_shown once per task as cards render.
  useEffect(() => {
    (tasks ?? []).forEach((task) => {
      if (!shownTasksRef.current.has(task.taskId)) {
        shownTasksRef.current.add(task.taskId);
        track('task_shown', { taskId: task.taskId, module: task.module });
      }
    });
  }, [tasks]);

  return (
    <SceneScaffold
      persona={personaType}
      className={`dash-scene${switching ? ' agro-scene-switching' : ''}`}
      style={{ '--agro-ai-bar-bottom': '92px' } as CSSProperties}
    >
      <RatePrompt />
      <SiteHeader />
      {pendingSync > 0 ? (
        <div className="dash-content" style={{ paddingTop: 8, paddingBottom: 0 }}>
          <p className="trade-hint">📶 {t('offline.pendingSync', { count: pendingSync })}</p>
        </div>
      ) : null}
      <MenuBar onOpenAllTools={() => setToolsOpen(true)} />
      <main className="dash-content" style={{ flex: 1 }}>
        {/* §7.2 floating stat pills over the scene. */}
        <div className="dash-stat-pills">
          {user?.village ? (
            <span className="agro-stat-pill">
              <span className="agro-stat-pill-icon">📍</span>
              <span className="agro-stat-pill-text">
                <span className="agro-stat-pill-label">{t('vgStatLocation')}</span>
                <span className="agro-stat-pill-value">{user.village}</span>
              </span>
            </span>
          ) : null}
          {acres !== null ? (
            <span className="agro-stat-pill">
              <span className="agro-stat-pill-icon">🏞️</span>
              <span className="agro-stat-pill-text">
                <span className="agro-stat-pill-label">{t('vgStatLand')}</span>
                <span className="agro-stat-pill-value">
                  {acres.toFixed(1)} {t('vgKpiAcresUnit')}
                </span>
              </span>
            </span>
          ) : null}
          <span className="agro-stat-pill">
            <span className="agro-stat-pill-icon">✅</span>
            <span className="agro-stat-pill-text">
              <span className="agro-stat-pill-label">{t('vgStatTasks')}</span>
              <span className="agro-stat-pill-value">{openTaskCount}</span>
            </span>
          </span>
          {pendingSync > 0 ? (
            <span className="agro-stat-pill">
              <span className="agro-stat-pill-icon">📶</span>
              <span className="agro-stat-pill-text">
                <span className="agro-stat-pill-label">{t('vgStatSync')}</span>
                <span className="agro-stat-pill-value">{pendingSync}</span>
              </span>
            </span>
          ) : null}
        </div>
        {isFarmer ? (
          <div className="dash-hero">
            <div className="dash-hero-top">
              <div>
                <div className="dash-hero-greeting">
                  {t(greetingKey())}
                  {user?.name ? `, ${user.name}` : ''} 👋
                </div>
                <div className="dash-hero-sub">
                  {user?.village ? `${user.village} • ` : ''}
                  {typeof user?.landAreaAcres === 'number'
                    ? `${user.landAreaAcres.toFixed(1)} ${t('acresUnit')}`
                    : t('digitalAgriPlatform')}
                </div>
              </div>
              <button
                type="button"
                className="dash-role-capsule"
                onClick={() => setSwitchOpen(true)}
              >
                👤 {t('dashActiveRole', { role: personaLabel(personaType), count: linkedProfiles.length })}
                {' • '}
                {t('dashChange')}
              </button>
            </div>
          </div>
        ) : (
          <PersonaBanner persona={persona} onSwitch={() => setSwitchOpen(true)} />
        )}

        <ProfileSwitcherBar onOpenSheet={() => setSwitchOpen(true)} />

        {/* Breaking-news banner (phase-04 WS-05 task 5.5). */}
        <BreakingBanner />

        {/* Persona switcher + aggregate mode (farmer defaults ON). */}
        <div className="dash-aggregate-row">
          <button
            type="button"
            className={`dash-aggregate-toggle${aggregate ? ' on' : ''}`}
            aria-pressed={aggregate}
            onClick={() => setAggregate((value) => !value)}
          >
            👥 {t('dashAllProfiles')}
          </button>
          <button type="button" className="dash-aggregate-toggle" onClick={() => setMitraOpen(true)}>
            💬 {t('kmFab')}
          </button>
          <span className="dash-aggregate-hint">{t('dashAggregateHint')}</span>
        </div>

        {/* §10 hero row — hero metric card + persona AI companion card. */}
        <section className="dash-hero-row">
          <div className="agro-glass agro-hero-metric agro-card-enter">
            <div>
              <div className="agro-hero-metric-number">
                {heroShowsLand ? acres.toFixed(1) : openTaskCount}
                {heroShowsLand ? <small> {t('vgKpiAcresUnit')}</small> : null}
              </div>
              <div className="agro-hero-metric-caption">
                {heroShowsLand
                  ? `${user?.village ? `${user.village} · ` : ''}${t('vgKpiArea')}`
                  : t('vgStatTasks')}
              </div>
              <span className="agro-status-chip">
                {urgentTasks.length > 0 ? `⚠ ${urgentTasks.length} · ` : '✓ '}
                {urgentTasks.length > 0 ? t('vgStatTasks') : t('vgHeroStatusOptimal')}
              </span>
            </div>
            <div>
              <div className="agro-hero-rows">
                {heroRows.length === 0 ? (
                  <span className="agro-hero-row">
                    <span className="agro-hero-row-thumb">🌱</span>
                    <span className="agro-hero-row-name">{t('dashNoTasks')}</span>
                    <span className="agro-hero-row-count">—</span>
                  </span>
                ) : (
                  heroRows.map((module) => {
                    const count = moduleCounts[module];
                    const hasOpen = count !== undefined && count > 0;
                    return (
                      <span key={module} className="agro-hero-row">
                        <span className="agro-hero-row-thumb">{MODULE_ICON[module]}</span>
                        <span className="agro-hero-row-name">{t(`dashModule_${module}`)}</span>
                        <span className="agro-hero-row-count">
                          {hasOpen ? (count as number) : '✓'}
                        </span>
                      </span>
                    );
                  })
                )}
              </div>
              <div className="agro-hero-cta">
                <a href="#dash-modules" className="agro-btn-lime">
                  {t('dashModulesTitle')} ↓
                </a>
              </div>
            </div>
          </div>
          <AgroMitraCard
            personaType={personaType}
            greeting={persona.native}
            advice={mitraAdvice === mitraAdviceKey ? t('vgAdvice_default') : mitraAdvice}
            onDetails={() => setMitraOpen(true)}
            onMic={() => setMitraOpen(true)}
          />
        </section>

        {/* §10 metric row — fused tri-card of persona KPIs (real data only). */}
        <div className="agro-glass agro-tri-card agro-card-enter">
          <div className="agro-metric">
            <span className="agro-metric-chip">🏞️</span>
            <span className="agro-metric-label">{t('vgKpiArea')}</span>
            <span className="agro-metric-value">
              {acres !== null ? acres.toFixed(1) : '—'}
              {acres !== null ? <small> {t('vgKpiAcresUnit')}</small> : null}
            </span>
          </div>
          <div className="agro-metric">
            <span className="agro-metric-chip">✅</span>
            <span className="agro-metric-label">{t('vgKpiOpenTasks')}</span>
            <span className="agro-metric-value">{openTaskCount}</span>
          </div>
          <div className="agro-metric">
            <span className="agro-metric-chip">💰</span>
            <span className="agro-metric-label">{t('vgKpiReceivables')}</span>
            <span className="agro-metric-value">
              {intel?.pendingReceivablesPaisa !== undefined ? formatPaisa(intel.pendingReceivablesPaisa) : '—'}
            </span>
          </div>
        </div>

        {/* 1 — Hero next-best-action card (WS-03 ranked). */}
        {headlineTask ? (
          <section className="dash-section dash-hero-action">
            <SectionTitle title={t('dashActionHeroTitle')} />
            <ConfidenceGate
              confidence={headlineTask.rank_confidence ?? ZERO}
            >
              {(preselected) => (
                <div className={`dash-action-card${preselected ? ' confident' : ''}`}>
                  <span className="dash-action-icon">{MODULE_ICON[headlineTask.module] ?? '✅'}</span>
                  <div className="dash-action-main">
                    <div className="dash-action-title">
                      {taskTitle(headlineTask)}{' '}
                      <AiBadge confidence={headlineTask.rank_confidence ?? ZERO} />
                    </div>
                    {headlineTask.subtitle ? (
                      <div className="dash-action-sub">{headlineTask.subtitle}</div>
                    ) : null}
                  </div>
                  {isKnownRoute(headlineTask.deepLink) ? (
                    <button
                      type="button"
                      className={`dash-action-cta${preselected ? '' : ' neutral'}`}
                      onClick={() => openTask(headlineTask)}
                    >
                      {t('dashTaskOpen')} →
                    </button>
                  ) : null}
                </div>
              )}
            </ConfidenceGate>
          </section>
        ) : null}

        {/* 2 — Urgent strip. */}
        {loading ? (
          <section className="dash-section">
            <SectionTitle title={t('dashUrgentTitle')} />
            <div className="dash-skeleton-grid">
              <div className="dash-skeleton" aria-label={t('dashLoadingTasksAria')} />
              <div className="dash-skeleton" aria-label={t('dashLoadingTasksAria')} />
            </div>
          </section>
        ) : urgentTasks.length > 0 ? (
          <section className="dash-section">
            <SectionTitle title={t('dashUrgentTitle')} />
            <div className="dash-urgent-strip">
              {urgentTasks.map((task) => (
                <button
                  key={task.taskId}
                  type="button"
                  className="dash-urgent-card"
                  onClick={() => openTask(task)}
                  disabled={!isKnownRoute(task.deepLink)}
                >
                  <span className="dash-urgent-icon">{MODULE_ICON[task.module] ?? '⚠️'}</span>
                  <span className="dash-urgent-title">{taskTitle(task)}</span>
                  {task.subtitle ? <span className="dash-urgent-sub">{task.subtitle}</span> : null}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* 3 — Today's tasks checklist. */}
        <section className="dash-section">
          <SectionTitle title={t('dashTodayTitle')} />
          {loading ? (
            <div className="dash-skeleton-grid">
              <div className="dash-skeleton" aria-label={t('dashLoadingTasksAria')} />
              <div className="dash-skeleton" aria-label={t('dashLoadingTasksAria')} />
            </div>
          ) : visibleTasks.length === 0 ? (
            <p className="dash-empty-line">🌱 {t('dashNoTasks')}</p>
          ) : (
            <div className="dash-task-list">
              {visibleTasks.map((task) => (
                <div
                  key={task.taskId}
                  className={`dash-task-row${task.status === 'done' ? ' done' : ''}${
                    justDone === task.taskId ? ' celebrate' : ''
                  }`}
                >
                  <button
                    type="button"
                    className={`dash-task-check${task.status === 'done' ? ' checked' : ''}`}
                    aria-label={t('dashTaskCheckAria')}
                    aria-busy={busyTask === task.taskId}
                    disabled={task.status !== 'open' || busyTask === task.taskId}
                    onClick={() => void complete(task)}
                  >
                    {task.status === 'done' ? '✓' : ''}
                  </button>
                  <span className="dash-task-icon">{MODULE_ICON[task.module] ?? '✅'}</span>
                  <div className="dash-task-main">
                    <div className="dash-task-title">{taskTitle(task)}</div>
                    {task.subtitle ? <div className="dash-task-sub">{task.subtitle}</div> : null}
                  </div>
                  {isKnownRoute(task.deepLink) ? (
                    <button
                      type="button"
                      className="dash-task-open"
                      onClick={() => openTask(task)}
                    >
                      {t('dashTaskOpen')} →
                    </button>
                  ) : null}
                  {task.kind === RULE_FIRE_KIND && task.status === 'open' ? (
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        type="button"
                        className="dash-task-open"
                        aria-busy={busyTask === task.taskId}
                        disabled={busyTask === task.taskId}
                        onClick={() => void confirmFireTask(task)}
                      >
                        ✓ {t('agentRules.fireConfirm')}
                      </button>
                      <button
                        type="button"
                        className="dash-task-open"
                        aria-busy={busyTask === task.taskId}
                        disabled={busyTask === task.taskId}
                        onClick={() => void dismissFireTask(task)}
                      >
                        {t('agentRules.fireDismiss')}
                      </button>
                    </span>
                  ) : null}
                  {justDone === task.taskId && task.coinsAwarded > 0 ? (
                    <span className="dash-task-coins">
                      🪙 {t('dashCoinsEarned', { count: task.coinsAwarded })}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4 — Module summary grid (live counts; honest zero state). */}
        <section className="dash-section" id="dash-modules">
          <SectionTitle title={t('dashModulesTitle')} />
          {loading ? (
            <div className="dash-skeleton-grid">
              <div className="dash-skeleton" aria-label={t('dashLoadingSection')} />
              <div className="dash-skeleton" aria-label={t('dashLoadingSection')} />
              <div className="dash-skeleton" aria-label={t('dashLoadingSection')} />
            </div>
          ) : gridModules.length === 0 ? (
            <p className="dash-empty-line">🧩 {t('dashNoTasks')}</p>
          ) : (
            <div className="dash-grid-3">
              {gridModules.map((module) => {
                const count = moduleCounts[module];
                const hasOpen = count !== undefined && count > 0;
                return (
                  <div key={module} className="dash-module-card">
                    <span className="dash-module-icon">{MODULE_ICON[module]}</span>
                    <span className="dash-module-name">{t(`dashModule_${module}`)}</span>
                    <span className={`dash-module-count${hasOpen ? '' : ' clear'}`}>
                      {hasOpen
                        ? t('dashModuleOpenCount', { count: count as number })
                        : t('dashModuleClear')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 5 — Money snapshot (replaces every hardcoded metric pill). */}
        <section className="dash-section">
          <SectionTitle title={t('dashMoneyTitle')} />
          {loading ? (
            <div className="dash-skeleton-grid">
              <div className="dash-skeleton" aria-label={t('dashLoadingSection')} />
            </div>
          ) : moneyVisible.length === 0 ? (
            <p className="dash-empty-line">💰 {t('dashNoMoney')}</p>
          ) : (
            <div className="dash-money-grid">
              {moneyVisible.map((row) => (
                <div key={row.key} className="dash-money-card">
                  <span className="dash-money-label">{t(row.labelKey)}</span>
                  <span className="dash-money-value">{formatPaisa(row.paisa as number)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {personaType === 'seller' ? <SellerHomeBoard /> : null}
        {personaType === 'directBuyer' ? <BuyerHomeBoard embedded /> : null}
        {personaType === 'transport' ? <TransportHomeBoard /> : null}
        {personaType === 'broker' ? <BrokerHomeBoard embedded /> : null}
        {personaType === 'farmLandlord' ? <LandlordHomeBoard /> : null}
        {personaType === 'equipmentRental' ? <EquipmentOwnerHomeBoard /> : null}
        {personaType === 'customer' ? <EMarketHome /> : null}
        {personaType === 'instructor' ? <InstructorHome /> : null}
        {personaType === 'dairyManager' ? <DairyManagerHomeBoard /> : null}

        {personaType === 'farmer' || personaType === 'transport' ? <InsightsPanel /> : null}

        {config.sections.map((section, index) => (
          <section className="dash-section" key={section.titleKey}>
            <SectionTitle title={t(section.titleKey)} />
            <div className={index === 0 ? 'dash-grid-2' : 'dash-grid-3'}>
              {section.tiles.map((tile) => (
                <ToolTile key={tile} id={tile} deepLink={config.deepLinks?.[tile]} />
              ))}
            </div>
          </section>
        ))}

        {config.banners
          ?.filter((kind) => kind !== 'mandi')
          .map((kind) => (
            <PromoBanner key={kind} kind={kind} />
          ))}
      </main>
      <SiteFooter />
      <BottomMenuBar />
      <ProfileSwitcherSheet open={switchOpen} onClose={() => setSwitchOpen(false)} />
      <AllToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} />
      <KisanMitraSheet open={mitraOpen} onClose={() => setMitraOpen(false)} />
      <AgroAiBar onEngage={() => setMitraOpen(true)} />
    </SceneScaffold>
  );
}
