import { Carrot, CalendarDays, Droplets, Sun } from 'lucide-react';
import { Badge, Card, EmptyState, SectionTitle } from '@/components/ui';
import { useT } from '@/i18n';

const SEASONAL: { month: string; crop: string; tip: string }[] = [
  { month: 'सितंबर', crop: 'पालक · मेथी · धनिया', tip: 'बुवाई के 20 दिन बाद पहली कटाई' },
  { month: 'अक्टूबर', crop: 'गाजर · मूली · चुकंदर', tip: 'हल्की मिट्टी में 2 सेमी गहराई पर बोएं' },
  { month: 'नवंबर', crop: 'टमाटर · बैंगन · मिर्च', tip: 'रोपाई के बाद छाया दें, नियमित पानी' },
];

export function GardenTab() {
  const t = useT();
  return (
    <div className="space-y-4">
      <Card className="animate-fade-up border-l-4 !border-l-primary bg-gradient-to-br from-accent to-card">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Carrot size={22} aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-bold text-ink">{t('किचन गार्डन प्लानर', 'Kitchen Garden Planner')}</h2>
            <p className="text-sm text-muted">
              {t('घर के आंगन में ताज़ी सब्ज़ियां — महीने के अनुसार मार्गदर्शन', 'Fresh vegetables at home — month-wise guidance')}
            </p>
          </div>
        </div>
      </Card>

      <SectionTitle title={t('इस मौसम में बोएं', 'Sow this season')} />
      <div className="grid gap-3 md:grid-cols-3">
        {SEASONAL.map((s, i) => (
          <Card key={s.month} className="animate-fade-up" style={{ ['--stagger' as string]: `${i * 80}ms` }}>
            <div className="mb-2 flex items-center justify-between">
              <Badge tone="success">
                <CalendarDays size={12} aria-hidden /> {s.month}
              </Badge>
            </div>
            <h3 className="text-sm font-bold text-ink">{s.crop}</h3>
            <p className="mt-1 text-xs text-muted">{s.tip}</p>
          </Card>
        ))}
      </div>

      <SectionTitle title={t('देखभाल के नियम', 'Care basics')} />
      <Card className="animate-fade-up">
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: Droplets, hi: 'पानी', en: 'Water', tip: 'सुबह जल्दी या शाम को — पत्तियां गीली न करें' },
            { icon: Sun, hi: 'धूप', en: 'Sunlight', tip: 'दिन में कम से कम 5–6 घंटे की धूप ज़रूरी' },
          ].map((r) => (
            <li key={r.en} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                <r.icon size={18} aria-hidden />
              </span>
              <div>
                <p className="text-sm font-bold text-ink">{t(r.hi, r.en)}</p>
                <p className="text-xs text-muted">{r.tip}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-xl bg-warn/10 p-3 text-xs text-warn">
          {t('सुझाव: रसोई के गीले कचरे से घर पर ही खाद बनाएं — बगीचे की सबसे सस्ती खुराक।', 'Tip: compost kitchen wet waste for the cheapest garden nutrition.')}
        </div>
      </Card>

      <Card>
        <EmptyState
          icon={Carrot}
          title={t('बगीचा डायरी जल्द आ रही है', 'Garden diary coming soon')}
          message={t('हर पौधे की बुवाई-कटाई का रिकॉर्ड यहां मिलेगा।', 'Track sowing and harvest for every plant here.')}
        />
      </Card>
    </div>
  );
}
