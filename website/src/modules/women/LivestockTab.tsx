import { HeartPulse, Phone, Syringe, Thermometer } from 'lucide-react';
import { Badge, Card, SectionTitle } from '@/components/ui';
import { useT } from '@/i18n';

const TIPS: { hi: string; en: string }[] = [
  { hi: 'टीकाकरण समय पर कराएं — खुरपका-मुंहपका (FMD) हर 6 महीने में', en: 'Vaccinate on time — FMD every 6 months' },
  { hi: 'दूध देने से पहले थन धोकर सुखाएं', en: 'Wash and dry the udder before milking' },
  { hi: 'लक्षण दिखे तो पशु चिकित्सक को तुरंत बुलाएं', en: 'Call the vet immediately at first symptoms' },
];

export function LivestockTab() {
  const t = useT();
  return (
    <div className="space-y-4">
      <Card className="animate-fade-up border-l-4 !border-l-danger bg-gradient-to-br from-danger/5 to-card">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
            <HeartPulse size={22} aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-bold text-ink">{t('पशु स्वास्थ्य', 'Livestock health')}</h2>
            <p className="text-sm text-muted">
              {t('छोटे पशुओं की देखभाल — बकरी, मुर्गी, गाय-भैंस', 'Care for goats, poultry, cattle and buffalo')}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="danger">
            <Thermometer size={12} aria-hidden /> {t('बुखार पहला संकेत', 'Fever is the first sign')}
          </Badge>
          <Badge tone="warn">
            <Syringe size={12} aria-hidden /> {t('वार्षिक टीकाकरण', 'Annual vaccination')}
          </Badge>
        </div>
      </Card>

      <SectionTitle title={t('रोज़ की देखभाल', 'Daily care checklist')} />
      <Card className="animate-fade-up">
        <ul className="space-y-2.5">
          {TIPS.map((tip, i) => (
            <li key={tip.en} className="animate-fade-up flex items-start gap-2.5" style={{ ['--stagger' as string]: `${i * 70}ms` }}>
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <p className="text-sm text-ink">{t(tip.hi, tip.en)}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="animate-fade-up flex items-center gap-3 !border-l-transport border-l-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-transport/10 text-transport">
          <Phone size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">{t('पशु चिकित्सक हेल्पलाइन', 'Vet helpline')}</p>
          <p className="text-xs text-muted">{t('24×7 — पशुधन व डेयरी मॉड्यूल से बुकिंग भी करें', '24×7 — also book visits from the Livestock module')}</p>
        </div>
        <a
          href="tel:18001235678"
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-transport px-3 text-sm font-semibold text-white"
        >
          <Phone size={15} aria-hidden /> 1800-123-5678
        </a>
      </Card>
    </div>
  );
}
