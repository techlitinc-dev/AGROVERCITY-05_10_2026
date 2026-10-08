import { useEffect, useState } from 'react';
import { useT } from '../../lib/i18n';
import { getOverview, type AdminOverview } from '../../lib/api/admin';
import BriefingCard from './BriefingCard';
import CopilotPanel from './CopilotPanel';

export default function AdminHomePage() {
  const t = useT();
  const [data, setData] = useState<AdminOverview | null>(null);

  useEffect(() => {
    getOverview()
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const kpis: { labelKey: string; value: string }[] = data
    ? [
        { labelKey: 'admin.home.activeUsers', value: String(data.activeUsersTotal ?? 0) },
        { labelKey: 'admin.home.pendingKyc', value: String(data.pendingKycCount ?? 0) },
        { labelKey: 'admin.home.gmv', value: String(data.marketplaceGMV ?? 0) },
        { labelKey: 'admin.home.pendingClaims', value: String(data.pendingClaimsCount ?? 0) },
        { labelKey: 'admin.home.pendingSettlements', value: String(data.pendingSettlementsAmount ?? 0) },
      ]
    : [];

  return (
    <div>
      <h2>{t('admin.home.title')}</h2>
      {!data && <p className="admin-nav-group-label">{t('appLoading')}</p>}
      <div className="admin-kpi">
        {kpis.map((kpi) => (
          <div className="admin-kpi-card" key={kpi.labelKey}>
            <div className="label">{t(kpi.labelKey)}</div>
            <div className="value">{kpi.value}</div>
          </div>
        ))}
      </div>
      <BriefingCard />
      <CopilotPanel />
    </div>
  );
}
