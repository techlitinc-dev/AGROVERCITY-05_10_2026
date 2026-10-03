import { useEffect, useMemo, useState } from 'react';
import ChipSelect from '../../components/ChipSelect';
import LabeledTextField from '../../components/LabeledTextField';
import MultiChipWithCustom from '../../components/MultiChipWithCustom';
import { toast } from '../../components/toast';
import { fetchRegionCrops } from '../../lib/api/reference';
import { useT } from '../../lib/i18n';
import { personaByType, personaLabel, PERSONAS } from '../../lib/personas';
import { INDIAN_STATES } from '../../lib/states';
import { useOnboardingStore } from '../../stores/onboarding';
import type { ReactNode } from 'react';

const SOIL_OPTIONS_HI = [
  'काली मिट्टी (Black Cotton)',
  'लाल मिट्टी (Red Loamy)',
  'रेतीली मिट्टी (Sandy Loam)',
  'जलोढ़ मिट्टी (Alluvial)',
];
const IRRIGATION_OPTIONS_HI = [
  'ड्रिप सिंचाई (Drip)',
  'स्प्रिंकलर (Sprinkler)',
  'नहर (Canal)',
  'बोरवेल (Borewell)',
  'वर्षा आधारित (Rainfed)',
];
const BASE_CROP_OPTIONS_HI = [
  'Tomato (टमाटर)',
  'Wheat (गेहूं)',
  'Onion (प्याज)',
  'Grapes (अंगूर)',
  'Soybean (सोयाबीन)',
  'Cotton (कपास)',
];
/** Language-neutral defaults: displayed for every non-Hindi language. */
const SOIL_OPTIONS_EN = ['Black Cotton', 'Red Loamy', 'Sandy Loam', 'Alluvial'];
const IRRIGATION_OPTIONS_EN = ['Drip', 'Sprinkler', 'Canal', 'Borewell', 'Rainfed'];
const BASE_CROP_OPTIONS_EN = ['Tomato', 'Wheat', 'Onion', 'Grapes', 'Soybean', 'Cotton'];

/** Farm option chips follow the selected language (English for non-Hindi). */
function localizedFarmOptions(language: string): {
  soil: string[];
  irrigation: string[];
  crops: string[];
} {
  if (language === 'hi') {
    return {
      soil: SOIL_OPTIONS_HI,
      irrigation: IRRIGATION_OPTIONS_HI,
      crops: BASE_CROP_OPTIONS_HI,
    };
  }
  return {
    soil: SOIL_OPTIONS_EN,
    irrigation: IRRIGATION_OPTIONS_EN,
    crops: BASE_CROP_OPTIONS_EN,
  };
}
const VEHICLE_TYPES = ['Tata Ace', 'Bolero Maxi', 'Tractor Trolley'];
const MACHINE_TYPES = ['Tractor', 'Thresher', 'Harvester', 'Sprayer', 'Tiller'];
const MARKET_OPTIONS = ['Pune', 'Nashik', 'Nagpur', 'Indore', 'Surat', 'Delhi'];
const EXPERTISE_OPTIONS = [
  'Crop Advisory',
  'Soil Health',
  'Pest Control',
  'Organic Farming',
  'Dairy',
  'Farm Machinery',
];
const INTEREST_OPTIONS = ['Vegetables', 'Fruits', 'Grains', 'Dairy', 'Organic'];
const BUYER_TYPES = ['retailer', 'wholesaler', 'processor', 'exporter', 'hotel', 'institutional'];
const CATEGORY_OPTIONS = ['Vegetables', 'Fruits', 'Grains', 'Pulses', 'Spices', 'Dairy'];
const OPERATING_STATES = INDIAN_STATES;

const SELLER_DEFAULTS = { shopName: '', gstNumber: '', apmcLicense: '' };
const TRANSPORT_DEFAULTS = { vehicleType: 'Tata Ace', rcNumber: '', businessName: '', gstin: '' };
const LANDLORD_DEFAULTS = { totalLandAcres: 0.5 };
const BROKER_DEFAULTS = { marketsServed: [] as string[] };
const EQUIPMENT_DEFAULTS = { machineType: 'Tractor', machineCount: 1 };
const INSTRUCTOR_DEFAULTS = { expertise: [] as string[], qualification: '' };
const DAIRY_DEFAULTS = {
  centerName: '',
  licenseNumber: '',
  dailyCapacityLiters: 100,
  isGaushalaOperator: false,
  isVetPractitioner: false,
};
const CUSTOMER_DEFAULTS = { interests: [] as string[] };
const DIRECT_BUYER_DEFAULTS = {
  companyName: '',
  buyerType: 'retailer',
  gstin: '',
  licenseNo: '',
  capacityPerMonth: 0,
  categories: [] as string[],
  operatingStates: [] as string[],
  creditTermsDays: 0,
};
const BANK_DEFAULTS = { bankName: '', branch: '', employeeId: '' };

