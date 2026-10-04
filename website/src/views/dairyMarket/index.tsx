import type { ComponentType } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import DairyManagerHomeBoard from './DairyManagerHomeBoard';
import FarmerRfqsPage from './FarmerRfqsPage';
import BidComparePage from './BidComparePage';

export const DAIRY_MARKET_PAGES: Record<string, ComponentType> = {
  dairyManagerHome: () => (
    <ToolShell toolId="dairyManagerHome">
      <DairyManagerHomeBoard embedded />
    </ToolShell>
  ),
  dairyFarmerRfqs: () => (
    <ToolShell toolId="dairyFarmerRfqs">
      <FarmerRfqsPage embedded />
    </ToolShell>
  ),
  dairyBidCompare: () => (
    <ToolShell toolId="dairyBidCompare">
      <BidComparePage embedded />
    </ToolShell>
  ),
};

export { DairyManagerHomeBoard, FarmerRfqsPage, BidComparePage };


