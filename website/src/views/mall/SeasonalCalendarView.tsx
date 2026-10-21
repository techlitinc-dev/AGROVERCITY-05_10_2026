import React, { useEffect, useMemo, useState } from 'react';
import { Apple, CalendarDays, ChefHat, Info, Salad } from 'lucide-react';
import { apiErrorMessage, customer } from '../../lib/api';

interface SeasonalMonth {
  month: string;
  produce: string[];
}

interface NutritionGuide {
  id: string;
  title: string;
  items: string[];
  note: string;
}

interface SeasonalRecipe {
  id: string;
  title: string;
  produce: string[];
  steps: string;
  nutritionNote: string;
}

interface SeasonalPayload {
  months: SeasonalMonth[];
  guides: NutritionGuide[];
  recipes: SeasonalRecipe[];
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CURRENT_MONTH = MONTHS[new Date().getMonth()];

function asPayload(doc: unknown): SeasonalPayload {
  const d = (doc ?? {}) as Partial<SeasonalPayload>;
  return {
    months: Array.isArray(d.months) ? d.months : [],
    guides: Array.isArray(d.guides) ? d.guides : [],
    recipes: Array.isArray(d.recipes) ? d.recipes : [],
  };
}

export const SeasonalCalendarView: React.FC = () => {
  const [payload, setPayload] = useState<SeasonalPayload>({ months: [], guides: [], recipes: [] });
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const doc = await customer.seasonal();
        if (mounted) setPayload(asPayload(doc));
      } catch (e) {
        if (mounted) setError(apiErrorMessage(e));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const monthProduce = useMemo(
    () => payload.months.find((m) => m.month === selectedMonth)?.produce ?? [],
    [payload, selectedMonth]
  );

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="h-8 bg-slate-100 rounded w-72 animate-pulse" />
        <div className="h-12 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-3xl border border-slate-200/80 p-4 space-y-3 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-2/3" />
              <div className="h-20 bg-slate-100 rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <CalendarDays className="w-7 h-7 text-emerald-600" />
          Nutrition & Seasonal Calendar
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          What is naturally in season each month in Maharashtra — fresher, cheaper and more nutritious
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">{error}</div>
      )}

      {/* Month selector */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4">
        <div className="flex flex-wrap gap-2">
          {MONTHS.map((month) => (
            <button
              key={month}
              type="button"
              onClick={() => setSelectedMonth(month)}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all ${
                selectedMonth === month
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : month === CURRENT_MONTH
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {month}
            </button>
          ))}
        </div>
      </div>

      {/* In-season produce */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
          <Salad className="w-4 h-4 text-emerald-600" />
          In season in {selectedMonth}
        </h3>
        {monthProduce.length === 0 ? (
          <p className="text-xs text-slate-400">No produce listed for this month yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {monthProduce.map((item) => (
              <span
                key={item}
                className="px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold"
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Nutrition guides */}
      {payload.guides.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <Apple className="w-4 h-4 text-emerald-600" />
            Nutrition guides
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {payload.guides.map((guide) => (
              <div key={guide.id} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
                <h4 className="font-extrabold text-xs text-slate-900">{guide.title}</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(guide.items ?? []).map((item) => (
                    <span
                      key={item}
                      className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-bold"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed flex gap-1.5">
                  <Info className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
                  <span>{guide.note}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recipes */}
      {payload.recipes.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-emerald-600" />
            Seasonal recipes
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {payload.recipes.map((recipe) => (
              <div key={recipe.id} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
                <h4 className="font-extrabold text-xs text-slate-900">{recipe.title}</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(recipe.produce ?? []).map((item) => (
                    <span
                      key={item}
                      className="px-2.5 py-1 rounded-full bg-lime-50 border border-lime-200 text-lime-700 text-[10px] font-bold"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">{recipe.steps}</p>
                <p className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 leading-relaxed">
                  {recipe.nutritionNote}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
