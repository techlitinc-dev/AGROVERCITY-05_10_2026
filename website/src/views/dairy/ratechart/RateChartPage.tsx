import { useCallback, useEffect, useState } from 'react';
import ModalSheet from '../../../components/ModalSheet';
import ToolShell from '../../../components/trade/ToolShell';
import { useEnsureProfile } from '../../../components/trade/useEnsureProfile';
import { toast } from '../../../components/toast';
import {
  createRateChart,
  fmtINR,
  listRateChartVersions,
  updateRateChart,
  type DairySpecies,
  type RateChart,
  type RateChartInput,
} from '../../../lib/api/dairy';
import { useT } from '../../../lib/i18n';
import EmptyState from '../components/EmptyState';
import RateChartForm from '../components/RateChartForm';
import SpeciesToggle from '../components/SpeciesToggle';
import StatusChip from '../components/StatusChip';
import { fmtDate } from '../components/SlipCard';

/** FAT/SNF rate charts (P3) — species-scoped version list + new/edit form. */
export default function RateChartPage() {
  const t = useT();
  useEnsureProfile('dairyManager');

  const [species, setSpecies] = useState<DairySpecies>('cow');
  const [charts, setCharts] = useState<RateChart[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<RateChart | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    listRateChartVersions(species)
      .then((res) => setCharts(res.data))
      .catch(() => setFailed(true));
  }, [species]);

  useEffect(load, [load]);

  const openNew = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const submit = async (payload: RateChartInput) => {
    setBusy(true);
    try {
      if (editing) await updateRateChart(editing.id, payload);
      else await createRateChart(payload);
      toast(t('dairyRcSaved'));
      setSheetOpen(false);
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="dairyConsole" backTo="/dairy/console">
      <div className="dairy-wrap">
        <div className="dairy-actions" style={{ marginTop: 4 }}>
          <button type="button" className="av-btn av-btn-primary" onClick={openNew}>
            ＋ {t('dairyRcNew')}
          </button>
        </div>

        <div className="dairy-section">
          <div className="dairy-card-row">
            <span className="dairy-section-title">{t('dairyRcVersions')}</span>
            <SpeciesToggle value={species} onChange={setSpecies} />
          </div>

          {charts === null && !failed ? <p className="dairy-hint">{t('commonLoading')}</p> : null}

          {failed ? (
            <EmptyState
              icon="📡"
              titleKey="dairyLoadFailed"
              action={
                <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                  ↻ {t('retry')}
                </button>
              }
            />
          ) : null}

          {charts !== null && charts.length === 0 ? (
            <EmptyState
              icon="📊"
              titleKey="dairyRcEmpty"
              bodyKey="dairyRcEmptyBody"
              action={
                <button type="button" className="av-btn av-btn-primary" onClick={openNew}>
                  ＋ {t('dairyRcNew')}
                </button>
              }
            />
          ) : null}

          <div className="dairy-list" style={{ marginTop: 0 }}>
            {(charts ?? []).map((chart) => (
              <button
                key={chart.id}
                type="button"
                className="dairy-card"
                onClick={() => {
                  setEditing(chart);
                  setSheetOpen(true);
                }}
              >
                <span className="dairy-card-row">
                  <span className="dairy-card-title">{fmtDate(chart.effectiveFrom)}</span>
                  {chart.active ? <StatusChip status="active" /> : null}
                </span>
                <span className="dairy-card-sub">
                  {t('dairyRateBase')}: {fmtINR(chart.baseRate)} · {t('dairyFat')}: {chart.fatBase} ·{' '}
                  {t('dairySnf')}: {chart.snfBase}
                </span>
                <span className="dairy-card-sub">
                  {t('dairyRcFatStep')}: {fmtINR(chart.fatStep)} · {t('dairyRcSnfStep')}: {fmtINR(chart.snfStep)}
                  {chart.minRate > 0 ? ` · ${t('dairyRcMinRate')}: ${fmtINR(chart.minRate)}` : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <ModalSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t(editing ? 'dairyRcEdit' : 'dairyRcNew')}
      >
        <RateChartForm
          key={editing?.id ?? 'new'}
          initial={editing}
          busy={busy}
          onSubmit={(payload) => submit(payload)}
        />
      </ModalSheet>
    </ToolShell>
  );
}
