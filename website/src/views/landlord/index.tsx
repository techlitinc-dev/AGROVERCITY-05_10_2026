import type { ComponentType } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { useDashboardStore } from '../../stores/dashboard';
import LandlordHomeBoard from './LandlordHomeBoard';
import LandAnalyticsPage from './LandAnalyticsPage';
import LeasesPage from './LeasesPage';
import ListingWizard from './ListingWizard';
import ListingsPage from './ListingsPage';
import PlotsPage from './PlotsPage';
import RentTrackerPage from './RentTrackerPage';
import RequestsInboxPage from './RequestsInboxPage';
import Vault712Page from './Vault712Page';
import LandBrowsePage from '../farmer/LandBrowsePage';
import LeaseRequestsPage from '../farmer/LeaseRequestsPage';

/** Farmers browse land / track their requests; landlords manage listings / inbox. */
function LandListingsByPersona() {
  const active = useDashboardStore((s) => s.activeProfile);
  return active === 'farmLandlord' ? <ListingsPage /> : <LandBrowsePage />;
}

function LeaseRequestsByPersona() {
  const active = useDashboardStore((s) => s.activeProfile);
  return active === 'farmLandlord' ? <RequestsInboxPage /> : <LeaseRequestsPage />;
}

function withShell(toolId: string, Page: ComponentType) {
  return function ShelledPage() {
    return (
      <ToolShell toolId={toolId}>
        <Page />
      </ToolShell>
    );
  };
}

export const LANDLORD_PAGES: Record<string, ComponentType> = {
  landlordPlots: withShell('landlordPlots', PlotsPage),
  landListings: LandListingsByPersona,
  leaseRequests: LeaseRequestsByPersona,
  landlordLeases: withShell('landlordLeases', LeasesPage),
  landlordRent: withShell('landlordRent', RentTrackerPage),
  landlordHome: () => (
    <ToolShell toolId="landlordHome">
      <LandlordHomeBoard embedded />
    </ToolShell>
  ),
};

/** Deep-route components (App.tsx). */
export const PlotsPageRoute = withShell('landlordPlots', PlotsPage);
export const ListingsPageRoute = withShell('landListings', ListingsPage);
export const ListingWizardRoute = withShell('landListings', ListingWizard);
export const RequestsInboxPageRoute = withShell('leaseRequests', RequestsInboxPage);
export const LeasesPageRoute = withShell('landlordLeases', LeasesPage);
export const RentTrackerPageRoute = withShell('landlordRent', RentTrackerPage);
export const LandAnalyticsPageRoute = withShell('landlordHome', LandAnalyticsPage);
export const Vault712PageRoute = withShell('landlordPlots', Vault712Page);

export { LandlordHomeBoard };
