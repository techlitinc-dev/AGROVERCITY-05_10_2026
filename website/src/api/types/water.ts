export interface WaterScheduleItem {
  plotName: string;
  moisturePercent: number;
  recommendedMinutes: number;
  method: string;
}

export interface Groundwater {
  depthMeters: number;
  zone: 'safe' | 'semiCritical' | 'critical';
  measuredAt: string;
}

export interface CanalRotation {
  canalName: string;
  nextDate: string;
  slotTime: string;
}

export interface PmksyCalcRes {
  totalCost: number;
  subsidyPercent: number;
  subsidyAmount: number;
  farmerShare: number;
}
