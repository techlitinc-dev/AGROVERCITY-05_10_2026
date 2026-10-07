import type { ComponentType } from 'react';
import AdvisoryHubPage from './AdvisoryHubPage';
import CropPlannerPage from './CropPlannerPage';
import DiseaseScanPage from './DiseaseScanPage';

/**
 * Advisory pages registry — maps dashboard tool ids to real implementations.
 * ToolPage renders these inside the tool shell; anything not listed keeps the
 * generic placeholder. Deep-route pages are exported individually for App.tsx.
 */
export const ADVISORY_PAGES: Record<string, ComponentType> = {
  // `advisoryHub` is the deep-link tool id (tasks 2.22 / 2.9) and `advisory` is
  // the All-Tools launcher tile — both open the same five-tab hub.
  advisoryHub: AdvisoryHubPage,
  advisory: AdvisoryHubPage,
  diseaseScan: DiseaseScanPage,
  cropPlanner: CropPlannerPage,
};

export { AdvisoryHubPage, CropPlannerPage, DiseaseScanPage };
