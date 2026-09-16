import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Construction, RefreshCw, Sprout } from 'lucide-react';
import { api, EP, type AppConfig } from '@/api/client';
import { Button } from '@/components/ui';
import { useT } from '@/i18n';

const APP_VERSION = '1.0.0';
const PHASE1_MS = 750;
const PHASE2_MS = 1800;

type Gate = 'checking' | 'ok' | 'maintenance' | 'forceUpdate';

const SPLASH_CSS = `
@keyframes ks-elastic-pop {
  0% { transform: scale(0); opacity: 0; }
  55% { transform: scale(1.18); opacity: 1; }
  75% { transform: scale(0.94); }
  100% { transform: scale(1); opacity: 1; }
}
.ks-elastic-pop { animation: ks-elastic-pop 0.75s cubic-bezier(0.22, 1, 0.36, 1) both; }
@keyframes ks-brand-shine {
  to { background-position: 200% center; }
}
.ks-brand-title {
  background-image: linear-gradient(100deg, #1b5e20 20%, #43a047 40%, #a5d6a7 50%, #43a047 60%, #1b5e20 80%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: ks-brand-shine 3s linear infinite;
}
`;

export default function SplashPage() {
  const navigate = useNavigate();
  const t = useT();
  const [phase, setPhase] = useState<1 | 2>(1);
  const [gate, setGate] = useState<Gate>('checking');
  const [maintenanceMsg, setMaintenanceMsg] = useState('');
  const advanced = useRef(false);

  const checkGate = useCallback(async () => {
    setGate('checking');
    try {
      const cfg = await api.get<AppConfig>(EP.appConfig, {
        query: { version: APP_VERSION, platform: 'web' },
      });
      if (cfg.maintenance.active) {
        setMaintenanceMsg(cfg.maintenance.message);
        setGate('maintenance');
      } else if (cfg.forceUpdate) {
        setGate('forceUpdate');
      } else {
        setGate('ok');
      }
    } catch {
      // fail open — a down backend must never brick onboarding
      setGate('ok');
    }
  }, []);

  useEffect(() => {
    void checkGate();
  }, [checkGate]);

  useEffect(() => {
    if (phase !== 2 || gate !== 'ok' || advanced.current) return;
    const timer = setTimeout(() => {
      advanced.current = true;
      navigate('/onboarding/language', { replace: true });
    }, PHASE2_MS);
    return () => clearTimeout(timer);
  }, [phase, gate, navigate]);

  useEffect(() => {
    if (phase !== 1) return;
    const timer = setTimeout(() => setPhase(2), PHASE1_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const skip = () => {
    if (phase === 1) setPhase(2);
  };

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-accent to-bg p-6 text-center"
      onClick={skip}
      role="presentation"
    >
      <style>{SPLASH_CSS}</style>
      {phase === 1 && (
        <div className="ks-elastic-pop flex flex-col items-center gap-4">
          <span className="flex h-28 w-28 items-center justify-center rounded-3xl bg-ink text-4xl font-extrabold tracking-tight text-white shadow-2xl">
            DDS
          </span>
          <p className="text-sm font-semibold text-muted">Dynamic Digital Solutions</p>
          <p className="text-xs text-muted">{t('प्रस्तुत करता है', 'presents')}</p>
        </div>
      )}
      {phase === 2 && (
        <div className="animate-fade-up flex w-full max-w-md flex-col items-center gap-5">
          <span className="ks-elastic-pop flex h-24 w-24 items-center justify-center rounded-3xl bg-primary text-white shadow-xl">
            <Sprout size={48} aria-hidden />
          </span>
          <div>
            <h1 className="ks-brand-title text-4xl font-extrabold tracking-tight">
              AGROVERCITY
            </h1>
            <p className="mt-1 text-xl font-bold text-ink">किसान सेतु · Kisan Setu</p>
            <p className="mt-2 text-sm font-medium text-muted">
              {t('आपकी ज़मीन, आपका बिज़नेस, आपका कंट्रोल', 'Your land, your business, your control')}
            </p>
          </div>

          {gate === 'checking' && (
            <p className="flex items-center gap-2 text-xs font-semibold text-muted">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
              {t('संस्करण जाँचा जा रहा है…', 'Checking version…')}
            </p>
          )}

          {gate === 'ok' && (
            <Button size="lg" onClick={() => {
              advanced.current = true;
              navigate('/onboarding/language', { replace: true });
            }}>
              {t('शुरू करें', 'Get Started')}
              <ArrowRight size={18} aria-hidden />
            </Button>
          )}

          {gate === 'maintenance' && (
            <div className="glass-card flex flex-col items-center gap-3 p-5" role="alert">
              <Construction size={32} className="text-warn" aria-hidden />
              <h2 className="text-lg font-bold text-ink">{t('ऐप रखरखाव में है', 'Under maintenance')}</h2>
              <p className="text-sm text-muted">
                {maintenanceMsg || t('थोड़ी देर बाद पुनः प्रयास करें।', 'Please try again in a little while.')}
              </p>
              <Button variant="ghost" onClick={(e) => { e.stopPropagation(); void checkGate(); }}>
                <RefreshCw size={16} aria-hidden />
                {t('पुनः प्रयास', 'Retry')}
              </Button>
            </div>
          )}

          {gate === 'forceUpdate' && (
            <div className="glass-card flex flex-col items-center gap-3 p-5" role="alert">
              <RefreshCw size={32} className="text-danger" aria-hidden />
              <h2 className="text-lg font-bold text-ink">{t('अपडेट आवश्यक', 'Update required')}</h2>
              <p className="text-sm text-muted">
                {t('ऐप का नया संस्करण उपलब्ध है — कृपया अपडेट करें।', 'A new version of the app is available — please update.')}
              </p>
              <Button onClick={(e) => { e.stopPropagation(); void checkGate(); }}>
                {t('फिर से जाँचें', 'Check again')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
