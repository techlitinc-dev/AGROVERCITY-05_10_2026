export type AdminRole =
  | 'superadmin'
  | 'operations_lead'
  | 'finance_admin'
  | 'compliance_officer'
  | 'agronomist'
  | 'content_moderator';

export interface AdminUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  adminRole: AdminRole;
  isAdmin: boolean;
  activeProfile?: string;
  primaryProfile?: string;
  status: string;
  language?: string;
}

export type Permission =
  // Farmer
  | 'farmer:read'
  | 'farmer:modify'
  | 'farmer:moderate_lots'
  | 'farmer:approve_rates'
  | 'farmer:soil_advisory'
  // Transporter
  | 'transporter:read'
  | 'transporter:verify_fleet'
  | 'transporter:override_trip'
  | 'transporter:suspend'
  // Vyapari
  | 'vyapari:read'
  | 'vyapari:approve_rates'
  | 'vyapari:manage_deals'
  | 'vyapari:verify_buyer'
  | 'vyapari:escrow_release'
  // Mahila Graha Udyog
  | 'mahila:read'
  | 'mahila:verify_shg'
  | 'mahila:verify_cert'
  | 'mahila:disburse_subsidy'
  // Nursery
  | 'nursery:read'
  | 'nursery:verify'
  | 'nursery:moderate_plants'
  | 'nursery:manage_sapling_requests'
  // eMarket Customer
  | 'customer:read'
  | 'customer:refund_orders'
  | 'customer:moderate_products'
  | 'customer:moderate_ads'
  // RBAC
  | 'rbac:manage_users'
  | 'rbac:view_audit';

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  superadmin: [
    'farmer:read', 'farmer:modify', 'farmer:moderate_lots', 'farmer:approve_rates', 'farmer:soil_advisory',
    'transporter:read', 'transporter:verify_fleet', 'transporter:override_trip', 'transporter:suspend',
    'vyapari:read', 'vyapari:approve_rates', 'vyapari:manage_deals', 'vyapari:verify_buyer', 'vyapari:escrow_release',
    'mahila:read', 'mahila:verify_shg', 'mahila:verify_cert', 'mahila:disburse_subsidy',
    'nursery:read', 'nursery:verify', 'nursery:moderate_plants', 'nursery:manage_sapling_requests',
    'customer:read', 'customer:refund_orders', 'customer:moderate_products', 'customer:moderate_ads',
    'rbac:manage_users', 'rbac:view_audit',
  ],
  operations_lead: [
    'farmer:read', 'farmer:moderate_lots', 'farmer:approve_rates',
    'transporter:read', 'transporter:verify_fleet', 'transporter:override_trip', 'transporter:suspend',
    'vyapari:read', 'vyapari:manage_deals', 'vyapari:verify_buyer',
    'mahila:read',
    'nursery:read', 'nursery:verify', 'nursery:manage_sapling_requests',
    'customer:read', 'customer:moderate_products',
    'rbac:view_audit',
  ],
  finance_admin: [
    'farmer:read', 'farmer:approve_rates',
    'transporter:read',
    'vyapari:read', 'vyapari:approve_rates', 'vyapari:escrow_release',
    'mahila:read', 'mahila:disburse_subsidy',
    'nursery:read',
    'customer:read', 'customer:refund_orders',
    'rbac:view_audit',
  ],
  compliance_officer: [
    'farmer:read', 'farmer:modify',
    'transporter:read', 'transporter:verify_fleet', 'transporter:suspend',
    'vyapari:read', 'vyapari:verify_buyer',
    'mahila:read', 'mahila:verify_shg', 'mahila:verify_cert',
    'nursery:read', 'nursery:verify',
    'customer:read',
    'rbac:view_audit',
  ],
  agronomist: [
    'farmer:read', 'farmer:moderate_lots', 'farmer:soil_advisory',
    'nursery:read', 'nursery:moderate_plants', 'nursery:manage_sapling_requests',
    'mahila:read',
    'customer:read',
    'rbac:view_audit',
  ],
  content_moderator: [
    'farmer:read',
    'nursery:read', 'nursery:moderate_plants',
    'customer:read', 'customer:moderate_products', 'customer:moderate_ads',
    'mahila:read',
    'rbac:view_audit',
  ],
};

export const ROLE_INFO: Record<AdminRole, { title: string; color: string; description: string; badgeClass: string }> = {
  superadmin: {
    title: 'Super Administrator',
    color: 'emerald',
    description: 'Unrestricted system governance, destructive clearances, platform config',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  },
  operations_lead: {
    title: 'Operations Lead',
    color: 'blue',
    description: 'Fleet verification, dispatch management, disputes, nursery approvals',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  },
  finance_admin: {
    title: 'Finance Administrator',
    color: 'amber',
    description: 'Escrow releases, customer refunds, commission payouts, subsidies',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  compliance_officer: {
    title: 'Compliance Officer',
    color: 'purple',
    description: 'KYC legal verification, SHG & FSSAI credentials, fraud suspensions',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  },
  agronomist: {
    title: 'Chief Agronomist & Scientist',
    color: 'teal',
    description: 'Produce lot grading, soil laboratory tests, pest radar, sapling certification',
    badgeClass: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
  },
  content_moderator: {
    title: 'Content & Catalog Moderator',
    color: 'rose',
    description: 'Product listing curation, advertisement approvals, customer grievance triage',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  },
};
