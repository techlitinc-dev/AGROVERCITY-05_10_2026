import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../lib/i18n';
import { adminGet } from '../../lib/api/admin';

interface BriefingItem {
  text: string;
  deepLink: string;
  preTriage?: Record<string, unknown>;
}

/** Nightly copilot briefing card — each item deep-links into its admin queue. */
export default function BriefingCard() {
  const t = useT();
  const [items, setItems] = useState<BriefingItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    adminGet<{ items?: BriefingItem[] }>('/admin/copilot/briefing')
      .then((r) => setItems(r.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <section style={{ marginBottom: 20 }}>
      <h4>{t('admin.briefing.title')}</h4>
      {loaded && items.length === 0 && <p className="admin-nav-group-label">{t('admin.briefing.empty')}</p>}
      <ul>
        {items.map((item) => (
          <li key={item.deepLink}>
            <Link to={item.deepLink}>{item.text}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
