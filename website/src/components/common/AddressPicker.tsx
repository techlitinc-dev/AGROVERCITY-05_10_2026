import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Loader2, MapPin, Navigation, Search } from 'lucide-react';
import { addresses, AddressInput, SavedAddress, apiErrorMessage } from '../../lib/api';
import { loadGoogleMaps } from '../../lib/googleMaps';
import { cn } from '../../lib/utils';
import { ModalSheet } from './ModalSheet';

export const ADDRESS_LABEL_CHOICES = ['Home', 'Office', 'Farm', 'Warehouse', 'Shop', 'Other'] as const;

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };

const PIN_PATH = 'M12 2C8.13 2 5 5.13 5 8.5c0 5.25 7 13 7 13s7-7.75 7-13C19 5.13 15.87 2 12 2z';
const pinIcon = (fill: string): google.maps.Symbol => ({
  path: PIN_PATH,
  fillColor: fill,
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 1.5,
  scale: 1.7,
  anchor: new google.maps.Point(12, 21),
});

interface AddressPickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the persisted address (create or update). */
  onSaved: (addr: SavedAddress) => void;
  /** Edit mode: prefill every field from this address. */
  initial?: SavedAddress | null;
  /** Suggested label for a fresh address (e.g. "Farm" from the land flow). */
  defaultLabel?: string;
  title?: string;
}

type MapState = 'loading' | 'ready' | 'failed';

const emptyForm = (defaultLabel: string): AddressInput => ({
  label: defaultLabel,
  customLabel: '',
  line1: '',
  landmark: '',
  village: '',
  district: '',
  state: '',
  pincode: '',
  contactName: '',
  contactPhone: '',
  lat: null,
  lng: null,
  isDefault: false,
});

/**
 * Swiggy/Zomato-style address capture: pick the exact spot on the map (drag
 * the pin, search, or use the current location) — the village/district/state/
 * PIN fields prefill from the pin via reverse geocoding — then complete the
 * label + house/plot details and save. Falls back to a pure form when the
 * Google Maps key is missing so the flow never blocks.
 */
