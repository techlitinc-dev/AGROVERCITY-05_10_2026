import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useT } from '../../lib/i18n';
import { LANGUAGE_CATALOGUE } from '../../lib/languages';
import { listNotifications } from '../../lib/api/notifications';
import { updateSettings } from '../../lib/api/users';
import { useOnboardingStore } from '../../stores/onboarding';
import { useSessionStore } from '../../stores/session';
import { useTradeStore } from '../../stores/trade';
import { toast } from '../toast';
import '../../theme/trade.css';

interface MenuEntry {
  label: string;
  icon: string;
  to?: string;
  action?: () => void;
  separator?: boolean;
}

interface MenuBarProps {
  onOpenAllTools: () => void;
}

/**
 * macOS-style dashboard menubar — mirrors the mobile app's AppleMenuBar
 * (apps/mobile/lib/components/navigation/apple_menubar.dart). Every entry is a
 * placeholder action: it navigates to a tool page or shows a toast.
 */
export default function MenuBar({ onOpenAllTools }: MenuBarProps) {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const clear = useSessionStore((s) => s.clear);
  const setOnboarded = useOnboardingStore((s) => s.setOnboarded);
  const language = useOnboardingStore((s) => s.language);
  const setLanguage = useOnboardingStore((s) => s.setLanguage);
  const hasToken = useSessionStore((s) => !!s.accessToken);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mahila, setMahila] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState(() => new Date());
  const barRef = useRef<HTMLDivElement>(null);

  // Keep the header search box in sync with the results page URL (?q=).
  useEffect(() => {
    if (location.pathname === '/search') {
      setSearchQuery(new URLSearchParams(location.search).get('q') ?? '');
    }
  }, [location.pathname, location.search]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = searchQuery.trim();
    if (!value) return;
    navigate(`/search?q=${encodeURIComponent(value)}`);
  };

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const close = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  // Unread notifications badge (bell) — polled lightly while signed in.
  const unread = useTradeStore((s) => s.notificationsUnread);
  const setUnread = useTradeStore((s) => s.setNotificationsUnread);
  useEffect(() => {
    if (!hasToken) return;
    let live = true;
    const refresh = () =>
      listNotifications({ page: 1, pageSize: 20 })
        .then((res) => {
          if (!live) return;
          setUnread(res.data.filter((n) => !n.read).length);
        })
        .catch(() => undefined);
    void refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [hasToken, setUnread]);

  const signOut = () => {
    clear();
    setOnboarded(false);
    navigate('/');
  };

  const changeLanguage = (code: string) => {
    setLanguage(code);
    if (hasToken) {
      void updateSettings({ language: code, preferredLanguage: code }).catch(() => undefined);
    }
  };

  const go = (to?: string, action?: () => void) => {
    setOpenMenu(null);
    if (action) action();
    else if (to) navigate(to);
  };

  const brandMenu: MenuEntry[] = [
    { label: t('dashAbout'), icon: 'ℹ️', action: () => toast('AGROVERCITY • Digital Agriculture Platform') },
    { label: t('tool_gyanHub'), icon: '🎓', to: '/dashboard/p/gyanHub' },
    {
      label: t('dashAllTools'),
      icon: '🧭',
      action: () => {
        onOpenAllTools();
      },
    },
    { label: t('dashReplayOnboarding'), icon: '🔄', to: '/onboarding/language' },
    { label: t('dashSyncStatus'), icon: '✅', action: () => toast(t('dashSynced')) },
    { label: t('dashSignOut'), icon: '🚪', action: signOut, separator: true },
  ];

  const menus: Array<{ id: string; label: string; entries: MenuEntry[] }> = [
    {
      id: 'crops',
      label: t('dashMenuCrops'),
      entries: [
        { label: t('dashMenuAiScan'), icon: '📷', to: '/dashboard/p/advisory' },
        { label: t('dashMenuFertilizer'), icon: '🧪', to: '/dashboard/p/advisory' },
        { label: t('dashMenuWater'), icon: '💧', to: '/dashboard/p/water' },
      ],
    },
    {
      id: 'market',
      label: t('dashMenuMarket'),
      entries: [
        { label: t('dashMenuMandiRates'), icon: '📈', to: '/dashboard/p/mandi' },
        { label: t('dashMenuInputStore'), icon: '🛒', to: '/dashboard/p/marketplace' },
        { label: t('dashMenuContracts'), icon: '🤝', to: '/dashboard/p/buyers' },
      ],
    },
    {
      id: 'media',
      label: t('dashMenuMedia'),
      entries: [
        { label: t('dashMenuTalks'), icon: '🎤', to: '/dashboard/p/gyanHub' },
        { label: t('dashMenuVideos'), icon: '🎬', to: '/dashboard/p/gyanHub' },
        { label: t('dashMenuBlogs'), icon: '📝', to: '/dashboard/p/gyanHub' },
      ],
    },
    {
      id: 'finance',
      label: t('dashMenuFinance'),
      entries: [
        { label: t('dashMenuPnl'), icon: '📊', to: '/dashboard/p/profitLoss' },
        { label: t('dashMenuCredit'), icon: '💯', to: '/dashboard/p/finance' },
        { label: t('dashMenuLoan'), icon: '⚡', to: '/dashboard/p/finance' },
      ],
    },
    {
      id: 'schemes',
      label: t('dashMenuSchemes'),
      entries: [
        { label: t('dashMenuEligibility'), icon: '🎯', to: '/dashboard/p/schemes' },
        { label: t('dashMenuVault'), icon: '🗄️', to: '/dashboard/p/schemes' },
      ],
    },
  ];

  const renderDropdown = (name: string, entries: MenuEntry[]) => {
    if (openMenu !== name) return null;
    return (
      <div className="dash-menu-dropdown">
        {entries.map((entry, i) => (
          <span key={`${name}-${i}`}>
            {entry.separator ? <div className="dash-menu-sep" /> : null}
            {entry.to ? (
              <Link
                className="dash-menu-entry"
                to={entry.to}
                onClick={() => setOpenMenu(null)}
              >
                <span className="dash-menu-icon">{entry.icon}</span>
                {entry.label}
              </Link>
            ) : (
              <button
                type="button"
                className="dash-menu-entry"
                onClick={() => go(undefined, entry.action)}
              >
                <span className="dash-menu-icon">{entry.icon}</span>
                {entry.label}
              </button>
            )}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="dash-menubar" ref={barRef}>
      <div className="dash-menubar-inner">
        <div className="dash-menu-wrap">
          <button
            type="button"
            className={`dash-menu-trigger dash-menu-brand${openMenu === 'brand' ? ' open' : ''}`}
            onClick={() => setOpenMenu(openMenu === 'brand' ? null : 'brand')}
          >
            🍏 AGROVERCITY
          </button>
          {renderDropdown('brand', brandMenu)}
        </div>
        {menus.map((menu) => (
          <div className="dash-menu-wrap" key={menu.id}>
            <button
              type="button"
              className={`dash-menu-trigger${openMenu === menu.id ? ' open' : ''}`}
              onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
            >
              {menu.label}
            </button>
            {renderDropdown(menu.id, menu.entries)}
          </div>
        ))}
        <span className="dash-menu-spacer" />
        <div className="dash-tray">
          <form role="search" onSubmit={submitSearch} style={{ display: 'inline-flex' }}>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchTitle')}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#e8f5e9',
                border: 'none',
                borderRadius: 999,
                fontFamily: 'var(--av-font)',
                fontSize: 11.5,
                fontWeight: 800,
                padding: '4px 10px',
                minWidth: 140,
                maxWidth: 180,
              }}
            />
          </form>
          <button
            type="button"
            className="dash-tray-pill coins"
            aria-label={t('tool_chats')}
            onClick={() => navigate('/dashboard/p/chats')}
          >
            💬
          </button>
          <button
            type="button"
            className="dash-tray-pill coins dash-bell"
            aria-label={t('tool_notifications')}
            onClick={() => navigate('/dashboard/p/notifications')}
          >
            🔔
            {unread > 0 ? (
              <span className="dash-bell-badge">{unread > 99 ? '99+' : unread}</span>
            ) : null}
          </button>
          <span className="dash-tray-pill">
            <span className="dot" />
            {t('dashOnline')}
          </span>
          <button
            type="button"
            className="dash-tray-pill coins"
            onClick={() => navigate('/dashboard/p/krishiRatna')}
          >
            🪙 {t('dashAgriCoins')}
          </button>
          <select
            className="dash-lang-select"
            value={language}
            aria-label={t('languageLabel')}
            onChange={(e) => changeLanguage(e.target.value)}
          >
            {LANGUAGE_CATALOGUE.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`dash-tray-pill mahila${mahila ? ' on' : ''}`}
            onClick={() => setMahila((v) => !v)}
          >
            👩‍🌾 {t('dashMahila')}
          </button>
          <span className="dash-clock">
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}
