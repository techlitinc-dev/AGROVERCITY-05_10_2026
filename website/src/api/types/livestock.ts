export interface GaushalaItem {
  id: string;
  name: string;
  vernacularName: string;
  trustName: string;
  address: string;
  district: string;
  distanceKm: number;
  cowCount: number;
  breeds: string[];
  phone: string;
  providesOrganicManure: boolean;
  offersCowAdoption: boolean;
  rating: number;
  facilities: string;
}

export interface PlantNursery {
  id: string;
  name: string;
  vernacularName: string;
  ownerName: string;
  location: string;
  distanceKm: number;
  phone: string;
  rating: number;
  isGovtCertified: boolean;
  availableSaplings: string[];
  priceRange: string;
}

export interface VetDoctor {
  id: string;
  name: string;
  qualification: string;
  specialization: string;
  clinicAddress: string;
  distanceKm: number;
  phone: string;
  experienceYears: number;
  consultationFeeRupees: number;
  rating: number;
  availableForFarmVisit: boolean;
  nextAvailableSlot: string;
}

export interface DairyProductItem {
  id: string;
  title: string;
  vernacularTitle: string;
  farmName: string;
  category: string;
  price: number;
  rating: number;
  unit: string;
  reviewsCount: number;
  purityCertification: string;
  inStock: boolean;
  description: string;
}
