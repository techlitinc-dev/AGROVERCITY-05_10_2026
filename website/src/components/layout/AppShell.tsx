import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  Home,
  LayoutGrid,
  MapPin,
  MessageCircle,
  Plus,
  User,
  Users,
} from 'lucide-react';
import { useSession } from '@/state/SessionContext';
import { useToast } from '@/state/ToastContext';
import { useT } from '@/i18n';
import { PERSONAS } from '@/config/personas';
import { toolsFor } from '@/config/modules';
import { BottomSheet, CoinPill } from '@/components/ui';
import { AssistantHost } from '@/components/assistant/AssistantHost';
import { cx } from '@/lib/format';

function PersonaSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { linkedProfiles, activeProfile, switchProfile } = useSession();
  const { toast } = useToast();
  const t = useT();
  const navigate = useNavigate();

  return (
    <BottomSheet open={open} onClose={onClose} title={t('प्रोफ़ाइल बदलें', 'Switch profile')}>
      <div className="space-y-2">
        {linkedProfiles.map((p) => {
          const meta = PERSONAS[p];
          const active = p === activeProfile;
          return (
            <button
              key={p}
              onClick={() => {
                switchProfile(p);
                toast(`${meta.hi} ${t('प्रोफ़ाइल सक्रिय', 'profile active')}`, 'success');
                onClose();
                navigate(meta.home);
              }}
              className={cx(
                'flex min-h-14 w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
                active ? 'border-primary bg-accent' : 'border-ink/10 bg-white hover:bg-accent/50',
              )}
            >
              <span className={cx('flex h-11 w-11 items-center justify-center rounded-xl', meta.chipClass)}>
                <Users size={20} aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-bold text-ink">{meta.hi}</span>
                <span className="block text-xs text-muted">{meta.en}</span>
              </span>
              {active && <CheckCircle2 size={20} className="text-primary" aria-hidden />}
            </button>
          );
        })}
        <button
          onClick={() => toast(t('प्रोफ़ाइल जोड़ना जल्द आ रहा है', 'Add profile coming soon'), 'info')}
          className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-dashed border-ink/20 p-3 text-muted hover:bg-accent/50"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink/5">
            <Plus size={20} aria-hidden />
          </span>
          <span className="text-sm font-semibold">{t('नई प्रोफ़ाइल जोड़ें', 'Add profile')}</span>
        </button>
      </div>
    </BottomSheet>
  );
}

function AllToolsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeProfile } = useSession();
  const t = useT();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const tools = toolsFor(activeProfile);

  return (
    <BottomSheet open={open} onClose={onClose} title={t('सभी टूल्स', 'All Tools')}>
      <div className="grid grid-cols-3 gap-2">
        {tools.map((tool, i) => {
          const Icon = tool.icon;
          const active = pathname.startsWith(tool.path);
          return (
            <button
              key={tool.path}
              style={{ ['--stagger' as string]: `${i * 30}ms` }}
              onClick={() => {
                onClose();
                navigate(tool.path);
              }}
              className={cx(
                'animate-fade-up flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center transition-colors',
                active ? 'border-primary bg-accent' : 'border-ink/10 bg-white hover:bg-accent/50',
              )}
            >
              <Icon size={24} className={active ? 'text-primary' : 'text-muted'} aria-hidden />
              <span className={cx('text-xs font-semibold leading-tight', active ? 'text-primary' : 'text-ink')}>
                {tool.hi}
              </span>
              <span className="text-[10px] text-muted">{tool.en}</span>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

export function AppShell() {
  const { user, activeProfile, highContrast } = useSession();
  const t = useT();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const persona = PERSONAS[activeProfile];

  const accountLinks = [
    { to: '/account/notifications', hi: 'सूचनाएं', en: 'Notifications' },
    { to: '/account/settings', hi: 'सेटिंग्स', en: 'Settings' },
    { to: '/account/help', hi: 'मदद', en: 'Help & Support' },
    { to: '/account/bookings', hi: 'मेरी बुकिंग', en: 'My Bookings' },
    { to: '/account/chats', hi: 'चैट', en: 'Chats' },
  ];

  const navCls = ({ isActive }: { isActive: boolean }) =>
    cx(
      'flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors',
      isActive ? 'bg-accent text-primary' : 'text-ink hover:bg-accent/60',
    );

  return (
    <div className={cx('min-h-dvh', highContrast && 'hc')}>
      <header className="glass-card sticky top-0 z-50 !rounded-none border-x-0 border-t-0">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <NavLink to={persona.home} className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-extrabold text-white">
              क्षे
            </span>
            <span className="hidden text-sm font-extrabold text-ink sm:block">
              AGROVERCITY <span className="font-medium text-muted">· Kisan Setu</span>
            </span>
          </NavLink>
          {user && (
            <span className="hidden min-h-8 items-center gap-1 rounded-full bg-ink/5 px-2.5 text-xs font-semibold text-muted md:inline-flex">
              <MapPin size={13} aria-hidden />
              {user.village}
            </span>
          )}
          <span className="ml-auto hidden min-h-8 items-center gap-1 rounded-full bg-success/10 px-2.5 text-xs font-semibold text-success sm:inline-flex">
            <CheckCircle2 size={13} aria-hidden />
            {t('सिंक हो गया', 'Synced')}
          </span>
          {user && <CoinPill count={user.agriCoins} className="!min-h-8" />}
          <NavLink
            to="/account/notifications"
            aria-label={t('सूचनाएं', 'Notifications')}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-ink hover:bg-accent"
          >
            <Bell size={20} />
          </NavLink>
          <button
            onClick={() => setSwitcherOpen(true)}
            className={cx('min-h-11 rounded-full px-3 text-sm font-bold', persona.chipClass)}
          >
            {persona.hi}
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 flex-col gap-1 overflow-y-auto p-4 md:flex">
          <NavLink to={persona.home} className={navCls} end>
            <Home size={18} aria-hidden />
            {t('होम', 'Home')}
          </NavLink>
          <button onClick={() => setToolsOpen(true)} className={cx(navCls({ isActive: false }), 'w-full text-left')}>
            <LayoutGrid size={18} aria-hidden />
            {t('सभी टूल्स', 'All Tools')}
          </button>
          <p className="mt-4 px-3 text-xs font-bold uppercase tracking-wide text-muted">
            {t('खाता', 'Account')}
          </p>
          {accountLinks.map((l) => (
            <NavLink key={l.to} to={l.to} className={navCls}>
              {l.hi}
              <span className="text-xs font-normal text-muted">{l.en}</span>
            </NavLink>
          ))}
        </aside>

        <main className="w-full min-w-0 flex-1 p-4 pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      <nav className="glass-card fixed inset-x-0 bottom-0 z-50 !rounded-none border-x-0 border-b-0 md:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-4">
          {[
            { to: persona.home, icon: Home, hi: 'होम', en: 'Home', end: true },
            { to: '/account/chats', icon: MessageCircle, hi: 'चैट', en: 'Chat', end: false },
            { to: '/account/profile', icon: User, hi: 'प्रोफ़ाइल', en: 'Profile', end: false },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold',
                  isActive ? 'text-primary' : 'text-muted',
                )
              }
            >
              <item.icon size={20} aria-hidden />
              {t(item.hi, item.en)}
            </NavLink>
          ))}
          <button
            onClick={() => setToolsOpen(true)}
            className={cx(
              'flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold',
              toolsOpen ? 'text-primary' : 'text-muted',
            )}
          >
            <LayoutGrid size={20} aria-hidden />
            {t('टूल्स', 'Tools')}
          </button>
        </div>
      </nav>

      <PersonaSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
      <AllToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} />
      <AssistantHost />
    </div>
  );
}
