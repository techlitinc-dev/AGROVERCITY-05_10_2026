export type ContractStatus = 'open' | 'accepted' | 'active' | 'completed' | 'expired';

export interface BuyerContract {
  id: string;
  buyerCompany: string;
  buyerRating: number;
  crop: string;
  lockedRateQuintal: number;
  mspCurrentRate: number;
  premiumAboveMSP: number;
  minQuantityQuintals: number;
  deliveryLocation: string;
  paymentTerms: string;
  status: ContractStatus;
  contractDuration: string;
}

export interface ContractDetail extends BuyerContract {
  termsDocument: string;
}

export interface AcceptContractBody {
  signatureData: string;
  consentTimestamp: string;
  mpin: string;
}
