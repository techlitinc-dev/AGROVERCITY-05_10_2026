import type { ComponentType } from 'react';
import DairyConsoleHome from './DairyConsoleHome';
import DairyHubPage from './DairyHubPage';
import MyDairyPage from './MyDairyPage';
import CollectionsPage from './collections/CollectionsPage';
import CollectionEntryPage from './collections/CollectionEntryPage';
import MembersPage from './members/MembersPage';
import MemberFormPage from './members/MemberFormPage';
import MemberStatementPage from './members/MemberStatementPage';
import RateChartPage from './ratechart/RateChartPage';
import PaymentsPage from './payments/PaymentsPage';
import BatchDetailPage from './payments/BatchDetailPage';
import CustomersPage from './sales/CustomersPage';
import CustomerFormPage from './sales/CustomerFormPage';
import OrdersPage from './sales/OrdersPage';
import OrderDetailPage from './sales/OrderDetailPage';
import StockPage from './stock/StockPage';
import ReportsPage from './reports/ReportsPage';
import AnalyticsPage from './analytics/AnalyticsPage';
import RoutePlannerPage from './routes/RoutePlannerPage';
import '../../theme/dairy.css';

/**
 * Dairy pages registry — maps dashboard tool ids to real implementations
 * (livestockDairy farmer face + dairyManager console). ToolPage renders these
 * inside the tool shell; deep-route pages are exported for App.tsx.
 */
export const DAIRY_PAGES: Record<string, ComponentType> = {
  livestockDairy: DairyHubPage,
  dairyConsole: DairyConsoleHome,
  dairyRoutePlanner: RoutePlannerPage,
};

export {
  DairyConsoleHome,
  DairyHubPage,
  MyDairyPage,
  CollectionsPage,
  CollectionEntryPage,
  MembersPage,
  MemberFormPage,
  MemberStatementPage,
  RateChartPage,
  PaymentsPage,
  BatchDetailPage,
  CustomersPage,
  CustomerFormPage,
  OrdersPage,
  OrderDetailPage,
  StockPage,
  ReportsPage,
  RoutePlannerPage,
};
export { AnalyticsPage };
