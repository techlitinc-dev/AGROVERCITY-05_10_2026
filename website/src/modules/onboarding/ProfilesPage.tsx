import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Star, Users } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useT } from '@/i18n';
import { PERSONAS } from '@/config/personas';
import type { ProfileType } from '@/state/SessionContext';
import { cx } from '@/lib/format';

export default function ProfilesPage() {
  const navigate = useNavigate();
  const t = useT();
  const [selected, setSelected] = useState<ProfileType[]>(['farmer']);
  const [primary, setPrimary] = useState<ProfileType>('farmer');

  const toggle = (p: ProfileType) => {
    setSelected((list) => {
      if (list.includes(p)) {
        if (list.length === 1) return list;
        const next = list.filter((x) => x !== p);
        if (primary === p) setPrimary(next[0]);
        return next;
      }
      return [...list, p];
    });
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6">
      <p className="text-xs font-semibold text-muted">{t('चरण 2 / 4', 'Step 2 of 4')}</p>
      <h1 className="text-2xl font-bold text-ink">{t('अपनी प्रोफ़ाइल चुनें', 'Select your profiles')}</h1>
      <p className="text-sm text-muted">{t('एक या अधिक चुनें · तारा वाली मुख्य प्रोफ़ाइल', 'Pick one or more · starred is primary')}</p>
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(PERSONAS) as ProfileType[]).map((p, i) => {
          const meta = PERSONAS[p];
          const on = selected.includes(p);
          return (
            <Card
              key={p}
              className={cx('animate-fade-up cursor-pointer', on && 'ring-2 ring-primary')}
              style={{ ['--stagger' as string]: `${i * 50}ms` }}
              onClick={() => toggle(p)}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className={cx('flex h-10 w-10 items-center justify-center rounded-xl', meta.chipClass)}>
                    <Users size={20} aria-hidden />
                  </span>
                  {on &&
                    (primary === p ? (
                      <Star size={18} className="fill-equipment text-equipment" aria-label="primary" />
                    ) : (
                      <button
                        aria-label="make primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPrimary(p);
                        }}
                        className="flex min-h-11 min-w-11 items-center justify-center"
                      >
                        <Star size={18} className="text-ink/25" />
                      </button>
                    ))}
                </div>
                <div>
                  <p className="text-sm font-bold text-ink">{meta.hi}</p>
                  <p className="text-xs text-muted">{meta.en}</p>
                </div>
                {on && <CheckCircle2 size={16} className="text-primary" aria-hidden />}
              </div>
            </Card>
          );
        })}
      </div>
      <Button size="lg" className="mt-auto" onClick={() => navigate('/onboarding/login')}>
        {t('आगे बढ़ें', 'Continue')}
      </Button>
    </div>
  );
}
