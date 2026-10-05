import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as QRCode from 'qrcode';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { getCertificate, getCourse, type CertificateResult } from '../../lib/api/courses';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

interface NextCourse {
  id: string;
  title: string;
}

/**
 * Certificate page (task 1.15) — certificate detail + a QR code of the public
 * `verificationUrl` (qrcode dep), plus share/download actions. WS-06 task 6.12
 * additionally renders the "next course for you" learning-path suggestion when
 * the payload carries `learningPath.courseIds` (nothing when absent).
 */
export default function CertificatePage() {
  const t = useT();
  const { courseId = '' } = useParams();
  const [cert, setCert] = useState<CertificateResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [nextCourses, setNextCourses] = useState<NextCourse[]>([]);

  useEffect(() => {
    getCertificate(courseId)
      .then(setCert)
      .catch((e) => toast(isApiError(e) ? e.message : t('academyCertificateUnavailable'), { error: true }));
  }, [courseId, t]);

  useEffect(() => {
    if (!cert) return;
    QRCode.toDataURL(cert.verificationUrl)
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [cert]);

  useEffect(() => {
    const courseIds = cert?.learningPath?.courseIds ?? [];
    if (courseIds.length === 0) {
      setNextCourses([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      courseIds.map((id) =>
        getCourse(id)
          .then((course): NextCourse => ({ id, title: course.title }))
          .catch((): NextCourse => ({ id, title: id })),
      ),
    ).then((courses) => {
      if (!cancelled) setNextCourses(courses);
    });
    return () => {
      cancelled = true;
    };
  }, [cert]);

  const share = async () => {
    if (!cert) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: cert.certificateTitle, url: cert.verificationUrl });
        return;
      } catch {
        // fall through to clipboard copy
      }
    }
    await navigator.clipboard.writeText(cert.verificationUrl);
    toast(t('academyCertificateShareCopied'));
  };

  const download = () => {
    if (!qrDataUrl || !cert) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `${cert.certificateId}.png`;
    link.click();
  };

  return (
    <ToolShell toolId="courses" backTo={`/dashboard/p/courses/${courseId}`}>
      <section className="dash-section">
        <h3>{t('academyCertificateDocTitle')}</h3>
        {cert === null ? (
          <p className="dash-empty-line">…</p>
        ) : (
          <>
            <p style={{ fontWeight: 600 }}>{cert.certificateTitle}</p>
            <p>
              {t('academyCertificateRecipient', { name: cert.studentName })} · {cert.courseTitle}
            </p>
            <p style={{ color: '#6B7280' }}>
              {t('academyIssuedAt')}: {cert.issuedAt} · {cert.institution}
            </p>
            <p style={{ color: '#6B7280' }}>
              {t('academyCredentialLabel')}: {cert.certificateId}
            </p>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={t('academyScanToVerify')} width={160} height={160} />
            ) : null}
            <p style={{ fontSize: 13, color: '#6B7280' }}>{t('academyCertificateVerifyHint')}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" onClick={share}>
                {t('academyCertificateShare')}
              </button>
              <button type="button" onClick={download} disabled={!qrDataUrl}>
                {t('academyCertificateDownload')}
              </button>
            </div>
            {nextCourses.length > 0 ? (
              <div style={{ marginTop: 16 }}>
                <h4>{t('academyNextCourseTitle')}</h4>
                {nextCourses.map((course) => (
                  <Link
                    key={course.id}
                    to={`/dashboard/p/courses/${course.id}`}
                    className="av-card"
                    style={{ display: 'block', padding: 10, marginTop: 8, border: '1px solid #E5E7EB', borderRadius: 12, textDecoration: 'none', color: 'inherit' }}
                  >
                    📚 {course.title}
                  </Link>
                ))}
              </div>
            ) : null}
          </>
        )}
      </section>
    </ToolShell>
  );
}
