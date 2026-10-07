import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  applyScheme,
  getScheme,
  uploadVaultDocument,
  vaultDocTypeFor,
  type SchemeCriterion,
  type SchemeDetail,
} from '../../lib/api/schemes';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Scheme detail (tasks 5.10 / 5.11 / 5.13): the eligibility checklist is
 * rendered from the backend response (no client-side eligibility logic); the two
 * apply paths are always visible and distinctly labelled (in-app tracked vs the
 * external official portal); each required document shows its vault status with
 * an upload-to-vault action for the missing ones.
 */
export default function SchemeDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const { schemeId = '' } = useParams<{ schemeId: string }>();

  const [scheme, setScheme] = useState<SchemeDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);

  const load = useCallback(() => {
    if (!schemeId) return;
    setFailed(false);
    getScheme(schemeId)
      .then(setScheme)
      .catch((e) => {
        if (isApiError(e) && (e.status === 404 || e.code === 'SCHEME_NOT_FOUND')) setNotFound(true);
        else setFailed(true);
      });
  }, [schemeId]);

  useEffect(load, [load]);

  const criterionLabel = (criterion: SchemeCriterion): string => {
    const params = criterion.params ?? {};
    if (criterion.key === 'maxLandAcres') {
      return t('schemesCriteria_maxLandAcres', {
        max: String(params.max ?? ''),
        actual: String(params.actual ?? ''),
      });
    }
    if (criterion.key === 'states') {
      const states = Array.isArray(params.states) ? params.states.join(', ') : '';
      return t('schemesCriteria_states', { states });
    }
    if (criterion.key === 'requiresKcc') {
      return t('schemesCriteria_requiresKcc');
    }
    return criterion.key;
  };

  const submitApply = async () => {
    setBusy(true);
    try {
      await applyScheme(schemeId, []);
      setApplied(true);
      toast(t('schemesApplySuccess'));
    } catch (e) {
      if (isApiError(e) && e.code === 'ALREADY_APPLIED') toast(t('schemesAlreadyApplied'), { error: true });
      else if (isApiError(e) && e.code === 'NOT_ELIGIBLE') toast(t('schemesNotEligibleApply'), { error: true });
      else toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const uploadDoc = async (label: string, file: File) => {
    try {
      await uploadVaultDocument(file, vaultDocTypeFor(label));
      toast(t('schemesDocPresent'));
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    }
  };

  if (notFound) {
    return (
      <ToolShell toolId="schemes" backTo="/dashboard/p/schemes">
        <div className="trade-card">
          <span className="trade-card-title">{t('schemesEmpty')}</span>
          <span className="trade-card-sub">{t('schemesEmptyBody')}</span>
          <div className="trade-actions">
            <button
              type="button"
              className="av-btn av-btn-ghost"
              onClick={() => navigate('/dashboard/p/schemes')}
            >
              ← {t('schemesTitle')}
            </button>
          </div>
        </div>
      </ToolShell>
    );
  }

  return (
    <ToolShell toolId="schemes" backTo="/dashboard/p/schemes">
      {failed ? (
        <div className="trade-card">
          <span className="trade-card-sub">📡 {t('schemesLoadFailed')}</span>
          <div className="trade-actions">
            <button type="button" className="av-btn av-btn-ghost" onClick={load}>
              ↻ {t('retry')}
            </button>
          </div>
        </div>
      ) : null}

      {scheme === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

      {scheme ? (
        <>
          <div className="trade-card">
            <div className="trade-card-row">
              <span className="trade-card-title">{scheme.name}</span>
              <span
                style={{
                  fontSize: 12,
                  padding: '2px 8px',
                  borderRadius: 999,
                  color: scheme.eligible ? '#15803d' : '#b91c1c',
                  background: scheme.eligible ? '#dcfce7' : '#fee2e2',
                }}
              >
                {scheme.eligible ? t('schemesEligible') : t('schemesNotEligible')}
              </span>
            </div>
            <span className="trade-card-sub">{scheme.description}</span>
            <span className="trade-card-sub">{scheme.benefitAmount}</span>
            <span className="trade-card-sub">{t('schemesDeadline', { date: scheme.nextDeadline })}</span>
            {!scheme.eligible ? (
              <span className="trade-card-sub">{t('schemesNotEligibleHint')}</span>
            ) : null}
          </div>

          <div className="trade-card">
            <span className="trade-card-title">{t('schemesDetailEligibility')}</span>
            {scheme.eligibility.length === 0 ? (
              <span className="trade-card-sub">{t('schemesNoMissing')}</span>
            ) : null}
            {scheme.eligibility.map((criterion, index) => (
              <span className="trade-card-sub" key={`${criterion.key}-${index}`}>
                {criterion.met ? '✅' : '⛔'} {criterionLabel(criterion)} —{' '}
                {criterion.met ? t('schemesCriterionMet') : t('schemesCriterionUnmet')}
              </span>
            ))}
          </div>

          <div className="trade-card">
            <span className="trade-card-title">{t('schemesRequiredDocs')}</span>
            {scheme.documents.map((doc) => (
              <div className="trade-card-row" key={doc.name}>
                <span className="trade-card-sub">
                  {doc.present ? '✅' : '📄'} {doc.name} —{' '}
                  {doc.present ? t('schemesDocPresent') : t('schemesDocMissing')}
                </span>
                {!doc.present ? (
                  <label className="av-btn av-btn-ghost" style={{ cursor: 'pointer' }}>
                    {t('schemesUploadToVault')}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      style={{ display: 'none' }}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadDoc(doc.name, file);
                      }}
                    />
                  </label>
                ) : null}
              </div>
            ))}
            <span className="trade-hint">{t('schemesVaultHint')}</span>
          </div>

          <div className="trade-actions">
            <button
              type="button"
              className="av-btn av-btn-primary"
              disabled={busy || applied || !scheme.eligible}
              onClick={() => void submitApply()}
            >
              {applied ? t('schemesApplySuccess') : t('schemesApplyInApp')}
            </button>
            {scheme.portalUrl ? (
              <a
                className="av-btn av-btn-ghost"
                href={scheme.portalUrl}
                target="_blank"
                rel="noreferrer"
              >
                🔗 {t('schemesApplyExternal')}
              </a>
            ) : null}
          </div>
        </>
      ) : null}
    </ToolShell>
  );
}
