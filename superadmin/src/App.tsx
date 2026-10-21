import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { TopBar } from './components/TopBar';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { OverviewView } from './views/OverviewView';
import { FarmerPagesManagementView } from './views/FarmerPagesManagementView';
import { FarmerView } from './views/FarmerView';
import { LandlordView } from './views/LandlordView';
import { TransporterView } from './views/TransporterView';
import { VyapariView } from './views/VyapariView';
import { EquipmentView } from './views/EquipmentView';
import { TradeDeskView } from './views/TradeDeskView';
import { LivestockHubView } from './views/LivestockHubView';
import { FpoHubView } from './views/FpoHubView';
import { MahilaView } from './views/MahilaView';
import { GurukulAdminView } from './views/GurukulAdminView';
import { BankingInsuranceView } from './views/BankingInsuranceView';
import { ColdStorageView } from './views/ColdStorageView';
import { NurseryView } from './views/NurseryView';
import { CustomerView } from './views/CustomerView';
import { RbacView } from './views/RbacView';

const MainShell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100 font-sans antialiased">
      <TopBar />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-950">
          <div className="max-w-7xl mx-auto space-y-6">
            {activeTab === 'overview' && <OverviewView />}
            {activeTab === 'farmer_pages' && <FarmerPagesManagementView />}
            {activeTab === 'farmer' && <FarmerView />}
            {activeTab === 'landlord' && <LandlordView />}
            {activeTab === 'transporter' && <TransporterView />}
            {activeTab === 'vyapari' && <VyapariView />}
            {activeTab === 'equipment' && <EquipmentView />}
            {activeTab === 'trade_desk' && <TradeDeskView />}
            {activeTab === 'livestock' && <LivestockHubView />}
            {activeTab === 'fpo' && <FpoHubView />}
            {activeTab === 'mahila' && <MahilaView />}
            {activeTab === 'gurukul' && <GurukulAdminView />}
            {activeTab === 'banking_insurance' && <BankingInsuranceView />}
            {activeTab === 'cold_storage' && <ColdStorageView />}
            {activeTab === 'nursery' && <NurseryView />}
            {activeTab === 'customer' && <CustomerView />}
            {activeTab === 'rbac' && <RbacView />}
          </div>
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainShell />
    </AuthProvider>
  );
};

export default App;
