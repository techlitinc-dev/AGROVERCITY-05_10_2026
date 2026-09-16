import { Suspense, type ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import type { ProfileType } from '@/state/SessionContext';
import { useSession } from '@/state/SessionContext';
import { personaHome } from '@/config/personas';
import { AppShell } from '@/components/layout/AppShell';
import { RouteGuard } from '@/components/layout/RouteGuard';
import { Spinner } from '@/components/ui';
import { Pages } from '@/app/pages';

const F: ProfileType = 'farmer';
const L: ProfileType = 'farmLandlord';
const T: ProfileType = 'transport';
const S: ProfileType = 'seller';
const E: ProfileType = 'equipmentRental';
const B: ProfileType = 'broker';
const ALL: ProfileType[] = [F, L, T, S, E, B];

interface RouteDef {
  path: string;
  Page: ComponentType;
  allow: ProfileType[];
}

const ONBOARDING_ROUTES: RouteDef[] = [
  { path: '/onboarding', Page: Pages.Splash, allow: ALL },
  { path: '/onboarding/language', Page: Pages.Language, allow: ALL },
  { path: '/onboarding/profiles', Page: Pages.Profiles, allow: ALL },
  { path: '/onboarding/login', Page: Pages.Login, allow: ALL },
  { path: '/onboarding/register', Page: Pages.Register, allow: ALL },
  { path: '/onboarding/farm-map', Page: Pages.FarmMap, allow: ALL },
];

const SHELL_ROUTES: RouteDef[] = [
  { path: '/home', Page: Pages.FarmerHome, allow: [F] },
  { path: '/landlord', Page: Pages.LandlordHome, allow: [L] },
  { path: '/transport', Page: Pages.TransportHome, allow: [T] },
  { path: '/seller', Page: Pages.SellerHome, allow: [S] },
  { path: '/equipment-owner', Page: Pages.EquipmentOwnerHome, allow: [E] },
  { path: '/broker', Page: Pages.BrokerHome, allow: [B] },

  { path: '/mandi', Page: Pages.Mandi, allow: [F, S, B] },
  { path: '/mandi/history', Page: Pages.PriceHistory, allow: [F, S, B] },

  { path: '/marketplace', Page: Pages.Marketplace, allow: [F, L, T, S] },
  { path: '/marketplace/product/:id', Page: Pages.ProductDetail, allow: [F, L, T, S] },
  { path: '/marketplace/cart', Page: Pages.Cart, allow: [F, L, T, S] },
  { path: '/marketplace/orders', Page: Pages.Orders, allow: [F, L, T, S] },
  { path: '/marketplace/orders/:id', Page: Pages.OrderTracking, allow: [F, L, T, S] },

  { path: '/buyers', Page: Pages.Buyers, allow: [F, S, B] },

  { path: '/transport/manage', Page: Pages.VehicleManage, allow: [T] },
  { path: '/transport/calendar', Page: Pages.VehicleCalendar, allow: [T] },
  { path: '/transport/trips/:id', Page: Pages.TripDetail, allow: [T] },
  { path: '/transport/requests', Page: Pages.BookingRequests, allow: [T] },
  { path: '/transport/settlements', Page: Pages.Settlements, allow: [T] },

  { path: '/equipment', Page: Pages.Equipment, allow: [F, E] },
  { path: '/equipment/manage', Page: Pages.MachineManage, allow: [E] },
  { path: '/equipment/slots', Page: Pages.SlotCalendarManage, allow: [E] },
  { path: '/equipment/requests', Page: Pages.EquipmentRequests, allow: [E] },
  { path: '/equipment/maintenance', Page: Pages.MaintenanceLog, allow: [E] },

  { path: '/fpo', Page: Pages.Fpo, allow: [F] },
  { path: '/fpo/discover', Page: Pages.FpoDiscover, allow: [F] },

  { path: '/profit-loss', Page: Pages.ProfitLoss, allow: [F, L, S, E, B] },
  { path: '/diary', Page: Pages.Diary, allow: [F, L] },
  { path: '/finance', Page: Pages.Finance, allow: ALL },
  { path: '/finance/loans', Page: Pages.LoanTracking, allow: [F] },

  { path: '/landlord/plots', Page: Pages.PlotManage, allow: [L] },
  { path: '/landlord/leases', Page: Pages.LeaseManage, allow: [L] },
  { path: '/landlord/rent', Page: Pages.RentTracking, allow: [L] },
  { path: '/landlord/listings', Page: Pages.LandListings, allow: [L] },
  { path: '/landlord/requests', Page: Pages.LeaseRequests, allow: [L] },
  { path: '/land/browse', Page: Pages.LandBrowse, allow: [F] },
  { path: '/land/my-requests', Page: Pages.MyLeaseRequests, allow: [F] },

  { path: '/schemes', Page: Pages.Schemes, allow: [F, L] },
  { path: '/schemes/vault', Page: Pages.Vault, allow: ALL },
  { path: '/land-legal', Page: Pages.LandRecords, allow: [F, L] },
  { path: '/water', Page: Pages.Water, allow: [F] },

  { path: '/insurance', Page: Pages.Insurance, allow: [F, L] },

  { path: '/news', Page: Pages.News, allow: ALL },
  { path: '/channels', Page: Pages.Channels, allow: [F, T, E, B] },
  { path: '/channels/:id', Page: Pages.ChannelDetail, allow: [F, T, E, B] },
  { path: '/gyan-hub', Page: Pages.GyanHub, allow: ALL },

  { path: '/livestock', Page: Pages.Livestock, allow: [F, S] },
  { path: '/tree', Page: Pages.Tree, allow: [F, L, S] },

  { path: '/advisory', Page: Pages.Advisory, allow: [F] },
  { path: '/tasks', Page: Pages.FarmTasks, allow: [F] },

  { path: '/krishi-ratna', Page: Pages.KrishiRatna, allow: ALL },
  { path: '/refer', Page: Pages.ReferEarn, allow: ALL },

  { path: '/women', Page: Pages.WomenHub, allow: [F] },
  { path: '/climate', Page: Pages.Climate, allow: [F] },
  { path: '/post-harvest', Page: Pages.PostHarvest, allow: [F, T, S] },
  { path: '/soil-tests', Page: Pages.SoilTests, allow: [F] },
  { path: '/sell', Page: Pages.SellProduce, allow: [F] },

  { path: '/account/notifications', Page: Pages.Notifications, allow: ALL },
  { path: '/account/settings', Page: Pages.Settings, allow: ALL },
  { path: '/account/help', Page: Pages.Help, allow: ALL },
  { path: '/account/delete', Page: Pages.AccountDelete, allow: ALL },
  { path: '/account/profile', Page: Pages.ProfileEdit, allow: ALL },
  { path: '/account/addresses', Page: Pages.AddressBook, allow: ALL },
  { path: '/account/bank', Page: Pages.BankAccounts, allow: ALL },
  { path: '/account/bookings', Page: Pages.MyBookings, allow: ALL },
  { path: '/account/chats', Page: Pages.ChatList, allow: ALL },
  { path: '/account/chats/:id', Page: Pages.ChatThread, allow: ALL },
  { path: '/account/support', Page: Pages.SupportThread, allow: ALL },

  { path: '/search', Page: Pages.SearchResults, allow: ALL },
  { path: '/weather', Page: Pages.WeatherDetail, allow: ALL },

  { path: '/seller/rates', Page: Pages.RatePost, allow: [S] },
  { path: '/seller/inventory', Page: Pages.Inventory, allow: [S] },
  { path: '/seller/sales', Page: Pages.SalesEntry, allow: [S] },
  { path: '/seller/procurement', Page: Pages.Procurement, allow: [S] },
  { path: '/seller/ledgers', Page: Pages.BuyerLedgers, allow: [S] },

  { path: '/broker/deals', Page: Pages.DealManage, allow: [B] },
  { path: '/broker/deals/:id', Page: Pages.DealRoom, allow: [B] },
  { path: '/broker/leads', Page: Pages.LeadManage, allow: [B] },
  { path: '/broker/commissions', Page: Pages.CommissionLedger, allow: [B] },
  { path: '/broker/requirements', Page: Pages.BuyerRequirements, allow: [B] },
];

function CatchAll() {
  const { isAuthenticated, activeProfile } = useSession();
  return <Navigate to={isAuthenticated ? personaHome(activeProfile) : '/onboarding'} replace />;
}

export function AppRoutes() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <Spinner size={40} label="लोड हो रहा है" />
        </div>
      }
    >
      <Routes>
        {ONBOARDING_ROUTES.map(({ path, Page }) => (
          <Route key={path} path={path} element={<Page />} />
        ))}
        <Route
          element={
            <RouteGuard allow={ALL}>
              <AppShell />
            </RouteGuard>
          }
        >
          {SHELL_ROUTES.map(({ path, Page, allow }) => (
            <Route
              key={path}
              path={path}
              element={
                <RouteGuard allow={allow}>
                  <Page />
                </RouteGuard>
              }
            />
          ))}
        </Route>
        <Route path="*" element={<CatchAll />} />
      </Routes>
    </Suspense>
  );
}
