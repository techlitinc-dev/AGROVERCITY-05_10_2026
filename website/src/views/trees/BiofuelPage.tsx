import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import {
  listBiofuel,
  listCareGuides,
  type BiofuelTree,
  type CareGuide,
} from '../../lib/api/tree';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Biofuel economics + care guides (robust.md §7.22, task 7.14). All section
 * labels go through `t()`; the species/guide body text is backend content
 * rendered verbatim (data, not UI strings).
 */
export default function BiofuelPage() {
  const t = useT();
  const [biofuel, setBiofuel] = useState<BiofuelTree[]>([]);
  const [biofuelFailed, setBiofuelFailed] = useState(false);
  const [guides, setGuides] = useState<CareGuide[]>([]);
  const [guidesFailed, setGuidesFailed] = useState(false);

  const load = useCallback(async () => {
    setBiofuelFailed(false);
    setGuidesFailed(false);
    try {
      setBiofuel((await listBiofuel()).data);
    } catch {
      setBiofuelFailed(true);
    }
    try {
      setGuides((await listCareGuides()).data);
    } catch {
      setGuidesFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ToolShell toolId="treePlantation">
      <section className="dash-section">
        <h3>{t('treeBiofuelTitle')}</h3>
        <p className="trade-hint">{t('treeBiofuelHint')}</p>
        {biofuelFailed ? <p className="trade-hint">{t('treeBiofuelLoadFailed')}</p> : null}
        {!biofuelFailed && biofuel.length === 0 ? (
          <EmptyState icon="⛽" titleKey="treeBiofuelEmpty" />
        ) : null}
        {biofuel.map((tree) => (
          <div className="trade-card" key={tree.id} style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">{tree.name}</span>
              <span className="trade-card-amount">{tree.botanicalName}</span>
            </div>
            <p className="trade-card-sub">
              {t('treeBiofuelOil', { value: tree.oilContentPercent })}
            </p>
            <p className="trade-card-sub">
              {t('treeBiofuelGestation', { value: tree.gestationPeriod })}
            </p>
            <p className="trade-card-sub">
              {t('treeBiofuelReturn', { value: tree.expectedReturnPerAcre })}
            </p>
            <p className="trade-card-sub">
              {t('treeBiofuelSuitability', { value: tree.suitability })}
            </p>
            <p className="trade-card-sub">{t('treeBiofuelUses', { value: tree.uses })}</p>
            <p className="trade-card-sub">
              {t('treeBiofuelMarket', { value: tree.buyerMarket })}
            </p>
            <p className="trade-card-sub">
              {t('treeBiofuelSubsidy', { value: tree.subsidyScheme })}
            </p>
          </div>
        ))}
      </section>

      <section className="dash-section">
        <h3>{t('treeCareTitle')}</h3>
        <p className="trade-hint">{t('treeCareHint')}</p>
        {guidesFailed ? <p className="trade-hint">{t('treeCareLoadFailed')}</p> : null}
        {!guidesFailed && guides.length === 0 ? (
          <EmptyState icon="📘" titleKey="treeCareEmpty" />
        ) : null}
        {guides.map((guide) => (
          <div className="trade-card" key={guide.id} style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">{guide.title}</span>
              <span className="trade-card-amount">
                {t('treeCareStep', { step: guide.stepNumber })}
              </span>
            </div>
            <p className="trade-card-sub">{t('treeCareStage', { value: guide.stage })}</p>
            <p className="trade-card-sub">{guide.instructions}</p>
            <p className="trade-card-sub">
              {t('treeCareWatering', { value: guide.wateringRule })}
            </p>
            <p className="trade-card-sub">
              {t('treeCareFertilizer', { value: guide.fertilizerSchedule })}
            </p>
            <p className="trade-card-sub">
              {t('treeCarePest', { value: guide.pestProtection })}
            </p>
          </div>
        ))}
      </section>
    </ToolShell>
  );
}