/** Read (and merge-write) one persona's role profile inside the wizard store. */
function useRoleProfile<T extends Record<string, unknown>>(
  type: string,
  defaults: T,
): [T, (patch: Partial<T>) => void] {
  const stored = useOnboardingStore((s) => s.wizard.roleProfiles[type]);
  const setRoleProfile = useOnboardingStore((s) => s.setRoleProfile);
  const data = useMemo(() => ({ ...defaults, ...(stored as Partial<T> | undefined) }), [stored, defaults]);
  const update = (patch: Partial<T>) => setRoleProfile(type, { ...data, ...patch });
  return [data, update];
}

function SectionCard({ title, color, children }: { title: string; color: string; children: ReactNode }) {
  return (
    <div className="section-card" style={{ borderLeftColor: color }}>
      <h3>
        <span className="section-dot" style={{ background: color }} />
        {title}
      </h3>
      {children}
    </div>
  );
}

function SliderRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
}) {
  return (
    <div className="slider-block">
      <div className="slider-head">
        <label className="av-label" style={{ margin: 0 }}>
          {label}
        </label>
        <span className="slider-value">{format(value)}</span>
      </div>
      <input
        type="range"
        className="av-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="toggle-row">
      <span>{label}</span>
      <label className="switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="track" />
      </label>
    </div>
  );
}

interface ProfileDetailsProps {
  fieldErrors: Record<string, string>;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}

/** Profiles step, phase 2 — farm details + one section per selected persona.
 *  Submitted together with the account via POST /auth/register. */
