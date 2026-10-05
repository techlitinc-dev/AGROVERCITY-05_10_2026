import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { listChannels, type LiveChannel, type Paged } from '../../lib/api/content';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Live Channels grid (task 5.14) — live badge + viewer count + category per
 * channel; each card navigates to the player. Read-only consumer surface
 * (X16: embedded licensed streams only).
 */
export default function ChannelGridPage() {
  const t = useT();
  const [channels, setChannels] = useState<LiveChannel[] | null>(null);

  const load = useCallback(() => {
    listChannels()
      .then((res: Paged<LiveChannel>) => setChannels(res.data))
      .catch(() => {
        setChannels([]);
        toast(t('channelsLoadFailed'), { error: true });
      });
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ToolShell toolId="liveChannels">
      <section className="dash-section">
        <h3>{t('channelsTitle')}</h3>
        {channels === null ? (
          <p className="dash-empty-line">…</p>
        ) : channels.length === 0 ? (
          <p className="dash-empty-line">📺 {t('channelsEmpty')}</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 12,
              marginTop: 12,
            }}
          >
            {channels.map((channel) => (
              <Link
                key={channel.id}
                to={`/dashboard/p/liveChannels/${channel.id}`}
                style={{
                  display: 'block',
                  padding: 12,
                  border: '1px solid #E5E7EB',
                  borderRadius: 12,
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {channel.isLiveNow ? (
                    <span
                      className="av-chip"
                      style={{ background: '#FEE2E2', color: '#B91C1C', fontSize: 12, padding: '2px 8px', borderRadius: 999 }}
                    >
                      ● {t('channelsLive')}
                    </span>
                  ) : (
                    <span className="av-chip" style={{ fontSize: 12 }}>
                      {t('channelsOffline')}
                    </span>
                  )}
                  <span className="av-chip" style={{ fontSize: 12 }}>
                    {channel.category}
                  </span>
                </div>
                <div style={{ marginTop: 8, fontWeight: 600 }}>{channel.channelName}</div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>{channel.programTitle}</div>
                <div style={{ fontSize: 13, color: '#374151', marginTop: 6 }}>
                  👁️ {t('channelsViewers', { count: channel.liveViewersCount })}
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: '#2563EB' }}>
                  ▶️ {t('channelsWatch')} →
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </ToolShell>
  );
}
