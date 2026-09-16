export interface TreeArticle {
  id: string;
  title: string;
  vernacularTitle: string;
  category: string;
  author: string;
  readTime: string;
  summary: string;
  fullContent: string;
  benefits: string;
  publishedDate: string;
}

export interface NgoOrganization {
  id: string;
  name: string;
  vernacularName: string;
  focusArea: string;
  location: string;
  contactPhone: string;
  email: string;
  treesPlantedCount: number;
  rating: number;
  servicesOffered: string[];
  providesFreeSaplings: boolean;
  websiteUrl: string;
}

export interface BiofuelTree {
  id: string;
  name: string;
  botanicalName: string;
  vernacularName: string;
  oilContentPercent: number;
  gestationPeriod: string;
  expectedReturnPerAcre: number;
  suitability: string;
  uses: string;
  buyerMarket: string;
  subsidyScheme: string;
}

export interface TreeCareGuide {
  id: string;
  title: string;
  vernacularTitle: string;
  stepNumber: number;
  stage: string;
  instructions: string;
  wateringRule: string;
  fertilizerSchedule: string;
  pestProtection: string;
}
