import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const SuperadminMasterConsole = lazy(() => import('./SuperadminMasterConsole').then((m) => ({ default: m.SuperadminMasterConsole })));

/** 13. Superadmin Platform Master Console (SOP 01-27 + console home / approvals / audit desks) */
export const AdminRouteElements = () => (
  <>
    <Route path="/superadmin" element={<SuperadminMasterConsole />} />
    <Route path="/superadmin/sop/:sopId" element={<SuperadminMasterConsole />} />
    <Route path="/superadmin/panel/:panelId" element={<SuperadminMasterConsole />} />
    <Route path="/admin" element={<SuperadminMasterConsole />} />
    <Route path="/admin/sop/:sopId" element={<SuperadminMasterConsole />} />
    <Route path="/admin/panel/:panelId" element={<SuperadminMasterConsole />} />
  </>
);
