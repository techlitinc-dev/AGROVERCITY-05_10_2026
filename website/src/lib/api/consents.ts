import { api } from './client';

/** Consent center (WS-04 X17) — mirrors backend/app/models/consents.py. */

export interface Consents {
  dataSharing: boolean;
  location: boolean;
  marketing: boolean;
  updatedAt?: string;
}

export async function getConsents(): Promise<Consents> {
  const { data } = await api.get<Consents>('/users/me/consents');
  return data;
}

export async function putConsents(consents: Consents): Promise<Consents> {
  const { data } = await api.put<Consents>('/users/me/consents', {
    dataSharing: consents.dataSharing,
    location: consents.location,
    marketing: consents.marketing,
  });
  return data;
}
