import { useNavigate } from 'react-router-dom';
import { LocateFixed, MapPin } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useToast } from '@/state/ToastContext';
import { useT } from '@/i18n';

export default function FarmMapPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const t = useT();

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6">
      <p className="text-xs font-semibold text-muted">{t('चरण 3 / 3', 'Step 3 of 3')}</p>
      <h1 className="text-2xl font-bold text-ink">{t('खेत का नक्शा', 'Farm map')}</h1>
      <Card padded={false} className="overflow-hidden">
        <div className="relative flex h-64 items-center justify-center bg-[repeating-linear-gradient(45deg,#e8f5e9_0_16px,#dff0e0_16px_32px)]">
          <div className="absolute h-28 w-36 rounded-lg border-2 border-dashed border-primary/70 bg-primary/10" aria-hidden />
          <MapPin size={28} className="absolute left-1/3 top-1/4 text-primary" aria-hidden />
          <MapPin size={28} className="absolute right-1/3 top-1/3 text-primary" aria-hidden />
          <MapPin size={28} className="absolute bottom-1/4 left-1/3 text-primary" aria-hidden />
          <MapPin size={28} className="absolute bottom-1/3 right-1/3 text-primary" aria-hidden />
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-ink shadow">
            {t('~5.5 एकड़', '~5.5 acres')}
          </span>
        </div>
      </Card>
      <Button
        variant="ghost"
        size="lg"
        onClick={() => toast(t('GPS लोकेशन जल्द आ रही है', 'GPS locate coming soon'), 'info')}
      >
        <LocateFixed size={18} aria-hidden />
        {t('GPS से खोजें', 'Locate via GPS')}
      </Button>
      <Button size="lg" onClick={() => navigate('/onboarding/login')}>
        {t('खेत पक्का करें', 'Confirm farm')}
      </Button>
    </div>
  );
}
