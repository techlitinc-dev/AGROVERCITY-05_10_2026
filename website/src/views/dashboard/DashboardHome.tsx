import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';
import AllToolsSheet from '../../components/dashboard/AllToolsSheet';
import BottomMenuBar from '../../components/dashboard/BottomMenuBar';
import MenuBar from '../../components/dashboard/MenuBar';
import ProfileSwitcherBar from '../../components/dashboard/ProfileSwitcherBar';
import ProfileSwitcherSheet from '../../components/dashboard/ProfileSwitcherSheet';
import { PersonaBanner, PromoBanner, SectionTitle, ToolTile } from '../../components/dashboard/tiles';
import AiBadge from '../../components/ai/AiBadge';
import ConfidenceGate from '../../components/ai/ConfidenceGate';
import KisanMitraSheet from '../../components/chatbot/KisanMitraSheet';
import BreakingBanner from '../../components/news/BreakingBanner';
import InsightsPanel from '../../components/intelligence/InsightsPanel';
import SellerHomeBoard from '../../components/dashboard/SellerHomeBoard';
import { toast } from '../../components/toast';
import { getIntelligence, type IntelligenceResponse } from '../../lib/api/intelligence';
import { getToday, markDone, summary as fetchSummary, type Task, type TaskSummary } from '../../lib/api/tasks';
import { canAccess, personaHomeConfig } from '../../lib/dashboard';
import { ZERO } from '../../lib/numDefaults';
import { PERSONAS, personaByType, personaLabel } from '../../lib/personas';
import { isKnownRoute } from '../../lib/routes';
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

  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [summaryData, setSummaryData] = useState<TaskSummary | null>(null);
  const [intel, setIntel] = useState<IntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [aggregate, setAggregate] = useState(false);
  const [justDone, setJustDone] = useState<string | null>(null);
  const [busyTask, setBusyTask] = useState<string | null>(null);

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

  const taskTitle = (task: Task): string => {
    if (lang === 'hi') return task.title?.hi || task.title?.en || '';
    return task.title?.en || task.title?.hi || '';
  };

  const complete = async (task: Task) => {
    if (busyTask) return;
    setBusyTask(task.taskId);
    try {
      await markDone(task.taskId, task.decisionId ?? undefined);
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
    if (isKnownRoute(task.deepLink)) navigate(task.deepLink);
  };

  const moneyRows: Array<{ key: string; labelKey: string; paisa: number | undefined }> = [
    { key: 'receivables', labelKey: 'dashReceivables', paisa: intel?.pendingReceivablesPaisa },
    { key: 'payables', labelKey: 'dashPayables', paisa: intel?.pendingPayablesPaisa },
    { key: 'settlements', labelKey: 'dashSettlements', paisa: intel?.pendingSettlementsPaisa },
  ];
  const moneyVisible = moneyRows.filter((row) => row.paisa !== undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <SiteHeader />
      <MenuBar onOpenAllTools={() => setToolsOpen(true)} />
      <main className="dash-content" style={{ flex: 1 }}>
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
        <section className="dash-section">
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
      <button
        type="button"
        className="km-fab"
        aria-label={t('kmFab')}
        onClick={() => setMitraOpen(true)}
      >
        💬
      </button>
    </div>
  );
}
