import type { PersonaType } from '../types';

/**
 * Mapping of backend, mobile, and legacy persona aliases to canonical website PersonaType.
 */
export const PERSONA_ALIASES: Record<string, PersonaType> = {
  // Farm Landlord aliases
  farmLandlord: 'landlord',
  farm_landlord: 'landlord',
  'farm landlord': 'landlord',
  farmlandlord: 'landlord',
  landlord: 'landlord',

  // Equipment Owner aliases
  equipmentRental: 'equipmentOwner',
  equipment_rental: 'equipmentOwner',
  'equipment rental': 'equipmentOwner',
  equipmentrental: 'equipmentOwner',
  equipmentOwner: 'equipmentOwner',
  equipment_owner: 'equipmentOwner',
  'equipment owner': 'equipmentOwner',
  equipmentowner: 'equipmentOwner',

  // Transporter aliases
  transport: 'transporter',
  transporter: 'transporter',

  // Instructor aliases
  teacher: 'instructor',
  instructor: 'instructor',
  admin: 'superadmin',
  superadmin: 'superadmin',

  // Core personas
  farmer: 'farmer',
  seller: 'seller',
  broker: 'broker',
  dairyManager: 'dairyManager',
  dairymanager: 'dairyManager',
  milkSeller: 'milkSeller',
  milkseller: 'milkSeller',
  vet: 'vet',
  fpoManager: 'fpoManager',
  fpomanager: 'fpoManager',
  womenShg: 'womenShg',
  womenshg: 'womenShg',
  exporter: 'exporter',
  directBuyer: 'directBuyer',
  directbuyer: 'directBuyer',
  customer: 'customer',
  bankManager: 'bankManager',
  bankmanager: 'bankManager',
  insuranceProvider: 'insuranceProvider',
  insuranceprovider: 'insuranceProvider',
  coldStorageProvider: 'coldStorageProvider',
  coldstorageprovider: 'coldStorageProvider',
  coldstorage: 'coldStorageProvider',
  gaushalaManager: 'gaushalaManager',
  gaushalamanager: 'gaushalaManager',
  nursery: 'nursery',
  plant_nursery: 'nursery',
  'plant nursery': 'nursery',
  plantnursery: 'nursery',
};

export function normalizePersona(raw: unknown): PersonaType {
  if (!raw || typeof raw !== 'string') return 'farmer';
  const clean = raw.trim();
  if (PERSONA_ALIASES[clean]) return PERSONA_ALIASES[clean];
  const lower = clean.toLowerCase();
  if (PERSONA_ALIASES[lower]) return PERSONA_ALIASES[lower];
  const compact = lower.replace(/[\s_-]+/g, '');
  if (PERSONA_ALIASES[compact]) return PERSONA_ALIASES[compact];
  return (clean as PersonaType) || 'farmer';
}

/**
 * Checks if a target persona is in the user's linked list or active,
 * normalizing all candidate strings so backend aliases like 'farmLandlord'
 * correctly match website 'landlord'.
 */
export function isPersonaLinked(
  linkedList: (PersonaType | string)[] | undefined,
  target: PersonaType | string,
  active?: PersonaType | string
): boolean {
  const normTarget = normalizePersona(target);
  if (active && normalizePersona(active) === normTarget) {
    return true;
  }
  if (!Array.isArray(linkedList)) return false;
  return linkedList.some((item) => normalizePersona(item) === normTarget);
}

/** Canonical platform personas — the visibility/settings surface renders these. */
export const ALL_PERSONAS: { id: PersonaType; label: string; icon: string }[] = [
  { id: 'farmer', label: 'Farmer / Kisan', icon: '🌾' },
  { id: 'landlord', label: 'Farm Landlord', icon: '🏡' },
  { id: 'transporter', label: 'Transporter / Gadi', icon: '🚚' },
  { id: 'seller', label: 'Agri Vyapari', icon: '🏪' },
  { id: 'equipmentOwner', label: 'Equipment Owner', icon: '🚜' },
  { id: 'exporter', label: 'Agri Exporter', icon: '🚢' },
  { id: 'milkSeller', label: 'Milk Vendor / Doodh Vala', icon: '🫗' },
  { id: 'vet', label: 'Veterinary Doctor', icon: '🩺' },
  { id: 'fpoManager', label: 'FPO / Cooperative Leader', icon: '🌾' },
  { id: 'womenShg', label: 'Mahila Gruh Udyog & SHG', icon: '🪔' },
  { id: 'directBuyer', label: 'Direct Buyer', icon: '🏢' },
  { id: 'broker', label: 'Agri Broker / Dalal', icon: '🤝' },
  { id: 'dairyManager', label: 'Dudh Dairy Manager', icon: '🥛' },
  { id: 'instructor', label: 'Gurukul Instructor', icon: '🎓' },
  { id: 'bankManager', label: 'Bank Loan Manager', icon: '🏦' },
  { id: 'insuranceProvider', label: 'Crop Insurance Desk', icon: '📑' },
  { id: 'coldStorageProvider', label: 'Cold Storage Owner', icon: '❄️' },
  { id: 'gaushalaManager', label: 'Gaushala & Sanctuary', icon: '🐄' },
  { id: 'nursery', label: 'Plant Nursery', icon: '🌱' },
  { id: 'customer', label: 'E-Market Customer', icon: '🛍️' },
  { id: 'superadmin', label: 'Superadmin Platform Ops', icon: '⚡' },
];

/**
 * A persona is enabled unless the user explicitly hid it. Hiding is a display
 * switch — the profile and its data stay linked.
 */
export function isPersonaEnabled(
  disabledList: (PersonaType | string)[] | undefined,
  target: PersonaType | string
): boolean {
  const normTarget = normalizePersona(target);
  if (!Array.isArray(disabledList)) return true;
  return !disabledList.some((item) => normalizePersona(item) === normTarget);
}

/** Home route per persona — single source for login redirects, deep links, etc. */
export const PERSONA_HOME: Record<PersonaType, string> = {
  farmer: '/farmer',
  landlord: '/landlord',
  transporter: '/transporter',
  seller: '/seller',
  equipmentOwner: '/equipment',
  exporter: '/exporter',
  milkSeller: '/milkSeller',
  vet: '/vet',
  womenShg: '/womenShg',
  broker: '/broker',
  dairyManager: '/dairyManager',
  instructor: '/instructor',
  directBuyer: '/directBuyer',
  customer: '/customer',
  bankManager: '/bankManager',
  insuranceProvider: '/insuranceProvider',
  coldStorageProvider: '/coldStorageProvider',
  gaushalaManager: '/gaushalaManager',
  nursery: '/nursery',
  fpoManager: '/fpoManager',
  superadmin: '/superadmin',
};

export function personaHome(persona: PersonaType | string | undefined): string {
  return PERSONA_HOME[normalizePersona(persona)] || '/farmer';
}
