import { useCallback, useEffect, useState } from 'react';
import { Briefcase, TrendingUp } from 'lucide-react';
import { Badge, Card, EmptyState, ProgressBar, Skeleton } from '@/components/ui';
import { api, EP, isApiError } from '@/api/client';
import type { HomeEnterpriseLine } from '@/api/types';
import { useT } from '@/i18n';
import { formatInr } from '@/lib/format';

interface EnterpriseRes {
  lines: HomeEnterpriseLine[];
  totalMonthlyProfit: number;
}

export function EnterpriseTab() {
  const t = useT();
  const [data, setData] = useState<EnterpriseRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.get<EnterpriseRes>(EP.women.homeEnterprise));
    } catch (e) {
      setError(isApiError(e) ? e.message : t('कुछ गड़बड़ हुई।', 'Something went wrong.'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <EmptyState
          title={t('होम एंटरप्राइज़ विवरण नहीं मिला', 'Could not load home enterprise')}
          message={error ?? undefined}
        />
      </Card>
    );
  }

  const max = Math.max(...data.lines.map((l) => l.monthlyProfit), 1);

  return (
    <div className="space-y-4">
      <Card className="animate-fade-up border-l-4 !border-l-success bg-gradient-to-br from-success/10 to-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
              <Briefcase size={22} aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink">{t('होम एंटरप्राइज़', 'Home Enterprise')}</h2>
              <p className="text-sm text-muted">{t('घर से आय के स्रोत', 'Income sources from home')}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">{t('कुल मासिक लाभ', 'Total monthly profit')}</p>
            <p className="text-xl font-extrabold text-success">{formatInr(data.totalMonthlyProfit)}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-3">
        {data.lines.map((line, i) => (
          <Card key={line.product} className="animate-fade-up" style={{ ['--stagger' as string]: `${i * 80}ms` }}>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                <TrendingUp size={18} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-ink">{line.product}</p>
                  <Badge tone="success">{formatInr(line.monthlyProfit)}/माह</Badge>
                </div>
                <div className="mt-2">
                  <ProgressBar value={line.monthlyProfit} max={max} toneClass="bg-success" />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="animate-fade-up rounded-xl bg-warn/10 p-3 text-xs text-warn">
        {t(
          'सुझाव: SHG से लघु-ऋण लेकर एंटरप्राइज़ बढ़ाएं — ब्याज दरें बैंक से कम होती हैं।',
          'Tip: grow your enterprise with a low-interest SHG micro-loan.',
        )}
      </Card>
    </div>
  );
}
