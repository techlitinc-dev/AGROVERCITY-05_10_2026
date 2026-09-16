export interface FpoProfile {
  id: string;
  name: string;
  memberCount: number;
  district: string;
}

export interface FpoPool {
  id: string;
  item: string;
  bookedUnits: number;
  targetUnits: number;
  discountPercent: number;
  deadline: string;
}

export interface FpoNearby {
  id: string;
  name: string;
  district: string;
  memberCount: number;
  crops: string[];
  distanceKm: number;
  verified: boolean;
}

export interface FpoMembership {
  state: 'none' | 'pending' | 'member';
  fpoId: string | null;
  requestId: string | null;
}

export interface FpoJoinRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
}
