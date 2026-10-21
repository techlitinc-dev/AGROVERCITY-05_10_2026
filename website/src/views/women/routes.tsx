import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const DirectoryView = lazy(() => import('./DirectoryView').then((m) => ({ default: m.DirectoryView })));

/** Women SHG economy — farmer-facing surfaces (the hub itself lives under /community). */
export const WomenRouteElements = () => (
  <>
    <Route path="/women/directory" element={<DirectoryView />} />
  </>
);
