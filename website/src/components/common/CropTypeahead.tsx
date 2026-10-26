import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Plus, Sprout, X } from 'lucide-react';
import { advisory } from '../../lib/api';

type Suggestion = {
  name: string;
  vernacularName?: string | null;
  category?: string | null;
};

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Offline fallback so the dropdown still works in dev when the API is down. */
const OFFLINE_CROPS: Suggestion[] = [
  { name: 'Soybean', vernacularName: 'सोयाबीन' },
  { name: 'Wheat', vernacularName: 'गहू' },
  { name: 'Onion', vernacularName: 'कांदा' },
  { name: 'Cotton', vernacularName: 'कापूस' },
  { name: 'Tomato', vernacularName: 'टमाटर' },
  { name: 'Maize', vernacularName: 'मका' },
  { name: 'Chickpea (Gram)', vernacularName: 'हरभरा' },
  { name: 'Sugarcane', vernacularName: 'ऊस' },
];

interface CropTypeaheadProps {
  value: string;
  onChange: (crop: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  inputCls: string;
}

/**
 * Crop typeahead dropdown backed by `/v1/reference/crops-suggest`.
 * Debounced search over the crop catalog (name, vernacular name, aliases),
 * keyboard navigable, and always offers the typed text as a custom crop so
 * farmers are never blocked by the catalog.
 */
export const CropTypeahead: React.FC<CropTypeaheadProps> = ({
  value,
  onChange,
  placeholder = 'Start typing a crop — सोयाबीन, कांदा…',
  autoFocus = false,
  inputCls,
}) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external value changes (e.g. form reset) into the input.
  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const search = (q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setBusy(true);
      try {
        const res = asRecord(await advisory.cropSuggest(q));
        const items = Array.isArray(res.items) ? (res.items as unknown[]) : [];
        setSuggestions(
          items
            .map((raw) => {
              const item = asRecord(raw);
              return {
                name: typeof item.name === 'string' ? item.name : '',
                vernacularName: typeof item.vernacularName === 'string' ? item.vernacularName : null,
                category: typeof item.category === 'string' ? item.category : null,
              };
            })
            .filter((s) => s.name)
        );
      } catch {
        const needle = q.trim().toLowerCase();
        const local = needle
          ? OFFLINE_CROPS.filter(
              (c) =>
                c.name.toLowerCase().includes(needle) ||
                (c.vernacularName ?? '').toLowerCase().includes(needle)
            )
          : OFFLINE_CROPS;
        setSuggestions(local);
      } finally {
        setBusy(false);
      }
    }, 250);
  };

  const select = (crop: string) => {
    onChange(crop);
    setQuery(crop);
    setOpen(false);
  };

  const exactMatch = useMemo(
    () => suggestions.some((s) => s.name.toLowerCase() === query.trim().toLowerCase()),
    [suggestions, query]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    const rows = suggestions.length + (query.trim() && !exactMatch ? 1 : 0);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % Math.max(rows, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + Math.max(rows, 1)) % Math.max(rows, 1));
    } else if (e.key === 'Enter' && rows > 0) {
      e.preventDefault();
      if (highlight < suggestions.length) select(suggestions[highlight].name);
      else select(query.trim());
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          className={`${inputCls} pr-8`}
          value={query}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setHighlight(0);
            setOpen(true);
            search(e.target.value);
          }}
          onFocus={() => {
            setOpen(true);
            if (suggestions.length === 0) search(query);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {suggestions.length === 0 && !busy && (
            <div className="px-3 py-2.5 text-[11px] text-slate-400 flex items-center gap-1.5">
              <Sprout className="w-3.5 h-3.5" /> No catalog match — you can still add your crop below.
            </div>
          )}
          {suggestions.map((s, i) => (
            <button
              key={`${s.name}-${i}`}
              type="button"
              onMouseEnter={() => setHighlight(i)}
              onClick={() => select(s.name)}
              className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 ${
                highlight === i ? 'bg-emerald-50' : 'bg-white'
              }`}
            >
              <span>
                <span className="block text-xs font-bold text-slate-800">{s.name}</span>
                {s.vernacularName && (
                  <span className="block text-[10px] text-slate-500">{s.vernacularName}</span>
                )}
              </span>
              {s.category && (
                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold uppercase">
                  {s.category}
                </span>
              )}
            </button>
          ))}
          {query.trim() && !exactMatch && (
            <button
              type="button"
              onMouseEnter={() => setHighlight(suggestions.length)}
              onClick={() => select(query.trim())}
              className={`w-full px-3 py-2 text-left flex items-center gap-1.5 border-t border-slate-100 ${
                highlight === suggestions.length ? 'bg-emerald-50' : 'bg-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-700">Add “{query.trim()}” as custom crop</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

interface CropChipsInputProps {
  crops: string[];
  onChange: (crops: string[]) => void;
  placeholder?: string;
}

/**
 * Multi-select crop input: typeahead + click adds a removable chip.
 * Used for crop history in the planner forms.
 */
export const CropChipsInput: React.FC<CropChipsInputProps> = ({
  crops,
  onChange,
  placeholder = 'Add crops…',
}) => {
  const [draft, setDraft] = useState('');

  const add = (crop: string) => {
    const clean = crop.trim();
    if (clean && !crops.includes(clean)) onChange([...crops, clean]);
    setDraft('');
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl border border-slate-300 bg-white">
        {crops.map((crop) => (
          <span
            key={crop}
            className="pl-2.5 pr-1 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1"
          >
            {crop}
            <button
              type="button"
              onClick={() => onChange(crops.filter((c) => c !== crop))}
              className="p-0.5 rounded hover:bg-emerald-100"
              aria-label={`Remove ${crop}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <div className="flex-1 min-w-40">
          <CropTypeahead
            value={draft}
            placeholder={placeholder}
            inputCls="w-full px-2 py-1.5 text-xs rounded-lg border border-transparent bg-transparent focus:outline-none focus:border-emerald-600"
            onChange={setDraft}
          />
        </div>
      </div>
      {draft.trim() && !crops.includes(draft.trim()) && (
        <button
          type="button"
          onClick={() => add(draft)}
          className="mt-1 text-[10px] font-bold text-emerald-700 hover:underline"
        >
          + Add “{draft.trim()}”
        </button>
      )}
    </div>
  );
};
