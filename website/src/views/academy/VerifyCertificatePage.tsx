import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { isApiError } from '../../lib/api/client';
import { verifyCertificatePublic, type CertificateVerificationPublic } from '../../lib/api/courses';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Public certificate verification page (task 1.16) — reachable at
 * /verify/cert/:certificateId while logged out (no auth store dependency).
 * Reads only the certificate's public fields via
 * GET /v1/teachers/certificates/verify/{id}.
 */
export default function VerifyCertificatePage() {
  const t = useT();
  const { certificateId = '' } = useParams();
  const [cert, setCert] = useState<CertificateVerificationPublic | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    verifyCertificatePublic(certificateId)
      .then((res) => {
        setCert(res);
        setNotFound(false);
      })
      .catch((e) => {
        setCert(null);
        // Unknown ids return the standard error envelope with code
        // CERTIFICATE_NOT_FOUND; any other failure is treated as not found too.
        setNotFound(isApiError(e) ? e.code === 'CERTIFICATE_NOT_FOUND' : true);
      })
      .finally(() => setLoading(false));
  }, [certificateId]);

  return (
    <main className="dash-content" style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 22 }}>{t('academyVerifyTitle')}</h1>
      {loading ? (
        <p className="dash-empty-line">{t('academyVerifying')}</p>
      ) : notFound || cert === null ? (
        <p className="dash-empty-line">❌ {t('academyNotVerified')}</p>
      ) : (
        <section className="dash-section">
          <p style={{ fontWeight: 600, color: '#166534' }}>✅ {t('academyVerified')}</p>
          <p>
            <strong>{t('academyRecipient')}:</strong> {cert.recipientName}
          </p>
          <p>
            <strong>{t('academyCourse')}:</strong> {cert.courseTitle}
          </p>
          <p>
            <strong>{t('academyIssuedAt')}:</strong> {cert.issuedAt}
          </p>
          {cert.credential ? (
            <p>
              <strong>{t('academyCredentialLabel')}:</strong> {cert.credential}
            </p>
          ) : null}
          <p style={{ fontSize: 13, color: '#6B7280' }}>
            <strong>{t('academyCredentialLabel')}:</strong> {cert.certificateId}
          </p>
        </section>
      )}
    </main>
  );
}
