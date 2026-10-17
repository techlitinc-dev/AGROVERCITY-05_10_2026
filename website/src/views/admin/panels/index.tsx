import React, { lazy, Suspense } from 'react';

/**
 * Panel registry for the Superadmin Master Console.
 *
 * Every SOP body (plus console home, approvals inbox and audit viewer) is
 * React.lazy — the sidebar swaps panels on demand and each one loads as its
 * own chunk. `shared.tsx` is kept eager since every panel imports it.
 */
const ConsoleHome = lazy(() => import('./ConsoleHome').then((m) => ({ default: m.ConsoleHome })));
const SecurityPanel = lazy(() => import('./SecurityPanel').then((m) => ({ default: m.SecurityPanel })));
const UsersPanel = lazy(() => import('./UsersPanel').then((m) => ({ default: m.UsersPanel })));
const KycPanel = lazy(() => import('./KycPanel').then((m) => ({ default: m.KycPanel })));
const RatesPanel = lazy(() => import('./RatesPanel').then((m) => ({ default: m.RatesPanel })));
const MarketplacePanel = lazy(() => import('./MarketplacePanel').then((m) => ({ default: m.MarketplacePanel })));
const ContractsDeskPanel = lazy(() => import('./ContractsDisputesPanel').then((m) => ({ default: m.ContractsDeskPanel })));
const DispatchPanel = lazy(() => import('./DispatchPanel').then((m) => ({ default: m.DispatchPanel })));
const EquipmentPanel = lazy(() => import('./EquipmentPanel').then((m) => ({ default: m.EquipmentPanel })));
const DisputesPanel = lazy(() => import('./DisputesPanel').then((m) => ({ default: m.DisputesPanel })));
const AdvisoryPanel = lazy(() => import('./AdvisoryPanel').then((m) => ({ default: m.AdvisoryPanel })));
const ChatbotPanel = lazy(() => import('./ChatbotPanel').then((m) => ({ default: m.ChatbotPanel })));
const DiaryPanel = lazy(() => import('./DiaryPanel').then((m) => ({ default: m.DiaryPanel })));
const FinancePanel = lazy(() => import('./FinancePanel').then((m) => ({ default: m.FinancePanel })));
const ClaimsPanel = lazy(() => import('./ClaimsPanel').then((m) => ({ default: m.ClaimsPanel })));
const LandRecordsPanel = lazy(() => import('./LandRecordsPanel').then((m) => ({ default: m.LandRecordsPanel })));
const WaterPanel = lazy(() => import('./WaterPanel').then((m) => ({ default: m.WaterPanel })));
const FpoPanel = lazy(() => import('./FpoPanel').then((m) => ({ default: m.FpoPanel })));
const LivestockPanel = lazy(() => import('./LivestockPanel').then((m) => ({ default: m.LivestockPanel })));
const ColdStoragePanel = lazy(() => import('./ColdStoragePanel').then((m) => ({ default: m.ColdStoragePanel })));
const WomenPanel = lazy(() => import('./WomenPanel').then((m) => ({ default: m.WomenPanel })));
const SettlementsPanel = lazy(() => import('./SettlementsPanel').then((m) => ({ default: m.SettlementsPanel })));
const PlatformPanel = lazy(() => import('./PlatformPanel').then((m) => ({ default: m.PlatformPanel })));
const CoursesPanel = lazy(() => import('./CoursesPanel').then((m) => ({ default: m.CoursesPanel })));
const ContentPanel = lazy(() => import('./ContentPanel').then((m) => ({ default: m.ContentPanel })));
const TreesPanel = lazy(() => import('./TreesPanel').then((m) => ({ default: m.TreesPanel })));
const EconomyPanel = lazy(() => import('./EconomyPanel').then((m) => ({ default: m.EconomyPanel })));
const ApprovalsInboxPanel = lazy(() => import('./ApprovalsInbox').then((m) => ({ default: m.ApprovalsInboxPanel })));
const AuditViewerPanel = lazy(() => import('./AuditViewer').then((m) => ({ default: m.AuditViewerPanel })));

const SOP_PANELS: Record<string, React.LazyExoticComponent<React.FC>> = {
  'SOP-01': SecurityPanel,
  'SOP-02': UsersPanel,
  'SOP-03': KycPanel,
  'SOP-04': RatesPanel,
  'SOP-05': MarketplacePanel,
  'SOP-06': MarketplacePanel,
  'SOP-07': ContractsDeskPanel,
  'SOP-08': DispatchPanel,
  'SOP-09': EquipmentPanel,
  'SOP-10': DisputesPanel,
  'SOP-11': AdvisoryPanel,
  'SOP-12': ChatbotPanel,
  'SOP-13': DiaryPanel,
  'SOP-14': FinancePanel,
  'SOP-15': ClaimsPanel,
  'SOP-16': LandRecordsPanel,
  'SOP-17': WaterPanel,
  'SOP-18': FpoPanel,
  'SOP-19': LivestockPanel,
  'SOP-20': ContentPanel,
  'SOP-21': TreesPanel,
  'SOP-22': EconomyPanel,
  'SOP-23': ColdStoragePanel,
  'SOP-24': WomenPanel,
  'SOP-25': SettlementsPanel,
  'SOP-26': PlatformPanel,
  'SOP-27': CoursesPanel,
};

