import { api } from './client';

export type BuyerOrgRole = 'admin' | 'procurement' | 'qa' | 'finance';

export interface BuyerOrgMember {
  uid: string;
  name: string;
  phone: string;
  role: BuyerOrgRole;
  addedAt: string;
}

export interface BuyerOrg {
  id: string;
  adminUid: string;
  companyName: string;
  members: BuyerOrgMember[];
  createdAt?: string;
  updatedAt?: string;
}

export async function getOrg(): Promise<BuyerOrg> {
  const { data } = await api.get<BuyerOrg>('/buyer-org');
  return data;
}

export async function inviteMember(payload: {
  phone: string;
  role: BuyerOrgRole;
}): Promise<{ ok: boolean; org: BuyerOrg; member: { uid: string; role: BuyerOrgRole } }> {
  const { data } = await api.post<{ ok: boolean; org: BuyerOrg; member: { uid: string; role: BuyerOrgRole } }>(
    '/buyer-org/invite',
    payload
  );
  return data;
}

export async function removeMember(uid: string): Promise<{ ok: boolean; members: BuyerOrgMember[] }> {
  const { data } = await api.delete<{ ok: boolean; members: BuyerOrgMember[] }>(
    `/buyer-org/members/${uid}`
  );
  return data;
}
