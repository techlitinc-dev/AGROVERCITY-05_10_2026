import type { ComponentType } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import DairyManagerHomeBoard from './DairyManagerHomeBoard';

export const DAIRY_MARKET_PAGES: Record<string, ComponentType> = {
  dairyManagerHome: () => (
    <ToolShell toolId="dairyManagerHome">
      <DairyManagerHomeBoard embedded />
    </ToolShell>
  ),
};

export { DairyManagerHomeBoard };