const EXTRA_PANELS: Record<string, React.LazyExoticComponent<React.FC>> = {
  approvals: ApprovalsInboxPanel,
  audit: AuditViewerPanel,
};

const PANELS: Record<string, React.LazyExoticComponent<React.FC>> = {
  home: ConsoleHome,
  ...SOP_PANELS,
  ...EXTRA_PANELS,
};

/** Human sidebar titles for SOP-01…SOP-27 (single source of truth). */
export const SOP_LABELS: Record<string, string> = {
  'SOP-01': 'Auth & Admin Sessions',
  'SOP-02': 'User & Persona Governance',
  'SOP-03': 'KYC & Document Vault Queue',
  'SOP-04': 'Mandi Rates & Approvals',
  'SOP-05': 'Produce Lots & B2B Trade',
  'SOP-06': 'Marketplace Catalog',
  'SOP-07': 'Buyer Contracts & Escrow',
  'SOP-08': 'Transport Fleet & Dispatch',
  'SOP-09': 'Equipment Rental Fleet',
  'SOP-10': 'Disputes Desk & Land Leases',
  'SOP-11': 'AI Advisory & Soil Labs',
  'SOP-12': 'Chatbot Transcripts & Handoff',
  'SOP-13': 'Farm Diary & P&L Oversight',
  'SOP-14': 'Banking & Loan Underwriting',
  'SOP-15': 'Insurance Claims & DBT Disbursal',
  'SOP-16': 'Land Records Registry Sync',
  'SOP-17': 'Water Resources & Canal Roster',
  'SOP-18': 'FPO Verification & Pools',
  'SOP-19': 'Livestock, Vet & Dairy Network',
  'SOP-20': 'Content CMS & Live Channels',
  'SOP-21': 'Agroforestry & Saplings',
  'SOP-22': 'Gamification & Referral Economy',
  'SOP-23': 'Climate Alerts & Cold Storage',
  'SOP-24': 'Women & SHG Enterprise Programs',
  'SOP-25': 'Financial Settlements & Cron Jobs',
  'SOP-26': 'System Config & Platform Broadcasts',
  'SOP-27': 'Gurukul Instructor Oversight',
};

/** SOP-01…SOP-27 ids, in sidebar order. */
export const KNOWN_SOPS = Object.keys(SOP_PANELS);

/** Every mountable panel id (home + SOPs + cross-cutting desks). */
export const KNOWN_PANEL_IDS = Object.keys(PANELS);

export interface ConsoleNavItem {
  id: string;
  label: string;
  group: 'console' | 'sop' | 'desk';
}

/** Sidebar navigation model — the console renders this list verbatim. */
export const CONSOLE_NAV: ConsoleNavItem[] = [
  { id: 'home', label: '00. Console Home & Ops Health', group: 'console' },
  ...KNOWN_SOPS.map((id, i) => ({
    id,
    label: `${String(i + 1).padStart(2, '0')}. ${SOP_LABELS[id] ?? id}`,
    group: 'sop' as const,
  })),
  { id: 'approvals', label: 'A1. Approvals Inbox (Maker-Checker)', group: 'desk' },
  { id: 'audit', label: 'A2. Audit Trail Viewer', group: 'desk' },
];

const PanelFallback: React.FC = () => (
  <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 space-y-2.5">
    <div className="h-5 w-48 rounded-lg bg-slate-100 animate-pulse" />
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="h-9 rounded-xl bg-slate-100 animate-pulse" style={{ opacity: 1 - i * 0.2 }} />
    ))}
  </div>
);

/** Renders the lazy panel body for any sidebar id (home / SOP-01…27 / desk). */
export const ConsolePanel: React.FC<{ panelId: string }> = ({ panelId }) => {
  const Panel = PANELS[panelId];
  if (!Panel) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xs text-center py-16">
        <h3 className="font-extrabold text-base text-slate-900">{panelId} Ops Console</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-2">
          This module is not mapped in the console registry.
        </p>
      </div>
    );
  }
  return (
    <Suspense fallback={<PanelFallback />}>
      <Panel key={panelId} />
    </Suspense>
  );
};

/** @deprecated Use ConsolePanel — kept for older imports. */
export const SopPanel: React.FC<{ sop: string }> = ({ sop }) => <ConsolePanel panelId={sop} />;
