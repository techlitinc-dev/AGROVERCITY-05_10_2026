import type { ComponentType } from 'react';
import BiltyPage from './BiltyPage';
import FleetPage from './FleetPage';
import JobInboxPage from './JobInboxPage';
import LoadBoardPage from './LoadBoardPage';
import LoadDetailPage from './LoadDetailPage';
import LoadForm from './LoadForm';
import LiveTrackingPage from './LiveTrackingPage';
import MyTripsPage from './MyTripsPage';
import SettlementsPage from './SettlementsPage';
import TransporterProfilePage from './TransporterProfilePage';
import TransportHomeBoard from './TransportHomeBoard';
import TripPage from './TripPage';
import VehicleCalendarPage from './VehicleCalendarPage';
import VehicleForm from './VehicleForm';

/**
 * Transport pages registry — maps dashboard tool ids to real implementations.
 * ToolPage renders these inside the tool shell; anything not listed keeps the
 * generic placeholder. Deep-route pages are exported individually for App.tsx.
 */
export const TRANSPORT_PAGES: Record<string, ComponentType> = {
  loadBoard: LoadBoardPage,
  myBookings: MyTripsPage,
  vehicleManage: FleetPage,
  bookingInbox: JobInboxPage,
  transporterProfile: TransporterProfilePage,
  settlements: SettlementsPage,
  biltyView: BiltyPage,
  liveTracking: LiveTrackingPage,
  vehicleCalendar: VehicleCalendarPage,
};

export {
  BiltyPage,
  FleetPage,
  JobInboxPage,
  LoadBoardPage,
  LoadDetailPage,
  LoadForm,
  LiveTrackingPage,
  MyTripsPage,
  SettlementsPage,
  TransporterProfilePage,
  TransportHomeBoard,
  TripPage,
  VehicleCalendarPage,
  VehicleForm,
};
