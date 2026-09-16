import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, PinInput } from '@/components/ui';
import { useSession } from '@/state/SessionContext';
import { useToast } from '@/state/ToastContext';
import { useT } from '@/i18n';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signInDemo } = useSession();
  const { toast } = useToast();
  const t = useT();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  const login = () => {
    signInDemo();
    toast(t('स्वागत है, राम सिंह जी!', 'Welcome, Ram Singh!'), 'success');
    navigate('/home', { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold text-ink">{t('लॉगिन', 'Login')}</h1>
      <Card className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">{t('मोबाइल नंबर', 'Mobile number')}</label>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="98765 43210"
            className="min-h-12 w-full rounded-xl border border-ink/15 bg-white px-3 text-lg font-semibold text-ink outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-ink">{t('4-अंकीय MPIN', '4-digit MPIN')}</label>
          <PinInput value={pin} onChange={setPin} label="MPIN" />
        </div>
        <Button size="lg" className="w-full" onClick={login}>
          {t('लॉगिन करें', 'Login')}
        </Button>
        <button
          className="w-full text-center text-sm font-semibold text-primary"
          onClick={() => toast(t('OTP से MPIN रीसेट जल्द आ रहा है', 'MPIN reset via OTP coming soon'), 'info')}
        >
          {t('MPIN भूल गए?', 'Forgot MPIN?')}
        </button>
      </Card>
      <Button variant="ghost" size="lg" onClick={() => navigate('/onboarding/register')}>
        {t('नया खाता बनाएं', 'Register new account')}
      </Button>
    </div>
  );
}
