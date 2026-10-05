import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as QRCode from 'qrcode';
import { toast } from '../../components/toast';
import { getPurchasedCourses } from '../../lib/api/courses';
import { useT } from '../../lib/i18n';
import { useSessionStore } from '../../stores/session';

interface EarnedCertificate {
  courseId: string;
  courseTitle: string;
  certificateId: string;
  issuedAt: string;
}

/**
 * "Certificates / Skill Passport" section (task 1.24) — lists the farmer's
 * earned certificates with a QR of the public verification URL and a link to
 * the public verify page. Global rule 2: every certificate carries `farmerId`,
 * shown from the logged-in farmer's own id (no hardcoded ids).
 */
export default function SkillPassportSection() {
  const t = useT();
  const farmerId = useSessionStore((s) => s.user?.id);
  const [certs, setCerts] = useState<EarnedCertificate[] | null>(null);
  const [qrByCert, setQrByCert] = useState<Record<string, string>>({});

  useEffect(() => {
    getPurchasedCourses()
      .then((res) => {
        const earned: EarnedCertificate[] = [];
        for (const course of res.data) {
          if (course.certificateId) {
            earned.push({
              courseId: course.id,
              courseTitle: course.title,
              certificateId: course.certificateId,
              issuedAt: course.purchasedAt ?? '',
            });
          }
        }
        setCerts(earned);
      })
      .catch(() => {
        setCerts([]);
        toast(t('academyLoadFailed'), { error: true });
      });
  }, [t]);

  useEffect(() => {
    if (!certs) return;
    for (const cert of certs) {
      const url = `https://agrovercity.com/verify/cert/${cert.certificateId}`;
      QRCode.toDataURL(url)
        .then((dataUrl) => setQrByCert((prev) => ({ ...prev, [cert.certificateId]: dataUrl })))
        .catch(() => undefined);
    }
  }, [certs]);

  return (
    <section className="dash-section">
      <h3>{t('academySkillPassportTitle')}</h3>
      {farmerId ? (
        <p style={{ fontSize: 13, color: '#6B7280' }}>
          {t('academyFarmerId')}: {farmerId}
        </p>
      ) : null}
      {certs === null ? (
        <p className="dash-empty-line">…</p>
      ) : certs.length === 0 ? (
        <p className="dash-empty-line">🏆 {t('academyNoCertificates')}</p>
      ) : (
        certs.map((cert) => (
          <div
            key={cert.certificateId}
            style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}
          >
            {qrByCert[cert.certificateId] ? (
              <img src={qrByCert[cert.certificateId]} alt={t('academyScanToVerify')} width={72} height={72} />
            ) : null}
            <div>
              <strong>{cert.courseTitle}</strong>
              <div style={{ fontSize: 13, color: '#6B7280' }}>
                {t('academyIssuedAt')}: {cert.issuedAt}
              </div>
              <Link to={`/verify/cert/${cert.certificateId}`}>{t('academyViewPublic')}</Link>
            </div>
          </div>
        ))
      )}
    </section>
  );
}
