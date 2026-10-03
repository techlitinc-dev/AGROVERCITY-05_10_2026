import type { ComponentType } from 'react';
import VetNetHomePage from './VetNetHomePage';
import VetsPage from './VetsPage';
import VetFormPage from './VetFormPage';
import AppointmentsPage from './AppointmentsPage';
import CampaignsPage from './CampaignsPage';
import CampaignDetailPage from './CampaignDetailPage';
import PrescriptionsPage from './PrescriptionsPage';

/** Vet-network pages registry — `vetNetwork` tool id → hub page (plan/dairy_plan.md §14 P9). */
export const VET_PAGES: Record<string, ComponentType> = {
  vetNetwork: VetNetHomePage,
};

export {
  VetsPage,
  VetFormPage,
  AppointmentsPage,
  CampaignsPage,
  CampaignDetailPage,
  PrescriptionsPage,
};
