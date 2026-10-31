import React from 'react';
import { Route } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { ProfileSwitchPage } from './ProfileSwitchPage';
import { KycCallbackPage } from './KycCallbackPage';
import { MockDigiLockerPage } from './MockDigiLockerPage';

/** Auth routes — login (OTP/MPIN), registration wizard (mobile → profile →
 * KYC → complete), KYC callback, and the internal mock DigiLocker screen. */
export const AuthRouteElements = () => (
  <>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/onboarding" element={<RegisterPage />} />
    <Route path="/profiles" element={<ProfileSwitchPage />} />
    <Route path="/kyc/callback" element={<KycCallbackPage />} />
    <Route path="/mock-digilocker" element={<MockDigiLockerPage />} />
  </>
);
