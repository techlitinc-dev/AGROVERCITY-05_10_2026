import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './lib/i18n/locales/en';
import './lib/i18n/locales/hi';
import './lib/i18n/locales/mr';
import './lib/i18n/locales/gu';
import './lib/i18n/locales/pa';
import './lib/i18n/locales/te';
import './lib/i18n/locales/ta';
import './lib/i18n/locales/as';
import './lib/i18n/locales/bn';
import './lib/i18n/locales/bho';
import './lib/i18n/locales/brx';
import './lib/i18n/locales/doi';
import './lib/i18n/locales/kn';
import './lib/i18n/locales/ks';
import './lib/i18n/locales/kok';
import './lib/i18n/locales/mai';
import './lib/i18n/locales/ml';
import './lib/i18n/locales/mni';
import './lib/i18n/locales/ne';
import './lib/i18n/locales/or';
import './lib/i18n/locales/sa';
import './lib/i18n/locales/sat';
import './lib/i18n/locales/sd';
import './lib/i18n/locales/ur';
import './lib/i18n/locales/en.trade';
import './lib/i18n/locales/hi.trade';
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
import { initSentry } from './lib/observability';
import './theme/tokens.css';
import './theme/layout.css';

initSentry();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
