import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { NotificationCenter } from '../common/NotificationCenter';
import { AiChatbotDrawer } from '../common/AiChatbotDrawer';

export const AppShell: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Body with Responsive Sidebar and Dynamic Content */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar />
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-12 overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* Floating Global Micro-Services */}
      <NotificationCenter />
      <AiChatbotDrawer />

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav />
    </div>
  );
};
