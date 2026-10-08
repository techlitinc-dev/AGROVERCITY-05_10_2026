import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './lib/i18n/locales/en';
import './lib/i18n/locales/hi';
import './lib/i18n/locales/en.trade';
import './lib/i18n/locales/hi.trade';
import './lib/i18n/locales/en.chat';
import './lib/i18n/locales/hi.chat';
import './lib/i18n/locales/en.settings';
import './lib/i18n/locales/hi.settings';
import './lib/i18n/locales/en.support';
import './lib/i18n/locales/hi.support';
import './lib/i18n/locales/en.admin';
import './lib/i18n/locales/hi.admin';
import './lib/i18n/locales/en.transport';
import './lib/i18n/locales/hi.transport';
import './lib/i18n/locales/en.cashbook';
import './lib/i18n/locales/hi.cashbook';
import './lib/i18n/locales/en.pnl';
import './lib/i18n/locales/hi.pnl';
import './lib/i18n/locales/en.broker';
import './lib/i18n/locales/hi.broker';
import './lib/i18n/locales/en.dairy';
import './lib/i18n/locales/hi.dairy';
import './lib/i18n/locales/en.intel';
import './lib/i18n/locales/hi.intel';
import './lib/i18n/locales/en.dashboard';
import './lib/i18n/locales/hi.dashboard';
import './lib/i18n/locales/en.chatbot';
import './lib/i18n/locales/hi.chatbot';
import './lib/i18n/locales/en.landlord';
import './lib/i18n/locales/hi.landlord';
import './lib/i18n/locales/en.equipment';
import './lib/i18n/locales/hi.equipment';
import './lib/i18n/locales/en.academy';
import './lib/i18n/locales/hi.academy';
import './lib/i18n/locales/en.instructor';
import './lib/i18n/locales/hi.instructor';
import './lib/i18n/locales/en.emarket';
import './lib/i18n/locales/hi.emarket';
import './lib/i18n/locales/en.gyan';
import './lib/i18n/locales/hi.gyan';
import './lib/i18n/locales/en.news';
import './lib/i18n/locales/hi.news';
import './lib/i18n/locales/en.channels';
import './lib/i18n/locales/hi.channels';
import './lib/i18n/locales/en.advisory';
import './lib/i18n/locales/hi.advisory';
import './lib/i18n/locales/en.marketplace';
import './lib/i18n/locales/hi.marketplace';
import './lib/i18n/locales/en.schemes';
import './lib/i18n/locales/hi.schemes';
import './lib/i18n/locales/en.finance';
import './lib/i18n/locales/hi.finance';
import './lib/i18n/locales/en.insurance';
import './lib/i18n/locales/hi.insurance';
import './lib/i18n/locales/en.landRecords';
import './lib/i18n/locales/hi.landRecords';
import './lib/i18n/locales/en.fpo';
import './lib/i18n/locales/hi.fpo';
import './lib/i18n/locales/en.postHarvest';
import './lib/i18n/locales/hi.postHarvest';
import './lib/i18n/locales/en.water';
import './lib/i18n/locales/hi.water';
import './lib/i18n/locales/en.climate';
import './lib/i18n/locales/hi.climate';
import './lib/i18n/locales/en.tree';
import './lib/i18n/locales/hi.tree';
import './lib/i18n/locales/en.gamification';
import './lib/i18n/locales/hi.gamification';
import './lib/i18n/locales/en.referrals';
import './lib/i18n/locales/hi.referrals';
import './lib/i18n/locales/en.women';
import './lib/i18n/locales/hi.women';
import { initSentry } from './lib/observability';
import { initAnalytics } from './lib/analytics';
import { registerSW } from 'virtual:pwa-register';
import './theme/tokens.css';
import './theme/layout.css';

initSentry();
initAnalytics();

// WS-06: register the PWA service worker (auto-update).
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
