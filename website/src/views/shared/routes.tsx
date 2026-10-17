import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const NotificationsInbox = lazy(() => import('./NotificationsInbox').then((m) => ({ default: m.NotificationsInbox })));
const SupportCenter = lazy(() => import('./SupportCenter').then((m) => ({ default: m.SupportCenter })));
const SettingsPage = lazy(() => import('./SettingsPage').then((m) => ({ default: m.SettingsPage })));
const BillingPage = lazy(() => import('./BillingPage').then((m) => ({ default: m.BillingPage })));
const KycCasePage = lazy(() => import('./KycCasePage').then((m) => ({ default: m.KycCasePage })));
const BankAccountsPage = lazy(() => import('./BankAccountsPage').then((m) => ({ default: m.BankAccountsPage })));
const ChatPage = lazy(() => import('./ChatPage').then((m) => ({ default: m.ChatPage })));

/** 13. Shared / cross-persona platform surfaces */
export const SharedRouteElements = () => (
  <>
    <Route path="/notifications" element={<NotificationsInbox />} />
    <Route path="/support" element={<SupportCenter />} />
    <Route path="/settings" element={<SettingsPage />} />
    <Route path="/billing" element={<BillingPage />} />
    <Route path="/kyc" element={<KycCasePage />} />
    <Route path="/bank-accounts" element={<BankAccountsPage />} />
    <Route path="/chat" element={<ChatPage />} />
  </>
);