export default function ProfileDetails({ fieldErrors, submitting, onBack, onSubmit }: ProfileDetailsProps) {
  const t = useT();
  const language = useOnboardingStore((s) => s.language);
  const personas = useOnboardingStore((s) => s.personas);
  const farm = useOnboardingStore((s) => s.wizard.farm);
  const updateFarm = useOnboardingStore((s) => s.updateFarm);

  const farmOptions = localizedFarmOptions(language);
  const [suggestedCrops, setSuggestedCrops] = useState<string[]>([]);
  const cropOptions = useMemo(() => {
    const merged = [...farmOptions.crops];
    for (const crop of suggestedCrops) {
      if (!merged.includes(crop)) merged.push(crop);
    }
    return merged;
  }, [farmOptions.crops, suggestedCrops]);

  const district = farm.district;
  useEffect(() => {
    if (district.trim().length < 3) return;
    let cancelled = false;
    fetchRegionCrops(district.trim())
      .then((res) => {
        if (cancelled) return;
        setSuggestedCrops(res.suggested ?? []);
      })
      .catch(() => undefined); // suggestions are optional — silent fail
    return () => {
      cancelled = true;
    };
  }, [district]);

  const orderedPersonas = useMemo(() => {
    const selected = PERSONAS.filter((p) => personas.includes(p.type));
    return [...selected.filter((p) => p.type === 'farmer'), ...selected.filter((p) => p.type !== 'farmer')];
  }, [personas]);

  const [seller, setSeller] = useRoleProfile('seller', SELLER_DEFAULTS);
  const [transport, setTransport] = useRoleProfile('transport', TRANSPORT_DEFAULTS);
  const [landlord, setLandlord] = useRoleProfile('farmLandlord', LANDLORD_DEFAULTS);
  const [broker, setBroker] = useRoleProfile('broker', BROKER_DEFAULTS);
  const [equipment, setEquipment] = useRoleProfile('equipmentRental', EQUIPMENT_DEFAULTS);
  const [instructor, setInstructor] = useRoleProfile('instructor', INSTRUCTOR_DEFAULTS);
  const [dairy, setDairy] = useRoleProfile('dairyManager', DAIRY_DEFAULTS);
  const [customer, setCustomer] = useRoleProfile('customer', CUSTOMER_DEFAULTS);
  const [directBuyer, setDirectBuyer] = useRoleProfile('directBuyer', DIRECT_BUYER_DEFAULTS);
  const [bank, setBank] = useRoleProfile('bankManager', BANK_DEFAULTS);

  const toggleIn = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const validate = (): boolean => {
    if (personas.includes('farmer') && farm.village.trim().length === 0) {
      toast(t('enterVillagePrompt'), { error: true });
      return false;
    }
    if (personas.includes('seller') && !seller.shopName.trim()) {
      toast(t('errShopNameRequired'), { error: true });
      return false;
    }
    if (personas.includes('transport') && !transport.rcNumber.trim()) {
      toast(t('errRcRequired'), { error: true });
      return false;
    }
    if (personas.includes('broker') && broker.marketsServed.length === 0) {
      toast(t('errMarketRequired'), { error: true });
      return false;
    }
    if (personas.includes('instructor') && instructor.expertise.length === 0) {
      toast(t('errExpertiseRequired'), { error: true });
      return false;
    }
    if (personas.includes('dairyManager') && !dairy.centerName.trim()) {
      toast(t('errCenterNameRequired'), { error: true });
      return false;
    }
    if (personas.includes('directBuyer') && !directBuyer.companyName.trim()) {
      toast(t('companyName'), { error: true });
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validate() || submitting) return;
    onSubmit();
  };

  return (
    <div>
      <h1 className="av-page-title">{t('detailsTitle')}</h1>
      <p className="av-page-subtitle" style={{ marginBottom: 16 }}>
        {t('farmDetails')}
      </p>

      {orderedPersonas.map((persona) => {
        switch (persona.type) {
          case 'farmer':
            return (
              <SectionCard key="farmer" title={`${personaLabel(persona.type)} — ${t('farmDetails')}`} color={persona.color}>
                <LabeledTextField
                  label={t('village')}
                  value={farm.village}
                  onChange={(v) => updateFarm({ village: v })}
                  error={fieldErrors.village}
                  required
                />
                <LabeledTextField
                  label={t('tehsil')}
                  value={farm.tehsil}
                  onChange={(v) => updateFarm({ tehsil: v })}
                  error={fieldErrors.tehsil}
                />
                <LabeledTextField
                  label={t('district')}
                  value={farm.district}
                  onChange={(v) => updateFarm({ district: v })}
                  error={fieldErrors.district}
                />
                <SliderRow
                  label={t('landArea')}
                  value={farm.landAreaAcres}
                  onChange={(v) => updateFarm({ landAreaAcres: v })}
                  min={0.5}
                  max={25}
                  step={0.5}
                  format={(v) => `${v.toFixed(1)} ${t('acresUnit')}`}
                />
                <div className="chips-block">
                  <p className="chips-label">{t('soilType')}</p>
                  <ChipSelect
                    options={farmOptions.soil}
                    selected={farm.soilType ? [farm.soilType] : []}
                    single
                    onToggle={(v) => updateFarm({ soilType: v })}
                  />
                </div>
                <div className="chips-block">
                  <p className="chips-label">{t('irrigationType')}</p>
                  <ChipSelect
                    options={farmOptions.irrigation}
                    selected={farm.irrigationType ? [farm.irrigationType] : []}
                    single
                    onToggle={(v) => updateFarm({ irrigationType: v })}
                  />
                </div>
                <div className="chips-block">
                  <p className="chips-label">{t('crops')}</p>
                  <MultiChipWithCustom
                    options={cropOptions}
                    selected={farm.crops}
                    onToggle={(v) => updateFarm({ crops: toggleIn(farm.crops, v) })}
                    addLabel={t('addCrop')}
                    placeholder={t('cropNameHint')}
                  />
                </div>
              </SectionCard>
            );

          case 'seller':
            return (
              <SectionCard key="seller" title={t('shopDetails')} color={persona.color}>
                <LabeledTextField
                  label={t('shopName')}
                  value={seller.shopName}
                  onChange={(v) => setSeller({ shopName: v })}
                  error={fieldErrors.shopName}
                  required
                />
                <LabeledTextField
                  label={t('gstNumberOptional')}
                  value={seller.gstNumber}
                  onChange={(v) => setSeller({ gstNumber: v })}
                />
                <LabeledTextField
                  label={t('apmcLicenseOptional')}
                  value={seller.apmcLicense}
                  onChange={(v) => setSeller({ apmcLicense: v })}
                />
              </SectionCard>
            );

          case 'transport':
            return (
              <SectionCard key="transport" title={t('vehicleDetails')} color={persona.color}>
                <div className="av-field">
                  <label className="av-label">{t('vehicleType')}</label>
                  <select
                    className="av-input"
                    value={transport.vehicleType}
                    onChange={(e) => setTransport({ vehicleType: e.target.value })}
                  >
                    {VEHICLE_TYPES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <LabeledTextField
                  label={t('rcNumber')}
                  value={transport.rcNumber}
                  onChange={(v) => setTransport({ rcNumber: v })}
                  error={fieldErrors.rcNumber}
                  required
                />
                <LabeledTextField
                  label={t('businessName')}
                  value={transport.businessName}
                  onChange={(v) => setTransport({ businessName: v })}
                />
                <LabeledTextField
                  label={t('gstinOptional')}
                  value={transport.gstin}
                  onChange={(v) => setTransport({ gstin: v })}
                />
              </SectionCard>
            );

          case 'farmLandlord':
            return (
              <SectionCard key="farmLandlord" title={t('landDetails')} color={persona.color}>
                <SliderRow
                  label={t('totalLand')}
                  value={landlord.totalLandAcres}
                  onChange={(v) => setLandlord({ totalLandAcres: v })}
                  min={0.5}
                  max={100}
                  step={0.5}
                  format={(v) => `${v.toFixed(1)} ${t('acresUnit')}`}
                />
              </SectionCard>
            );

          case 'broker':
            return (
              <SectionCard key="broker" title={t('marketDetails')} color={persona.color}>
                <MultiChipWithCustom
                  options={MARKET_OPTIONS}
                  selected={broker.marketsServed}
                  onToggle={(v) => setBroker({ marketsServed: toggleIn(broker.marketsServed, v) })}
                  addLabel={t('addMarket')}
                  placeholder={t('marketNameHint')}
                />
              </SectionCard>
            );

          case 'equipmentRental':
            return (
              <SectionCard key="equipmentRental" title={t('machineDetails')} color={persona.color}>
                <div className="av-field">
                  <label className="av-label">{t('machineType')}</label>
                  <select
                    className="av-input"
                    value={equipment.machineType}
                    onChange={(e) => setEquipment({ machineType: e.target.value })}
                  >
                    {MACHINE_TYPES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <SliderRow
                  label={t('machineDetails')}
                  value={equipment.machineCount}
                  onChange={(v) => setEquipment({ machineCount: v })}
                  min={1}
                  max={20}
                  step={1}
                  format={(v) => `${v} ${t('machineUnit')}`}
                />
              </SectionCard>
            );

          case 'instructor':
            return (
              <SectionCard key="instructor" title={t('instructorDetails')} color={persona.color}>
                <LabeledTextField
                  label={t('qualificationOptional')}
                  value={instructor.qualification}
                  onChange={(v) => setInstructor({ qualification: v })}
                />
                <p className="chips-label">{t('expertiseAreas')}</p>
                <MultiChipWithCustom
                  options={EXPERTISE_OPTIONS}
                  selected={instructor.expertise}
                  onToggle={(v) => setInstructor({ expertise: toggleIn(instructor.expertise, v) })}
                  addLabel={t('add')}
                  placeholder={t('cropNameHint')}
                />
              </SectionCard>
            );

          case 'dairyManager':
            return (
              <SectionCard key="dairyManager" title={t('dairyDetails')} color={persona.color}>
                <LabeledTextField
                  label={t('centerName')}
                  value={dairy.centerName}
                  onChange={(v) => setDairy({ centerName: v })}
                  error={fieldErrors.centerName}
                  required
                />
                <LabeledTextField
                  label={t('licenseNumberOptional')}
                  value={dairy.licenseNumber}
                  onChange={(v) => setDairy({ licenseNumber: v })}
                />
                <SliderRow
                  label={t('dailyCapacity')}
                  value={dairy.dailyCapacityLiters}
                  onChange={(v) => setDairy({ dailyCapacityLiters: v })}
                  min={100}
                  max={10000}
                  step={100}
                  format={(v) => `${v} L`}
                />
                <Toggle
                  label={t('isGaushalaOperator')}
                  checked={dairy.isGaushalaOperator}
                  onChange={(v) => setDairy({ isGaushalaOperator: v })}
                />
                <Toggle
                  label={t('isVetPractitioner')}
                  checked={dairy.isVetPractitioner}
                  onChange={(v) => setDairy({ isVetPractitioner: v })}
                />
              </SectionCard>
            );

          case 'customer':
            return (
              <SectionCard key="customer" title={personaLabel(persona.type)} color={persona.color}>
                <div className="customer-note">
                  <h4>{t('customerNoteTitle')}</h4>
                  <p>{t('customerNoteBody')}</p>
                </div>
                <p className="chips-label">{t('interests')}</p>
                <ChipSelect
                  options={INTEREST_OPTIONS}
                  selected={customer.interests}
                  onToggle={(v) => setCustomer({ interests: toggleIn(customer.interests, v) })}
                />
              </SectionCard>
            );

          case 'directBuyer':
            return (
              <SectionCard key="directBuyer" title={t('directBuyerDetails')} color={persona.color}>
                <LabeledTextField
                  label={t('companyName')}
                  value={directBuyer.companyName}
                  onChange={(v) => setDirectBuyer({ companyName: v })}
                  error={fieldErrors.companyName}
                  required
                />
                <div className="av-field">
                  <label className="av-label">{t('buyerType')}</label>
                  <select
                    className="av-input"
                    value={directBuyer.buyerType}
                    onChange={(e) => setDirectBuyer({ buyerType: e.target.value })}
                  >
                    {BUYER_TYPES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <LabeledTextField
                  label={t('gstinOptional')}
                  value={directBuyer.gstin}
                  onChange={(v) => setDirectBuyer({ gstin: v })}
                />
                <LabeledTextField
                  label={t('licenseNoOptional')}
                  value={directBuyer.licenseNo}
                  onChange={(v) => setDirectBuyer({ licenseNo: v })}
                />
                <SliderRow
                  label={t('capacityPerMonth')}
                  value={directBuyer.capacityPerMonth}
                  onChange={(v) => setDirectBuyer({ capacityPerMonth: v })}
                  min={0}
                  max={10000}
                  step={100}
                  format={(v) => `${v} kg`}
                />
                <div className="chips-block">
                  <p className="chips-label">{t('categories')}</p>
                  <MultiChipWithCustom
                    options={CATEGORY_OPTIONS}
                    selected={directBuyer.categories}
                    onToggle={(v) => setDirectBuyer({ categories: toggleIn(directBuyer.categories, v) })}
                    addLabel={t('add')}
                    placeholder={t('cropNameHint')}
                  />
                </div>
                <div className="chips-block">
                  <p className="chips-label">{t('operatingStates')}</p>
                  <ChipSelect
                    options={OPERATING_STATES}
                    selected={directBuyer.operatingStates}
                    onToggle={(v) => setDirectBuyer({ operatingStates: toggleIn(directBuyer.operatingStates, v) })}
                  />
                </div>
                <SliderRow
                  label={t('creditTermsDays')}
                  value={directBuyer.creditTermsDays}
                  onChange={(v) => setDirectBuyer({ creditTermsDays: v })}
                  min={0}
                  max={120}
                  step={5}
                  format={(v) => `${v} ${t('creditTermsDays')}`}
                />
              </SectionCard>
            );

          case 'bankManager':
            return (
              <SectionCard key="bankManager" title={t('bankDetails')} color={persona.color}>
                <LabeledTextField
                  label={t('bankName')}
                  value={bank.bankName}
                  onChange={(v) => setBank({ bankName: v })}
                />
                <LabeledTextField
                  label={t('branch')}
                  value={bank.branch}
                  onChange={(v) => setBank({ branch: v })}
                />
                <LabeledTextField
                  label={t('employeeId')}
                  value={bank.employeeId}
                  onChange={(v) => setBank({ employeeId: v })}
                />
              </SectionCard>
            );

          default:
            // insuranceProvider / coldStorageProvider — link-only personas, no fields.
            return null;
        }
      })}

      <div className="wizard-actions">
        <button type="button" className="av-btn av-btn-ghost back-btn" onClick={onBack}>
          {t('back')}
        </button>
        <button
          type="button"
          className="av-btn av-btn-primary"
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting ? <span className="av-spinner" /> : t('completeRegistration')}
        </button>
      </div>
    </div>
  );
}
