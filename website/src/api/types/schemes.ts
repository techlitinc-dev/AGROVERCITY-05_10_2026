export interface GovtScheme {
  id: string;
  name: string;
  vernacularName?: string;
  category: string;
  eligible: boolean;
  benefitAmount: number;
  documentsRequired: string[];
  status: 'open' | 'closingSoon' | 'closed';
  nextDeadline: string;
  description: string;
}

export interface SchemePortal {
  schemeId: string;
  portalUrl: string;
}

export interface VaultDocument {
  id: string;
  type: 'aadhaar' | 'landRecord712' | 'bankPassbook' | 'soilHealthCard' | 'other';
  name: string;
  fileUrl: string;
  uploadedAt: string;
  encryption: string;
}

export interface SchemeApplyBody {
  documentIds: string[];
}
