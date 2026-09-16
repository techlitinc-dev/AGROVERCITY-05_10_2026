import { useState } from 'react';
import { Award, RefreshCw, Scale } from 'lucide-react';
import { api, ApiError, EP, type MandiCompareRow } from '@/api/client';
import { Badge, Button, Card, FilterChips, Skeleton, SliderRow } from '@/components/ui';
import { useT } from '@/i18n';
import { useToast } from '@/state/ToastContext';
import { cx, formatInr, formatNumber } from '@/lib/format';
import { cropLabel } from './mandiUi';

const COMPARE_CROPS = ['tomato', 'onion', 'wheat'];

interface SmartCompareProps {
  crops?: string[];
}

export function SmartCompare({ crops }: SmartCompareProps) {
  const t = useT();
  const { toast } = useToast();
  const options = crops && crops.length > 0 ? crops : COMPARE_CROPS;
  const [crop, setCrop] = useState(options[0]);
  const [quantity, setQuantity] = useState(10);
  const [rows, setRows] = useState<MandiCompareRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compare = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<MandiCompareRow[]>(EP.mandi.compare, {
        query: { crop, quantityQuintals: quantity },
      });
      const ranked = [...res].sort((a, b) => b.netProfit - a.netProfit);
      setRows(ranked);
      if (ranked.length > 0) {
        toast(t(`${ranked[0].mandiName} सबसे लाभदायक मंडी है`, `${ranked[0].mandiName} is the most profitable mandi`), 'success');
      }
    } catch (e) {
      setRows(null);
      setError(e instanceof ApiError ? e.message : t('कुछ गड़बड़ हुई', 'Something went wrong'));
    } finally {
      setLoading(false);
    }
  };

  const maxProfit = rows ? Math.max(...rows.map((r) => Math.abs(r.netProfit)), 1) : 1;

  return (
    <Card className="mb-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Scale size={18} aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-bold text-ink">{t('स्मार्ट मंडी चयन', 'Smart Mandi Selection')}</h2>
          <p className="text-xs text-muted">{t('ट्रांसपोर्ट खर्च के बाद शुद्ध लाभ तुलना', 'Net profit after transport cost')}</p>
        </div>
      </div>

      <FilterChips
        className="mb-3"
        options={options.map((c) => ({ value: c, label: cropLabel(t, c) }))}
        selected={crop}
        onSelect={setCrop}
      />
      <SliderRow
        label={t('उपज मात्रा', 'Produce quantity')}
        value={quantity}
        min={1}
        max={100}
        format={(v) => `${formatNumber(v)} ${t('क्विंटल', 'qtl')}`}
        onChange={setQuantity}
      />
      <Button className="mt-2 w-full" onClick={compare} disabled={loading}>
        {loading ? t('गणना जारी…', 'Calculating…') : t('मंडियों की तुलना करें', 'Compare mandis')}
      </Button>

      {loading && (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      )}

      {!loading && error && (
        <div className="mt-4 rounded-xl bg-danger/5 p-3 text-center">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={compare}>
            <RefreshCw size={14} aria-hidden />
            {t('पुनः प्रयास करें', 'Retry')}
          </Button>
        </div>
      )}

      {!loading && !error && rows && (
        <ol className="mt-4 space-y-2">
          {rows.map((row, i) => {
            const best = i === 0;
            return (
              <li
                key={row.mandiName}
                className={cx(
                  'rounded-xl border p-3',
                  best ? 'border-primary/30 bg-primary/5' : 'border-ink/10 bg-white',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                    {best && <Award size={15} className="text-primary" aria-hidden />}
                    {row.mandiName}
                  </p>
                  {best && <Badge tone="success">{t('सर्वोत्तम मंडी', 'Best mandi')}</Badge>}
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <p className="text-muted">{t('मोडल भाव', 'Modal')}</p>
                    <p className="font-semibold text-ink">{formatInr(row.modalPrice)}</p>
                  </div>
                  <div>
                    <p className="text-muted">{t('ट्रांसपोर्ट', 'Transport')}</p>
                    <p className="font-semibold text-danger">−{formatInr(row.transportCost)}</p>
                  </div>
                  <div>
                    <p className="text-muted">{t('शुद्ध लाभ', 'Net profit')}</p>
                    <p className={cx('font-extrabold', row.netProfit >= 0 ? 'text-success' : 'text-danger')}>
                      {formatInr(row.netProfit)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/5" aria-hidden>
                  <div
                    className={cx('h-full rounded-full', row.netProfit >= 0 ? 'bg-success' : 'bg-danger')}
                    style={{ width: `${Math.max(4, (Math.abs(row.netProfit) / maxProfit) * 100)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
