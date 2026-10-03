import { api } from './client';
import type { Paged } from './trade';

/**
 * Bank accounts — CRUD + penny-drop verify + set primary.
 * Verified against backend/app/routers/bank_accounts.py. The API never
 * returns full account numbers (masked XXXX…last4 only).
 */

export type BankVerifyStatus = 'unverified' | 'pending' | 'verified' | 'failed';

export interface BankAccount {
  id: string;
  accountHolder: string;
  accountNumberMasked: string;
  ifsc: string;
  bankName: string;
  isPrimary: boolean;
  verifyStatus: BankVerifyStatus;
  createdAt: string;
}

export interface BankAccountPayload {
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
}

export async function listBankAccounts(): Promise<BankAccount[]> {
  const { data } = await api.get<Paged<BankAccount>>('/bank-accounts');
  return data.data;
}

export async function addBankAccount(payload: BankAccountPayload): Promise<BankAccount> {
  const { data } = await api.post<BankAccount>('/bank-accounts', payload);
  return data;
}

export async function verifyBankAccount(accountId: string): Promise<BankAccount> {
  const { data } = await api.post<BankAccount>(`/bank-accounts/${accountId}/verify`);
  return data;
}

export async function setPrimaryBankAccount(
  accountId: string
): Promise<{ primaryId: string }> {
  const { data } = await api.post<{ primaryId: string }>(
    `/bank-accounts/${accountId}/set-primary`
  );
  return data;
}

export async function deleteBankAccount(accountId: string): Promise<void> {
  await api.delete(`/bank-accounts/${accountId}`);
}
