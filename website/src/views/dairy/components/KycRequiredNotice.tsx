import { Link } from 'react-router-dom';
import { useT } from '../../../lib/i18n';
import '../../../theme/dairy.css';

interface KycRequiredNoticeProps {
  deepLink?: string | null;
  onDismiss?: () => void;
}

export default function KycRequiredNotice({ deepLink, onDismiss }: KycRequiredNoticeProps) {
  const t = useT();
  const target = deepLink || '/dashboard/profile?section=kyc&docType=fssai';

  return (
    <div
      className="dairy-alert"
      style={{
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: 8,
        padding: 12,
      }}
    >
      <div>
        <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 4 }}>
          ⚠️ {t('dairyKycRequiredTitle')}
        </div>
        <div style={{ fontSize: 13, color: '#78350f', marginBottom: 8 }}>
          {t('dairyKycRequiredMsg')}
        </div>
        <Link
          to={target}
          className="av-btn av-btn-primary"
          style={{ fontSize: 12, padding: '4px 10px', textDecoration: 'none', display: 'inline-block' }}
        >
          {t('dairyKycUploadLink')} →
        </Link>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: '#78350f' }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