export const AddressPicker: React.FC<AddressPickerProps> = ({
  isOpen,
  onClose,
  onSaved,
  initial,
  defaultLabel = 'Home',
  title,
}) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const mapObjRef = useRef<google.maps.Map | null>(null);
  const suppressGeocodeRef = useRef(false);

  const [form, setForm] = useState<AddressInput>(emptyForm(defaultLabel));
  const [mapState, setMapState] = useState<MapState>('loading');
  const [geoBusy, setGeoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinHint, setPinHint] = useState<string | null>(null);

  // Reset the form each time the sheet opens (edit → prefill, add → blank).
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setPinHint(null);
    if (initial) {
      setForm({
        label: initial.label || defaultLabel,
        customLabel: initial.customLabel ?? '',
        line1: initial.line1 ?? '',
        landmark: initial.landmark ?? '',
        village: initial.village ?? '',
        district: initial.district ?? '',
        state: initial.state ?? '',
        pincode: initial.pincode ?? '',
        contactName: initial.contactName ?? '',
        contactPhone: initial.contactPhone ?? '',
        lat: initial.lat ?? null,
        lng: initial.lng ?? null,
        isDefault: !!initial.isDefault,
      });
    } else {
      setForm(emptyForm(defaultLabel));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initial]);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setMapState('loading');
    loadGoogleMaps().then((ok) => {
      if (alive) setMapState(ok ? 'ready' : 'failed');
    });
    return () => {
      alive = false;
    };
  }, [isOpen]);

  /** Apply reverse-geocode results to the empty-ish address fields. */
  const applyGeocode = (result: google.maps.GeocoderResult) => {
    const comp = (type: string): string => {
      const c = result.address_components?.find((x) => x.types.includes(type));
      return c?.long_name || '';
    };
    const street = [comp('street_number'), comp('route')].filter(Boolean).join(' ');
    setForm((f) => ({
      ...f,
      // Only auto-fill fields the user hasn't typed over.
      line1: f.line1 || street || result.formatted_address?.split(',')[0] || '',
      village: f.village || comp('locality') || comp('sublocality_level_1') || comp('route'),
      district: f.district || comp('administrative_area_level_2'),
      state: f.state || comp('administrative_area_level_1'),
      pincode: f.pincode || comp('postal_code'),
    }));
    setPinHint(result.formatted_address || null);
  };

  const reverseGeocode = (lat: number, lng: number) => {
    const g = window.google;
    if (!g?.maps) return;
    new g.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results && results.length > 0) applyGeocode(results[0]);
    });
  };

  const placeMarker = (lat: number, lng: number, geocode: boolean) => {
    suppressGeocodeRef.current = !geocode;
    setForm((f) => ({ ...f, lat, lng }));
    if (mapObjRef.current) mapObjRef.current.panTo({ lat, lng });
    if (markerRef.current) markerRef.current.setPosition({ lat, lng });
    if (geocode) reverseGeocode(lat, lng);
  };

  // Build the map + draggable pin + search autocomplete once the API is ready.
  useEffect(() => {
    if (!isOpen || mapState !== 'ready' || !mapRef.current) return;
    const g = window.google;
    if (!g?.maps) return;

    const start = form.lat != null && form.lng != null ? { lat: form.lat, lng: form.lng } : INDIA_CENTER;
    const map = new g.maps.Map(mapRef.current, {
      center: start,
      zoom: form.lat != null ? 14 : 5,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
      backgroundColor: '#f1f5f9',
    });
    mapObjRef.current = map;

    const marker = new g.maps.Marker({
      position: start,
      map,
      draggable: true,
      icon: pinIcon('#059669'),
      animation: g.maps.Animation.DROP,
    });
    markerRef.current = marker;

    const dragListener = marker.addListener('dragend', () => {
      const p = marker.getPosition();
      if (!p) return;
      setForm((f) => ({ ...f, lat: p.lat(), lng: p.lng() }));
      reverseGeocode(p.lat(), p.lng());
    });

    if (searchRef.current) {
      const autocomplete = new g.maps.places.Autocomplete(searchRef.current, {
        fields: ['formatted_address', 'geometry', 'address_components', 'name'],
        componentRestrictions: { country: 'in' },
      });
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        const loc = place.geometry?.location;
        if (!loc) return;
        placeMarker(loc.lat(), loc.lng(), true);
      });
    }

    return () => {
      dragListener.remove();
      marker.setMap(null);
      markerRef.current = null;
      mapObjRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapState, isOpen]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoBusy(false);
        placeMarker(pos.coords.latitude, pos.coords.longitude, true);
      },
      () => setGeoBusy(false),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const set = (key: keyof AddressInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const canSave = useMemo(
    () =>
      !!form.label &&
      (form.label !== 'Other' || !!form.customLabel?.trim()) &&
      !!form.line1.trim() &&
      !!form.village.trim() &&
      !!form.district.trim() &&
      !!form.state.trim() &&
      /^\d{6}$/.test(form.pincode),
    [form]
  );

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload: AddressInput = {
        ...form,
        customLabel: form.label === 'Other' ? form.customLabel?.trim() : '',
        landmark: form.landmark?.trim() || '',
        contactName: form.contactName?.trim() || '',
        contactPhone: form.contactPhone?.trim() || '',
      };
      const saved = initial ? await addresses.update(initial.id, payload) : await addresses.create(payload);
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none bg-white';

  return (
    <ModalSheet
      isOpen={isOpen}
      onClose={onClose}
      title={title || (initial ? 'Edit address' : 'Add new address')}
      description="Drop the pin on your exact location, then complete the details."
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {mapState === 'ready' && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={searchRef}
                placeholder="Search village, town or landmark…"
                className={cn(inputCls, 'pl-9')}
              />
            </div>
            <div className="relative">
              <div ref={mapRef} className="h-64 rounded-2xl overflow-hidden border border-slate-200" />
              <button
                type="button"
                onClick={useCurrentLocation}
                className="absolute right-2 bottom-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white shadow-md border border-slate-200 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50"
              >
                {geoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
                Current location
              </button>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <Navigation className="w-3 h-3" /> Drag the pin to adjust — fields below fill from the pin.
            </p>
            {pinHint && <p className="text-[11px] text-emerald-700 font-semibold truncate">{pinHint}</p>}
          </div>
        )}
        {mapState === 'failed' && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
            <MapPin className="w-6 h-6 text-slate-300 mx-auto mb-1" />
            <p className="text-[11px] text-slate-500">
              Map unavailable (no VITE_GOOGLE_MAPS_API_KEY) — type the address details below.
            </p>
          </div>
        )}

        <div>
          <span className="block text-xs font-bold text-slate-700 mb-1.5">Label</span>
          <div className="flex flex-wrap gap-1.5">
            {ADDRESS_LABEL_CHOICES.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setForm((f) => ({ ...f, label: l }))}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-bold border transition-colors',
                  form.label === l
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400'
                )}
              >
                {l}
              </button>
            ))}
          </div>
          {form.label === 'Other' && (
            <input
              value={form.customLabel ?? ''}
              onChange={set('customLabel')}
              placeholder="Custom label, e.g. Godown 2"
              className={cn(inputCls, 'mt-2')}
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">House / Plot no. & street *</label>
            <input value={form.line1} onChange={set('line1')} className={inputCls} placeholder="e.g. Plot 12, Shivaji Road" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">Landmark</label>
            <input value={form.landmark ?? ''} onChange={set('landmark')} className={inputCls} placeholder="e.g. Near Gram Panchayat" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Village / Town *</label>
            <input value={form.village} onChange={set('village')} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">District *</label>
            <input value={form.district} onChange={set('district')} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">State *</label>
            <input value={form.state} onChange={set('state')} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">PIN code *</label>
            <input
              value={form.pincode}
              onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
              className={inputCls}
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Contact person</label>
            <input value={form.contactName ?? ''} onChange={set('contactName')} className={inputCls} placeholder="Optional" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Contact phone</label>
            <input
              value={form.contactPhone ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value.replace(/[^\d+]/g, '').slice(0, 13) }))}
              className={inputCls}
              placeholder="Optional"
              inputMode="tel"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
          <input
            type="checkbox"
            checked={!!form.isDefault}
            onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
            className="accent-emerald-600"
          />
          Make this my default address
        </label>

        {error && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5">{error}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saving}
          className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {initial ? 'Save address' : 'Save & use this address'}
        </button>
      </div>
    </ModalSheet>
  );
};
