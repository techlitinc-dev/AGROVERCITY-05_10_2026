import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { formatPaisa, gradeProduce, type GradeResult } from '../../lib/api/postHarvest';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * AI produce grading (robust.md §7.14, brief M10). Photos are posted as
 * multipart bytes (the backend validates + stores them under `grading/{uid}/`
 * and runs gateway vision — the same upload path the disease-scan page uses).
 * The result card always carries the `gradingAiEstimateLabel` ("AI estimate")
 * honesty label and a one-tap "list as a lot" deep link into `LotForm` with
 * crop / quantity / price prefilled.
 */
export default function GradingPage() {
  const t = useT();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [crop, setCrop] = useState('');
  const [quantity, setQuantity] = useState('');
  const [mandiRupees, setMandiRupees] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);

  const pickFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles(Array.from(list).slice(0, 3));
  };

  const run = async () => {
    if (files.length === 0) {
      toast(t('gradingChoosePhotos'), { error: true });
      return;
    }
    setBusy(true);
    try {
      const mandiPaisa = mandiRupees.trim() === '' ? undefined : Math.round(Number(mandiRupees) * 100);
      const qty = quantity.trim() === '' ? undefined : Number(quantity);
      const graded = await gradeProduce(
        files,
        { crop: crop.trim() || undefined, quantityQuintals: qty, mandiModalPaisa: mandiPaisa },
        files.map((file) => file.name)
      );
      setResult(graded);
    } catch (e) {
      toast(isApiError(e) ? e.message : t('gradingAnalyzeFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const listAsLot = () => {
    if (!result || !result.grade) return;
    const params = new URLSearchParams({
      crop: crop.trim(),
      grade: result.grade,
      qty: quantity.trim(),
      price: String(Math.round(result.recommendedPricePaisa / 100)),
    });
    navigate(`/dashboard/p/sellProduce/new?${params.toString()}`);
  };

  return (
    <ToolShell toolId="postHarvest" backTo="/dashboard/p/postHarvest">
      <section className="dash-section">
        <h3>{t('gradingTitle')}</h3>
        <p className="trade-hint">{t('gradingHint')}</p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => pickFiles(e.target.files)}
        />
        <div className="trade-actions-row">
          <button type="button" className="av-btn" onClick={() => inputRef.current?.click()}>
            {files.length > 0 ? `${files.length}` : t('gradingChoosePhotos')}
          </button>
        </div>

        <LabeledTextField label={t('gradingCrop')} value={crop} onChange={setCrop} />
        <LabeledTextField
          label={t('gradingQuantity')}
          value={quantity}
          onChange={setQuantity}
          type="number"
          inputMode="decimal"
        />
        <LabeledTextField
          label={t('gradingMandiModal')}
          value={mandiRupees}
          onChange={setMandiRupees}
          type="number"
          inputMode="decimal"
          prefix="₹"
        />

        <div className="trade-actions">
          <button type="button" className="av-btn av-btn-primary" disabled={busy} onClick={() => void run()}>
            {busy ? <span className="av-spinner" aria-hidden /> : t('gradingAnalyze')}
          </button>
        </div>

        {result && result.status === 'pending_human' ? (
          <div className="trade-card" style={{ cursor: 'default', marginTop: 12 }}>
            <p className="trade-card-title">🧑‍🌾 {t('gradingPendingHuman')}</p>
            <p className="trade-card-sub">{t('gradingConfidence', { value: Math.round(result.confidence * 100) })}</p>
          </div>
        ) : null}

        {result && result.status === 'graded' ? (
          <div className="trade-card" style={{ cursor: 'default', marginTop: 12 }}>
            <div className="trade-card-row">
              <span className="trade-card-title">
                {t('gradingGrade')}: {result.grade}
              </span>
              <span className="trade-card-amount">
                🤖 {t('gradingAiEstimateLabel')}
                {result.demo ? ` · ${t('gradingDemoLabel')}` : ''}
              </span>
            </div>
            <p className="trade-card-sub">{t('gradingShelfLife', { days: result.shelfLifeDays })}</p>
            <p className="trade-card-sub">{t('gradingUniformity', { percent: result.uniformityPercent })}</p>
            <p className="trade-card-sub">
              {t('gradingPriceBand', {
                low: formatPaisa(result.priceBandPaisa.lowPaisa),
                high: formatPaisa(result.priceBandPaisa.highPaisa),
              })}
            </p>
            <p className="trade-card-sub">
              {result.priceBandPaisa.vsMandiPct == null
                ? t('gradingVsMandiUnavailable')
                : t('gradingVsMandi', { delta: result.priceBandPaisa.vsMandiPct })}
            </p>
            <p className="trade-card-sub">{t('gradingConfidence', { value: Math.round(result.confidence * 100) })}</p>
            <div className="trade-actions-row">
              <button type="button" className="av-btn av-btn-primary" onClick={listAsLot}>
                {t('gradingListAsLot')}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </ToolShell>
  );
}
