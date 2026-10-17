import React from 'react';
import { Route } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { ProfileSwitchPage } from './ProfileSwitchPage';

/** Auth routes — login (OTP/MPIN), register wizard, persona switcher. */
export const AuthRouteElements = () => (
  <>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/profiles" element={<ProfileSwitchPage />} />
  </>
);
