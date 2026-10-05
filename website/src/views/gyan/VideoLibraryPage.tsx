import { useEffect, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { listVideos, type VideoItem } from '../../lib/api/gyan';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Video Library page (task 4.10) — a grid of video guides, each with an
 * embedded player (the item's `videoUrl`).
 */
export default function VideoLibraryPage() {
  const t = useT();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    listVideos()
      .then((res) => setVideos(res.data))
      .catch(() => toast(t('gyanLoadFailed'), { error: true }))
      .finally(() => setLoaded(true));
  }, [t]);

  return (
    <ToolShell toolId="gyanHub">
      <section className="dash-section">
        <h3>{t('gyanVideos')}</h3>
        {!loaded ? (
          <p className="dash-empty-line">…</p>
        ) : videos.length === 0 ? (
          <p className="dash-empty-line">{t('gyanEmptyVideos')}</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
              marginTop: 12,
            }}
          >
            {videos.map((video) => (
              <div
                key={video.id}
                style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: 12 }}
              >
                <video
                  controls
                  preload="none"
                  style={{ width: '100%', borderRadius: 8, background: '#000' }}
                  src={video.videoUrl}
                />
                <div style={{ fontWeight: 600, marginTop: 8 }}>{video.title}</div>
                <div style={{ color: '#6B7280', fontSize: 13 }}>
                  {video.instructor} · {video.duration} · {video.views}
                </div>
                <div style={{ color: '#374151', fontSize: 13, marginTop: 4 }}>{video.summary}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </ToolShell>
  );
}
