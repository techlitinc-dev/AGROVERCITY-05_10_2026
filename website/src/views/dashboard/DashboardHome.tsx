import { useEffect, useState } from 'react';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';
import AllToolsSheet from '../../components/dashboard/AllToolsSheet';
import BottomMenuBar from '../../components/dashboard/BottomMenuBar';
import MenuBar from '../../components/dashboard/MenuBar';
import ProfileSwitcherBar from '../../components/dashboard/ProfileSwitcherBar';
import ProfileSwitcherSheet from '../../components/dashboard/ProfileSwitcherSheet';
import { LiveCard, PersonaBanner, PromoBanner, SectionTitle, ToolTile } from '../../components/dashboard/tiles';
import SellerHomeBoard from '../../components/dashboard/SellerHomeBoard';
import InsightsPanel from '../../components/intelligence/InsightsPanel';
import { TransportHomeBoard } from '../transport';
import { BrokerHomeBoard } from '../broker';
import { BuyerHomeBoard } from '../directbuyer';
import LandlordHomeBoard from '../landlord/LandlordHomeBoard';
import EquipmentOwnerHomeBoard from '../equipment/EquipmentOwnerHomeBoard';
import CustomerHomeBoard from '../customer/CustomerHomeBoard';
import InstructorHomeBoard from '../instructor/InstructorHomeBoard';
import DairyManagerHomeBoard from '../dairyMarket/DairyManagerHomeBoard';
import { useT } from '../../lib/i18n';
import { personaHomeConfig } from '../../lib/dashboard';
import { PERSONAS, personaByType, personaLabel } from '../../lib/personas';
import { useDashboardStore } from '../../stores/dashboard';
import { useSessionStore } from '../../stores/session';
import '../../theme/dashboard.css';

function greetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'dashGoodMorning';
  if (hour < 17) return 'dashGoodAfternoon';
  return 'dashGoodEvening';
}

/**
 * Dashboard home — mirrors the mobile dashboard
 * (apps/mobile/lib/views/home_view.dart + views/profile_home/*).
 * Placeholders only: no API data, no charts — static config-driven layout.
 */
export default function DashboardHome() {
  const t = useT();
  const user = useSessionStore((s) => s.user);
  const syncFromUser = useDashboardStore((s) => s.syncFromUser);
  const activeProfile = useDashboardStore((s) => s.activeProfile);
  const linkedProfiles = useDashboardStore((s) => s.linkedProfiles);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    syncFromUser(user);
  }, [user, syncFromUser]);

  const personaType = activeProfile && personaByType(activeProfile) ? activeProfile : 'farmer';
  const persona = personaByType(personaType) ?? PERSONAS[0];
  const config = personaHomeConfig(personaType);
  const isFarmer = personaType === 'farmer';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <SiteHeader />
      <MenuBar onOpenAllTools={() => setToolsOpen(true)} />
      <main className="dash-content" style={{ flex: 1 }}>
        {isFarmer ? (
          <div className="dash-hero">
            <div className="dash-hero-top">
              <div>
                <div className="dash-hero-greeting">
                  {t(greetingKey())}
                  {user?.name ? `, ${user.name}` : ''} 👋
                </div>
                <div className="dash-hero-sub">
                  {user?.village ? `${user.village} • ` : ''}
                  {typeof user?.landAreaAcres === 'number'
                    ? `${user.landAreaAcres.toFixed(1)} ${t('acresUnit')}`
                    : t('digitalAgriPlatform')}
                </div>
              </div>
              <button
                type="button"
                className="dash-role-capsule"
                onClick={() => setSwitchOpen(true)}
              >
                👤 {t('dashActiveRole', { role: personaLabel(personaType), count: linkedProfiles.length })}
                {' • '}
                {t('dashChange')}
              </button>
            </div>
            <div className="dash-weather-strip">
              🌦️ {t('dashWeather')} — {t('dashWeatherComingSoon')}
            </div>
          </div>
        ) : (
          <PersonaBanner persona={persona} metrics={config.metrics} onSwitch={() => setSwitchOpen(true)} />
        )}

        <ProfileSwitcherBar onOpenSheet={() => setSwitchOpen(true)} />

        {personaType === 'seller' ? <SellerHomeBoard /> : null}
        {personaType === 'directBuyer' ? <BuyerHomeBoard embedded /> : null}
        {personaType === 'transport' ? <TransportHomeBoard /> : null}
        {personaType === 'broker' ? <BrokerHomeBoard embedded /> : null}
        {personaType === 'farmLandlord' ? <LandlordHomeBoard /> : null}
        {personaType === 'equipmentRental' ? <EquipmentOwnerHomeBoard /> : null}
        {personaType === 'customer' ? <CustomerHomeBoard /> : null}
        {personaType === 'instructor' ? <InstructorHomeBoard /> : null}
        {personaType === 'dairyManager' ? <DairyManagerHomeBoard /> : null}

        {/* Farmer home is the generic config renderer; transport renders its
            own board above — both still get the intelligence panel section. */}
        {personaType === 'farmer' || personaType === 'transport' ? <InsightsPanel /> : null}

        {config.sections.map((section, index) => (
          <section className="dash-section" key={section.titleKey}>
            <SectionTitle title={t(section.titleKey)} />
            <div className={index === 0 ? 'dash-grid-2' : 'dash-grid-3'}>
              {section.tiles.map((tile) => (
                <ToolTile key={tile} id={tile} />
              ))}
            </div>
          </section>
        ))}

        {config.banners
          ?.filter((kind) => kind !== 'mandi')
          .map((kind) => (
            <PromoBanner key={kind} kind={kind} />
          ))}

        <LiveCard titleKey={config.liveCardKey} />
      </main>
      <SiteFooter />
      <BottomMenuBar />
      <ProfileSwitcherSheet open={switchOpen} onClose={() => setSwitchOpen(false)} />
      <AllToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} />
    </div>
  );
}
