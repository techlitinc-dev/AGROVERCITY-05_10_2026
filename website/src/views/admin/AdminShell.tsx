import { NavLink, Outlet } from 'react-router-dom';
import { useT } from '../../lib/i18n';
import { useSessionStore } from '../../stores/session';
import '../../theme/admin.css';

export type AdminGroup = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

export interface AdminModule {
  path: string;
  labelKey: string;
  roles: string[];
  group: AdminGroup;
}

/** All 27 superadmin modules (superadmin-instructions.md §3) plus the
 * cross-cutting console surfaces (broadcast, moderation, consents, disputes,
 * insurance rates, AI health). `roles` gates the nav entry client-side; the
 * backend enforces the same tiers server-side. */
export const ADMIN_MODULES: AdminModule[] = [
  // P1 — security
  { path: '/admin/auth', labelKey: 'admin.nav.auth', roles: ['superadmin', 'compliance_officer'], group: 'P1' },
  { path: '/admin/users', labelKey: 'admin.nav.users', roles: ['superadmin', 'operations_lead'], group: 'P1' },
  { path: '/admin/kyc', labelKey: 'admin.nav.kyc', roles: ['superadmin', 'compliance_officer'], group: 'P1' },
  { path: '/admin/config', labelKey: 'admin.nav.config', roles: ['superadmin', 'operations_lead'], group: 'P1' },
  { path: '/admin/broadcasts', labelKey: 'admin.nav.broadcasts', roles: ['superadmin', 'operations_lead'], group: 'P1' },
  { path: '/admin/moderation', labelKey: 'admin.nav.moderation', roles: ['superadmin', 'compliance_officer'], group: 'P1' },
  { path: '/admin/consents', labelKey: 'admin.nav.consents', roles: ['superadmin', 'compliance_officer'], group: 'P1' },
  // P2 — commercial
  { path: '/admin/mandi', labelKey: 'admin.nav.mandi', roles: ['superadmin', 'operations_lead', 'finance_admin'], group: 'P2' },
  { path: '/admin/lots', labelKey: 'admin.nav.lots', roles: ['superadmin', 'operations_lead', 'finance_admin'], group: 'P2' },
  { path: '/admin/orders', labelKey: 'admin.nav.orders', roles: ['superadmin', 'operations_lead', 'finance_admin'], group: 'P2' },
  { path: '/admin/buyers', labelKey: 'admin.nav.buyers', roles: ['superadmin', 'operations_lead'], group: 'P2' },
  { path: '/admin/fleet', labelKey: 'admin.nav.fleet', roles: ['superadmin', 'operations_lead'], group: 'P2' },
  { path: '/admin/equipment', labelKey: 'admin.nav.equipment', roles: ['superadmin', 'operations_lead'], group: 'P2' },
  { path: '/admin/diary', labelKey: 'admin.nav.diary', roles: ['superadmin', 'operations_lead'], group: 'P2' },
  { path: '/admin/settlements', labelKey: 'admin.nav.settlements', roles: ['superadmin', 'finance_admin', 'operations_lead'], group: 'P2' },
  // P3 — agronomy / AI
  { path: '/admin/land', labelKey: 'admin.nav.land', roles: ['superadmin', 'operations_lead', 'compliance_officer'], group: 'P3' },
  { path: '/admin/advisory', labelKey: 'admin.nav.advisory', roles: ['superadmin', 'agronomist', 'scientist'], group: 'P3' },
  { path: '/admin/chatbot', labelKey: 'admin.nav.chatbot', roles: ['superadmin', 'agronomist', 'scientist', 'content_moderator'], group: 'P3' },
  { path: '/admin/land-records', labelKey: 'admin.nav.landrecords', roles: ['superadmin', 'agronomist', 'operations_lead'], group: 'P3' },
  { path: '/admin/water', labelKey: 'admin.nav.water', roles: ['superadmin', 'operations_lead'], group: 'P3' },
  { path: '/admin/cold-storage', labelKey: 'admin.nav.climate', roles: ['superadmin', 'operations_lead'], group: 'P3' },
  { path: '/admin/disputes', labelKey: 'admin.nav.disputes', roles: ['superadmin', 'compliance_officer', 'finance_admin', 'operations_lead'], group: 'P3' },
  // P4 — financial
  { path: '/admin/banking', labelKey: 'admin.nav.banking', roles: ['superadmin', 'finance_admin', 'compliance_officer'], group: 'P4' },
  { path: '/admin/loans', labelKey: 'admin.nav.loans', roles: ['superadmin', 'finance_admin'], group: 'P4' },
  { path: '/admin/insurance', labelKey: 'admin.nav.insurance', roles: ['superadmin', 'finance_admin', 'compliance_officer'], group: 'P4' },
  { path: '/admin/insurance-rates', labelKey: 'admin.nav.rates', roles: ['superadmin', 'finance_admin'], group: 'P4' },
  // P5 — ecosystem
  { path: '/admin/fpos', labelKey: 'admin.nav.fpos', roles: ['superadmin', 'operations_lead'], group: 'P5' },
  { path: '/admin/vets', labelKey: 'admin.nav.vets', roles: ['superadmin', 'operations_lead'], group: 'P5' },
  { path: '/admin/content', labelKey: 'admin.nav.content', roles: ['superadmin', 'content_moderator'], group: 'P5' },
  { path: '/admin/trees', labelKey: 'admin.nav.trees', roles: ['superadmin', 'operations_lead', 'content_moderator'], group: 'P5' },
  { path: '/admin/gamification', labelKey: 'admin.nav.gamification', roles: ['superadmin', 'content_moderator', 'finance_admin'], group: 'P5' },
  { path: '/admin/shgs', labelKey: 'admin.nav.shg', roles: ['superadmin', 'operations_lead', 'finance_admin'], group: 'P5' },
  { path: '/admin/courses', labelKey: 'admin.nav.courses', roles: ['superadmin', 'compliance_officer'], group: 'P5' },
  // Cross-cutting
  { path: '/admin/ai-health', labelKey: 'admin.nav.aihealth', roles: ['superadmin', 'compliance_officer', 'finance_admin', 'agronomist', 'operations_lead', 'content_moderator'], group: 'P5' },
];

