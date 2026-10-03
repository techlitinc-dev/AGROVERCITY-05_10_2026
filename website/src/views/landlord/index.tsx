import type { ComponentType } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import LandlordHomeBoard from './LandlordHomeBoard';

export const LANDLORD_PAGES: Record<string, ComponentType> = {
  landlordPlots: () => (
    <ToolShell toolId="landlordPlots">
      <LandlordHomeBoard embedded />
    </ToolShell>
  ),
  landListings: () => (
    <ToolShell toolId="landListings">
      <LandlordHomeBoard embedded />
    </ToolShell>
  ),
  leaseRequests: () => (
    <ToolShell toolId="leaseRequests">
      <LandlordHomeBoard embedded />
    </ToolShell>
  ),
  landlordLeases: () => (
    <ToolShell toolId="landlordLeases">
      <LandlordHomeBoard embedded />
    </ToolShell>
  ),
  landlordRent: () => (
    <ToolShell toolId="landlordRent">
      <LandlordHomeBoard embedded />
    </ToolShell>
  ),
  landlordHome: () => (
    <ToolShell toolId="landlordHome">
      <LandlordHomeBoard embedded />
    </ToolShell>
  ),
};

export { LandlordHomeBoard };
