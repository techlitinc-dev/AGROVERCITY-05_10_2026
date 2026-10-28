/**
 * AGROVERCITY typed API layer.
 *
 * Conventions (all parallel view work MUST rely on these):
 *  1. Every call goes through the helpers in `./http`, which implement
 *     `try { real call } catch (e) { handleApiError(e) }` and throw an
 *     `ApiError` (with `code` from `error.response.data.error.code`).
 *  2. Reads may fall back to MOCK constants ONLY when `import.meta.env.DEV`.
 *  3. Writes/mutations ALWAYS throw on failure — never fake success on a POST.
 *  4. List endpoints unwrap the `{data, page, pageSize, total}` envelope to a
 *     plain array (`readList`); use `readPaged` when pagination matters.
 *  5. Path params are method args, e.g. `purchases.advance(id, body)`.
 */

// --- infra ---
export { apiClient } from './client';
export { ApiError, handleApiError, apiErrorMessage } from './errors';
export {
  DEV,
  unwrapList,
  unwrapItems,
  unwrapPaged,
  readOne,
  readList,
  readItems,
  readPaged,
  mutate,
  post,
  put,
  patch,
  del,
  download,
} from './http';
export type { Paged, Params, MutateOpts } from './http';

// --- mocks (dev-only fallbacks; unchanged data) ---
export {
  INITIAL_USER,
  MOCK_MANDI_PRICES,
  MOCK_PRODUCE_LOTS,
  MOCK_BUYER_DEMANDS,
  MOCK_TRADE_OFFERS,
  MOCK_PURCHASES,
  MOCK_SUPPLY_CONTRACTS,
  MOCK_FARM_DIARY,
  MOCK_EQUIPMENT,
  MOCK_LOANS,
  MOCK_INSURANCE_CLAIMS,
  MOCK_LAND_RECORDS,
  MOCK_LAND_LEASES,
  MOCK_MILK_SLIPS,
  MOCK_MALL_PRODUCTS,
  MOCK_NOTIFICATIONS,
} from './mocks';

// --- domains ---
export { auth } from './auth';
export type { AuthTokens, OtpSendResult, OtpVerifyResult, RegisterResult } from './auth';
export { users } from './users';
export type { UserSettings, UserConsents } from './users';
export { mandi } from './mandi';
export { lots } from './lots';
export { demands } from './demands';
export { offers } from './offers';
export * as leads from './leads';
export type { Lead, LeadContact, LeadStatus, LeadCreateResult } from './leads';
export { purchases } from './purchases';
export { contracts } from './contracts';
export { transport } from './transport';
export { diary } from './diary';
export { pnl } from './pnl';
export { equipment } from './equipment';
export { equipmentOwner } from './equipmentOwner';
export { finance } from './finance';
export { loans } from './loans';
export { insurance } from './insurance';
export { landRecords } from './landRecords';
export { schemes } from './schemes';
export { vault } from './vault';
export { water } from './water';
export { land } from './land';
export { seller } from './seller';
export { directBuyer } from './directBuyer';
export { broker } from './broker';
export { dairy } from './dairy';
export { milkSeller } from './milkSeller';
export { livestock } from './livestock';
export { courses } from './courses';
export { teachers } from './teachers';
export { mall } from './mall';
export { customer } from './customer';
export { gamification } from './gamification';
export { referrals } from './referrals';
export { content } from './content';
export { chatbot } from './chatbot';
export { chat } from './chat';
export { notifications } from './notifications';
export { fpo } from './fpo';
export { gruhUdyog } from './gruhUdyog';
export { postHarvest } from './postHarvest';
export { intelligence } from './intelligence';
export { priceAlerts } from './priceAlerts';
export { kyc } from './kyc';
export { bankAccounts } from './bankAccounts';
export { billing } from './billing';
export { admin } from './admin';
export { support } from './support';
export { uploads } from './uploads';
export { calls } from './calls';
export { tree } from './tree';
export { nursery } from './nursery';
export { women } from './women';
export { search } from './search';
export { dashboard } from './dashboard';
export { analytics } from './analytics';
export { ads } from './ads';
export { appConfig } from './appConfig';
export { advisory } from './advisory';
export { farmerCrops } from './farmerCrops';
export { ratings } from './ratings';
export { exporter } from './exporter';
export { pickup } from './pickup';

import { auth } from './auth';
import { mandi } from './mandi';
import { lots } from './lots';
import { demands } from './demands';
import { offers } from './offers';
import { purchases } from './purchases';
import { transport } from './transport';
import { diary } from './diary';
import { mall } from './mall';
import type { BuyerDemand, ProduceLot, TradeOffer } from '../../types';

/**
 * Legacy flat `api.*` aliases — kept so existing views keep compiling while
 * they are being rewired to the domain namespaces. New code should import the
 * namespaces directly (`import { purchases } from '@/lib/api'`).
 *
 * NOTE (C1/C2/C3 fixes baked in):
 *  - OTP now hits `/auth/otp/send` + `/auth/otp/verify` and returns the real
 *    `{accessToken, refreshToken, user}` contract — no fabricated `token`.
 *  - getMallProducts now hits `/products` (was the nonexistent `/marketplace/products`).
 *  - Mutations no longer silently fall back to mocks; they throw ApiError.
 */
export const api = {
  // Auth & Profile
  requestOtp: auth.requestOtp,
  verifyOtp: auth.verifyOtp,
  verifyMpin: async (mpin: string): Promise<boolean> => (await auth.verifyMpin(mpin)).verified,

  // Mandi
  getMandiPrices: mandi.prices,

  // Lots
  getProduceLots: lots.list,
  createProduceLot: (lotData: Partial<ProduceLot>) => lots.create(lotData),

  // Demands
  getBuyerDemands: (params?: Record<string, unknown>): Promise<BuyerDemand[]> =>
    demands.list({ status: 'open', ...params }),

  // Offers
  getOffers: offers.mine,
  sendOffer: (offerData: Partial<TradeOffer>) => offers.create(offerData),

  // Purchases
  getPurchases: purchases.list,

  // Transport
  getVehicles: transport.vehicles,
  getTransportBookings: transport.bookings,

  // Farm Diary
  getFarmDiary: diary.entries,

  // Mall Products (C2 fix: /products)
  getMallProducts: mall.products,
};
