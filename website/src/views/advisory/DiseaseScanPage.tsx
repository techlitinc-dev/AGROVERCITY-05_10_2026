import { useEffect, useRef, useState } from 'react';
import LabeledTextField from '../../components/LabeledTextField';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  diseaseScan,
  diseaseScanHistory,
  type DiseaseScanHistoryRow,
  type DiseaseScanResult,
} from '../../lib/api/advisory';
import { inr } from '../../lib/api/trade';
import { currentLanguage, useT } from '../../lib/i18n';
import '../../theme/advisory.css';

/**
 * Disease Scan (robust.md §7.2, brief M9) — camera/upload → gateway vision.
 *
 * The backend gates the image first: a non-leaf or blurry photo answers retake
 * guidance instead of a diagnosis. A completed scan persists to the per-plot
 * `disease_scans` history and (confidence < 0.7) raises a human expert ticket.
 * When the deterministic stub answered, the card is labelled "demo".
 *
 * Money (estimated cost) arrives as rupees from the legacy adapter payload and
 * is rendered with `inr`. Rendered as the Disease Scan tab body and as a deep
 * route via ADVISORY_PAGES.
 */
export default function DiseaseScanPage({ showHistory = true }: { showHistory?: boolean }) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [plotId, setPlotId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DiseaseScanResult | null>(null);
  const [history, setHistory] = useState<DiseaseScanHistoryRow[]>([]);

  const loadHistory = async (plot: string) => {
    try {
      const page = await diseaseScanHistory(plot ? { plotId: plot } : {});
      setHistory(page.data);
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    if (showHistory) void loadHistory('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHistory]);

  const run = async () => {
    if (!file) {
      toast(t('diseaseScanChoose'), { error: true });
      return;
    }
    setBusy(true);
    try {
      const scan = await diseaseScan(file, { plotId: plotId.trim() || undefined });
      setResult(scan);
      if (showHistory) await loadHistory(plotId.trim());
    } catch (e) {
      if (isApiError(e)) {
        const field = e.fieldErrors?.image;
        toast(field ?? t('actionFailed'), { error: true });
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const lang = currentLanguage();
  const retakeText =
    result?.retake == null ? null : lang === 'hi' ? result.retake.hi : result.retake.en;

  return (
    <section className="advisory-tab" aria-label={t('diseaseScanTitle')}>
      <p className="trade-section-title">{t('diseaseScanTitle')}</p>
      <p className="trade-hint">{t('diseaseScanHint')}</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <div className="trade-actions">
        <button
          type="button"
          className="av-btn"
          onClick={() => inputRef.current?.click()}
        >
          {file ? file.name : t('diseaseScanChoose')}
        </button>
      </div>

      <LabeledTextField
        label={t('diseaseScanPlotId')}
        value={plotId}
        onChange={setPlotId}
      />

      <div className="trade-actions">
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => void run()}
          disabled={busy}
        >
          {busy ? <span className="av-spinner" aria-hidden /> : t('diseaseScanAnalyze')}
        </button>
      </div>

      {result !== null && retakeText !== null ? (
        <div className="trade-card advisory-retake" style={{ cursor: 'default', marginTop: 12 }}>
          <p className="trade-card-title">{retakeText}</p>
        </div>
      ) : null}

      {result !== null && retakeText === null && result.results.length > 0 ? (
        <div className="trade-card" style={{ cursor: 'default', marginTop: 12 }}>
          <div className="trade-card-row">
            <span className="trade-card-title">{t('diseaseScanDiagnosis')}</span>
            {result.demo ? <span className="advisory-pill yellow">{t('diseaseScanDemoLabel')}</span> : null}
          </div>
          {result.results.map((disease) => (
            <div key={disease.diseaseName} style={{ marginTop: 8 }}>
              <p className="trade-card-title">
                {disease.diseaseName} · {disease.crop}
              </p>
              <p className="trade-card-sub">
                {t('diseaseScanConfidence', { value: Math.round(disease.confidence * 100) })}
              </p>
              <p className="trade-card-sub">
                {t('diseaseScanSymptoms')}: {disease.symptoms}
              </p>
              <p className="trade-card-sub">
                {t('diseaseScanChemical')}: {disease.chemicalTreatment}
              </p>
              <p className="trade-card-sub">
                {t('diseaseScanOrganic')}: {disease.organicTreatment}
              </p>
              <p className="trade-card-sub">
                {t('diseaseScanDosage')}: {disease.dosage}
              </p>
              <p className="trade-card-sub">
                {t('diseaseScanCost', { price: inr(disease.estimatedCost) })}
              </p>
              {disease.confidence < 0.7 ? (
                <p className="trade-card-sub">{t('diseaseScanPendingHuman')}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {showHistory ? (
        <div style={{ marginTop: 16 }}>
          <p className="trade-section-title">{t('diseaseScanHistory')}</p>
          {history.length === 0 ? (
            <p className="trade-hint">{t('diseaseScanHistoryEmpty')}</p>
          ) : (
            history.map((row) => (
              <div className="trade-card" key={row.scanId ?? row.createdAt ?? ''} style={{ cursor: 'default' }}>
                <span className="trade-card-title">
                  {row.diagnosis?.diseaseName ?? t('diseaseScanDiagnosis')}
                </span>
                <span className="trade-card-sub">
                  {row.createdAt ?? ''}
                  {row.confidence != null
                    ? ` · ${t('diseaseScanConfidence', { value: Math.round(row.confidence * 100) })}`
                    : ''}
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
