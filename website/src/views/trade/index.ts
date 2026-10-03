import type { ComponentType } from 'react';
import AnalyticsPage from './AnalyticsPage';
import BankAccountsPage from './BankAccountsPage';
import BrowseDemandsPage from './BrowseDemandsPage';
import ChatListPage from './ChatListPage';
import ChatRoomPage from './ChatRoomPage';
import DemandForm from './DemandForm';
import DemandsPage from './DemandsPage';
import DiscoverPage from './DiscoverPage';
import KhataPage from './KhataPage';
import LotsPage from './LotsPage';
import LotForm from './LotForm';
import LotDetailPage from './LotDetailPage';
import MandiPage from './MandiPage';
import NotificationsPage from './NotificationsPage';
import OfferDetailPage from './OfferDetailPage';
import OffersPage from './OffersPage';
import PosPage from './PosPage';
import ProcurementPage from './ProcurementPage';
import PurchaseDetailPage from './PurchaseDetailPage';
import PurchasesPage from './PurchasesPage';
import RatesPage from './RatesPage';
import SavedFarmersPage from './SavedFarmersPage';

/**
 * Trade pages registry — maps dashboard tool ids to real implementations.
 * ToolPage renders these inside the tool shell; anything not listed keeps the
 * generic placeholder. Deep-route pages are exported individually for App.tsx.
 */
export const TRADE_PAGES: Record<string, ComponentType> = {
  sellProduce: LotsPage,
  browseLots: DiscoverPage,
  myOffers: OffersPage,
  chats: ChatListPage,
  purchases: PurchasesPage,
  demands: DemandsPage,
  buyDemands: BrowseDemandsPage,
  savedFarmers: SavedFarmersPage,
  mandi: MandiPage,
  analytics: AnalyticsPage,
  khata: KhataPage,
  pos: PosPage,
  procurement: ProcurementPage,
  rates: RatesPage,
  notifications: NotificationsPage,
  bankAccounts: BankAccountsPage,
};

export {
  AnalyticsPage,
  BankAccountsPage,
  BrowseDemandsPage,
  ChatListPage,
  ChatRoomPage,
  DemandForm,
  DemandsPage,
  DiscoverPage,
  KhataPage,
  LotsPage,
  LotForm,
  LotDetailPage,
  MandiPage,
  NotificationsPage,
  OfferDetailPage,
  OffersPage,
  PosPage,
  ProcurementPage,
  PurchaseDetailPage,
  PurchasesPage,
  RatesPage,
  SavedFarmersPage,
};
