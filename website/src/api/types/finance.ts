export interface CreditScore {
  kisanCreditScore: number;
  creditTier: string;
  creditLimit: number;
  factors: string[];
}

export interface LoanCalcBody {
  amount: number;
  tenureMonths: number;
  interestRate: number;
}

export interface LoanQuote {
  emi: number;
  totalInterest: number;
  totalPayable: number;
}

export interface Kcc {
  bankName: string;
  cardNumberMasked: string;
  kccLimit: number;
  availableLimit: number;
}

export interface LoanApplyBody {
  amount: number;
  tenureMonths: number;
  purpose: string;
}

export type LoanStatus = 'underReview' | 'approved' | 'disbursed' | 'rejected';

export interface Loan {
  id: string;
  type: 'kcc' | 'cropLoan' | 'machinery' | 'vehicle';
  amountRupees: number;
  appliedOn: string;
  status: LoanStatus;
  statusText: string;
  bankRefNo: string | null;
  expectedDisbursal: string | null;
  history: { status: LoanStatus; at: string }[];
}
