import { useNavigate } from 'react-router-dom';
import { ClipboardList, MapPinned, Tractor } from 'lucide-react';
import { Button, Card, Timeline } from '@/components/ui';
import { useT } from '@/i18n';

export default function RegisterPage() {
  const navigate = useNavigate();
  const t = useT();

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold text-ink">{t('रजिस्ट्रेशन', 'Register')}</h1>
      <Card>
        <Timeline
          steps={[
            {
              title: t('पहचान व संपर्क', 'Identity & contact'),
              subtitle: t('नाम, राज्य, मोबाइल + OTP', 'Name, state, mobile + OTP'),
              status: 'current',
            },
            {
              title: t('सुरक्षा', 'Security'),
              subtitle: t('4-अंकीय MPIN दो बार सेट करें', 'Set 4-digit MPIN twice'),
              status: 'pending',
            },
            {
              title: t('खेत की जानकारी', 'Farm details'),
              subtitle: t('गांव, ज़मीन, मिट्टी, फसलें', 'Village, land, soil, crops'),
              status: 'pending',
            },
          ]}
        />
      </Card>
      <Card className="flex items-center gap-3">
        <ClipboardList size={22} className="shrink-0 text-primary" aria-hidden />
        <p className="text-sm text-muted">
          {t('पूरा रजिस्ट्रेशन विज़ार्ड जल्द आ रहा है', 'Full registration wizard coming soon')}
        </p>
      </Card>
      <Button size="lg" className="mt-auto" onClick={() => navigate('/onboarding/farm-map')}>
        <MapPinned size={18} aria-hidden />
        {t('खेत का नक्शा सेट करें', 'Set farm map')}
      </Button>
      <Button variant="ghost" onClick={() => navigate('/onboarding/login')}>
        <Tractor size={18} aria-hidden />
        {t('पहले से खाता है? लॉगिन', 'Have an account? Login')}
      </Button>
    </div>
  );
}
