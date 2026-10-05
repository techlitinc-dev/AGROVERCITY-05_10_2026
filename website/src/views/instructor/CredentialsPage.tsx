import { useCallback, useEffect, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  getMyKycCases,
  submitKycCase,
  uploadCredentialDoc,
  type KycCase,
} from '../../lib/api/instructorAcademy';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const IDENTITY_DOCS = ['aadhaar_ekyc', 'voter_id', 'pan', 'driving_licence'];
const MANDATORY_DOCS = ['liveness_selfie'];
const SPECIALIZATION_DOCS = ['dgca_remote_pilot_certificate', 'degree_certificate', 'nabard_nrlm_srlm_empanelment'];

const DOC_LABEL_KEYS: Record<string, string> = {
  aadhaar_ekyc: 'instructorDocAadhaar',
  voter_id: 'instructorDocVoterId',
  pan: 'instructorDocPan',
  driving_licence: 'instructorDocDl',
  liveness_selfie: 'instructorDocLiveness',
  dgca_remote_pilot_certificate: 'instructorDocDgca',
  degree_certificate: 'instructorDocDegree',
  nabard_nrlm_srlm_empanelment: 'instructorDocNabard',
};

const CASE_STATUS_KEYS: Record<string, string> = {
  pending: 'instructorKycPending',
  verified: 'instructorKycVerified',
  rejected: 'instructorKycRejected',
};

const DOC_STATUS_KEYS: Record<string, string> = {
  pending: 'instructorDocPending',
  verified: 'instructorDocVerified',
  rejected: 'instructorDocRejected',
};

/**
 * Credentials & KYC (WS-02 task 2.8) — reads the phase-00 KYC pipeline
 * (GET /v1/kyc/status), submits an instructor case with the document matrix
 * (identity any-one-of + liveness selfie + specialization docs) and uploads
 * documents via POST /v1/kyc/cases/{caseId}/docs/{docId}/upload. Publish is
 * blocked server-side until the case is approved (task 2.27).
 */
export default function CredentialsPage() {
  const t = useT();
  const [cases, setCases] = useState<KycCase[] | null>(null);
  const [selected, setSelected] = useState<string[]>([...MANDATORY_DOCS]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getMyKycCases()
      .then(setCases)
      .catch(() => {
        setCases([]);
        toast(t('instructorLoadFailed'), { error: true });
      });
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const kycCase = cases?.find((entry) => entry.persona === 'instructor') ?? null;

  const toggle = (docType: string) => {
    setSelected((prev) =>
      prev.includes(docType) ? prev.filter((entry) => entry !== docType) : [...prev, docType]
    );
  };

  const handleSubmit = async () => {
    setBusy(true);
    try {
      await submitKycCase(
        'instructor',
        selected.map((type) => ({ type }))
      );
      toast(t('instructorKycSubmitted'));
      load();
    } catch {
      toast(t('instructorKycFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (caseId: string, docId: string, file: File | undefined) => {
    if (!file) return;
    try {
      await uploadCredentialDoc(caseId, docId, file);
      toast(t('instructorUploaded'));
      load();
    } catch {
      toast(t('instructorUploadFailed'), { error: true });
    }
  };

  const renderGroup = (titleKey: string, docTypes: string[]) => (
    <>
      <h4 style={{ marginTop: 12 }}>{t(titleKey)}</h4>
      {docTypes.map((docType) => {
        const doc = kycCase?.docs.find((entry) => entry.type === docType) ?? null;
        const statusKey = doc ? DOC_STATUS_KEYS[doc.status] : null;
        return (
          <div
            key={docType}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid #F3F4F6', fontSize: 14 }}
          >
            <span>{t(DOC_LABEL_KEYS[docType])}</span>
            {kycCase ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {statusKey ? <span style={{ fontSize: 12, color: '#6B7280' }}>{t(statusKey)}</span> : null}
                {doc ? (
                  <label className="av-btn" style={{ cursor: 'pointer' }}>
                    {t('instructorUpload')}
                    <input
                      type="file"
                      style={{ display: 'none' }}
                      onChange={(e) => handleUpload(kycCase.caseId, doc.docId, e.target.files?.[0])}
                    />
                  </label>
                ) : null}
              </span>
            ) : (
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={selected.includes(docType)}
                  onChange={() => toggle(docType)}
                />
              </label>
            )}
          </div>
        );
      })}
    </>
  );

  return (
    <ToolShell toolId="credentials">
      <section className="dash-section">
        <h3>{t('instructorCredentials')}</h3>
        {cases === null ? (
          <p className="dash-empty-line">{t('instructorLoading')}</p>
        ) : kycCase === null ? (
          <>
            <p className="dash-empty-line">🪪 {t('instructorKycNone')}</p>
            {renderGroup('instructorIdentityDocs', IDENTITY_DOCS)}
            {renderGroup('instructorMandatoryDocs', MANDATORY_DOCS)}
            {renderGroup('instructorSpecializationDocs', SPECIALIZATION_DOCS)}
            <button
              type="button"
              className="av-btn"
              style={{ marginTop: 12 }}
              disabled={busy || !IDENTITY_DOCS.some((docType) => selected.includes(docType))}
              onClick={handleSubmit}
            >
              {t('instructorKycSubmit')}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: '#6B7280' }}>
              {t('instructorKycTitle')}: {CASE_STATUS_KEYS[kycCase.status] ? t(CASE_STATUS_KEYS[kycCase.status]) : kycCase.status}
            </div>
            {renderGroup('instructorIdentityDocs', IDENTITY_DOCS)}
            {renderGroup('instructorMandatoryDocs', MANDATORY_DOCS)}
            {renderGroup('instructorSpecializationDocs', SPECIALIZATION_DOCS)}
          </>
        )}
      </section>
    </ToolShell>
  );
}
