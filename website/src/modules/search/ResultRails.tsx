import type { CSSProperties, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Landmark, Newspaper, PlayCircle, ShoppingBag, Wheat } from 'lucide-react';
import { Badge, Card, SectionTitle } from '@/components/ui';
import { useT } from '@/i18n';
import { formatDateTime, formatInr } from '@/lib/format';
import type { SearchResults } from '@/api/types';

interface RailSectionProps {
  title: string;
  subtitle?: string;
  seeAllTo: string;
  seeAllLabel: string;
  stagger: number;
  children: ReactNode;
}

function RailSection({ title, subtitle, seeAllTo, seeAllLabel, stagger, children }: RailSectionProps) {
  return (
    <section className="animate-fade-up" style={{ '--stagger': stagger * 60 } as CSSProperties}>
      <SectionTitle
        title={title}
        subtitle={subtitle}
        action={
          <Link
            to={seeAllTo}
            className="flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-primary hover:bg-accent"
          >
            {seeAllLabel}
            <ChevronRight size={16} aria-hidden />
          </Link>
        }
      />
      <div className="flex items-stretch gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">{children}</div>
    </section>
  );
}

const railCard =
  'flex w-44 shrink-0 cursor-pointer flex-col gap-2 transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary';

function withQ(path: string, query: string): string {
  return `${path}?q=${encodeURIComponent(query)}`;
}

export function ResultRails({ results }: { results: SearchResults }) {
  const t = useT();
  const navigate = useNavigate();
  const q = results.query;
  const seeAll = t('सभी देखें', 'View all');

  return (
    <div className="space-y-6">
      {results.crops.length > 0 && (
        <RailSection
          title={t('फ़सलें और मंडी भाव', 'Crops & mandi prices')}
          subtitle={t('मंडी भाव देखने के लिए फ़सल चुनें', 'Tap a crop to see mandi prices')}
          seeAllTo="/mandi"
          seeAllLabel={seeAll}
          stagger={0}
        >
          {results.crops.map((c) => (
            <Card
              key={c.crop}
              className={railCard}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/mandi?crop=${encodeURIComponent(c.crop)}`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/mandi?crop=${encodeURIComponent(c.crop)}`)}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Wheat size={20} aria-hidden />
              </span>
              <div>
                <p className="text-sm font-bold text-ink">{c.vernacularName}</p>
                <p className="text-xs capitalize text-muted">{c.crop}</p>
              </div>
              <Badge tone="success">{t(`${c.mandiCount} मंडियाँ`, `${c.mandiCount} mandis`)}</Badge>
            </Card>
          ))}
        </RailSection>
      )}

      {results.products.length > 0 && (
        <RailSection
          title={t('उत्पाद', 'Products')}
          subtitle={t('बाज़ार में उपलब्ध', 'Available in the marketplace')}
          seeAllTo={withQ('/marketplace', q)}
          seeAllLabel={seeAll}
          stagger={1}
        >
          {results.products.map((p) => (
            <Card
              key={p.id}
              className={railCard}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/marketplace/product/${p.id}`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/marketplace/product/${p.id}`)}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-seller/10 text-seller">
                <ShoppingBag size={20} aria-hidden />
              </span>
              <p className="line-clamp-2 text-sm font-bold text-ink">{p.title}</p>
              <p className="mt-auto text-base font-extrabold text-primary">{formatInr(p.discountedPrice)}</p>
            </Card>
          ))}
        </RailSection>
      )}

      {results.schemes.length > 0 && (
        <RailSection
          title={t('सरकारी योजनाएं', 'Government schemes')}
          seeAllTo={withQ('/schemes', q)}
          seeAllLabel={seeAll}
          stagger={2}
        >
          {results.schemes.map((s) => (
            <Card
              key={s.id}
              className={railCard}
              role="button"
              tabIndex={0}
              onClick={() => navigate(withQ('/schemes', s.name))}
              onKeyDown={(e) => e.key === 'Enter' && navigate(withQ('/schemes', s.name))}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-transport/10 text-transport">
                <Landmark size={20} aria-hidden />
              </span>
              <p className="line-clamp-2 text-sm font-bold text-ink">{s.name}</p>
              <Badge tone="info" className="mt-auto self-start">{s.match}</Badge>
            </Card>
          ))}
        </RailSection>
      )}

      {results.news.length > 0 && (
        <RailSection
          title={t('ख़बरें', 'News')}
          seeAllTo={withQ('/news', q)}
          seeAllLabel={seeAll}
          stagger={3}
        >
          {results.news.map((n) => (
            <Card
              key={n.id}
              className={railCard}
              role="button"
              tabIndex={0}
              onClick={() => navigate(withQ('/news', q))}
              onKeyDown={(e) => e.key === 'Enter' && navigate(withQ('/news', q))}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-equipment/10 text-equipment">
                <Newspaper size={20} aria-hidden />
              </span>
              <p className="line-clamp-3 text-sm font-bold text-ink">{n.title}</p>
              <p className="mt-auto text-xs text-muted">{formatDateTime(n.timestamp)}</p>
            </Card>
          ))}
        </RailSection>
      )}

      {results.videos.length > 0 && (
        <RailSection
          title={t('ज्ञान वीडियो', 'Knowledge videos')}
          seeAllTo={withQ('/gyan-hub', q)}
          seeAllLabel={seeAll}
          stagger={4}
        >
          {results.videos.map((v) => (
            <Card
              key={v.id}
              className={railCard}
              role="button"
              tabIndex={0}
              onClick={() => navigate(withQ('/gyan-hub', q))}
              onKeyDown={(e) => e.key === 'Enter' && navigate(withQ('/gyan-hub', q))}
            >
              <span className="relative flex h-20 items-center justify-center rounded-xl bg-ink/5 text-broker">
                <PlayCircle size={32} aria-hidden />
                <span className="absolute bottom-1.5 right-1.5 rounded-md bg-ink/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {v.duration}
                </span>
              </span>
              <p className="line-clamp-2 text-sm font-bold text-ink">{v.title}</p>
            </Card>
          ))}
        </RailSection>
      )}
    </div>
  );
}