const GROUP_ORDER: AdminGroup[] = ['P1', 'P2', 'P3', 'P4', 'P5'];
const GROUP_LABEL: Record<AdminGroup, string> = {
  P1: 'admin.nav.group.p1',
  P2: 'admin.nav.group.p2',
  P3: 'admin.nav.group.p3',
  P4: 'admin.nav.group.p4',
  P5: 'admin.nav.group.p5',
};

export function getAdminRole(user: Record<string, unknown> | null | undefined): string | null {
  if (!user) return null;
  const role = user.adminRole ?? user.role;
  if (typeof role === 'string' && role.length > 0) return role;
  if (user.isAdmin === true || user.activeProfile === 'admin') return 'superadmin';
  return null;
}

export function roleAllowed(role: string | null, roles: string[]): boolean {
  if (!role) return false;
  if (role === 'superadmin' || role === 'scientist') return true;
  return roles.includes(role);
}

export function RequireAdminRole({
  roles,
  children,
}: {
  roles: string[];
  children: React.ReactNode;
}) {
  const t = useT();
  const user = useSessionStore((s) => s.user);
  const role = getAdminRole(user as unknown as Record<string, unknown> | null);
  if (!roleAllowed(role, roles)) {
    return (
      <div className="admin-content">
        <h2 className="admin-error">{t('admin.forbidden')}</h2>
      </div>
    );
  }
  return <>{children}</>;
}

export default function AdminShell() {
  const t = useT();
  const user = useSessionStore((s) => s.user);
  const role = getAdminRole(user as unknown as Record<string, unknown> | null);

  return (
    <div className="admin-shell">
      <nav className="admin-nav">
        <h1>{t('admin.shell.title')}</h1>
        {GROUP_ORDER.map((group) => {
          const entries = ADMIN_MODULES.filter(
            (m) => m.group === group && roleAllowed(role, m.roles)
          );
          if (entries.length === 0) return null;
          return (
            <div className="admin-nav-group" key={group}>
              <p className="admin-nav-group-label">{t(GROUP_LABEL[group])}</p>
              {entries.map((m) => (
                <NavLink
                  key={m.path}
                  to={m.path}
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  {t(m.labelKey)}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}
