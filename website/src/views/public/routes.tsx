import React from 'react';
import { Route } from 'react-router-dom';
import { LandingPage } from './LandingPage';
import { LegalPage } from './LegalPage';

/** Public & landing routes. */
export const PublicRouteElements = () => (
  <>
    <Route path="/" element={<LandingPage />} />
    <Route path="/legal" element={<LegalPage />} />
  </>
);
