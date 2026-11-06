import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';

const NotificationsInbox = lazy(() => import('./NotificationsInbox').then((m) => ({ default: m.NotificationsInbox })));
const SupportCenter = lazy(() => import('./SupportCenter').then((m) => ({ default: m.SupportCenter })));
const SettingsPage = lazy(() => import('./SettingsPage').then((m) => ({ default: m.SettingsPage })));
const BillingPage = lazy(() => import('./BillingPage').then((m) => ({ default: m.BillingPage })));
const KycCasePage = lazy(() => import('./KycCasePage').then((m) => ({ default: m.KycCasePage })));
const ChatPage = lazy(() => import('./ChatPage').then((m) => ({ default: m.ChatPage })));
const TrackDeliveryView = lazy(() => import('./TrackDeliveryView').then((m) => ({ default: m.TrackDeliveryView })));
const TransactionsPage = lazy(() => import('./TransactionsPage').then((m) => ({ default: m.TransactionsPage })));
const RatingsCenterPage = lazy(() => import('./RatingsCenterPage').then((m) => ({ default: m.RatingsCenterPage })));
const ProfilePage = lazy(() => import('./ProfilePage').then((m) => ({ default: m.ProfilePage })));
const AddressBookPage = lazy(() => import('./AddressBookPage').then((m) => ({ default: m.AddressBookPage })));
const SavedPage = lazy(() => import('./SavedPage').then((m) => ({ default: m.SavedPage })));
const DeepLinkRedirect = lazy(() => import('./DeepLinkRedirect').then((m) => ({ default: m.DeepLinkRedirect })));

/** 13. Shared / cross-persona platform surfaces */
export const SharedRouteElements = () => (
  <>
    <Route path="/notifications" element={<NotificationsInbox />} />
    <Route path="/support" element={<SupportCenter />} />
    <Route path="/settings" element={<SettingsPage />} />
    <Route path="/billing" element={<BillingPage />} />
    <Route path="/kyc" element={<KycCasePage />} />
    {/* Bank Accounts page removed from the frontend — redirect for compat. */}
    <Route path="/bank-accounts" element={<Navigate to="/profile" replace />} />
    {/* Mahila Bachat Gat directory removed from the frontend — redirect for compat. */}
    <Route path="/women/directory" element={<Navigate to="/mall" replace />} />
    <Route path="/chat" element={<ChatPage />} />
    <Route path="/track/:token" element={<TrackDeliveryView />} />
    <Route path="/payments" element={<TransactionsPage />} />
    <Route path="/ratings" element={<RatingsCenterPage />} />
    <Route path="/profile" element={<ProfilePage />} />
    <Route path="/profile/addresses" element={<AddressBookPage />} />
    <Route path="/saved" element={<SavedPage />} />
    <Route path="/dashboard/p/*" element={<DeepLinkRedirect />} />
  </>
);
