import LabeledTextField from '../../../components/LabeledTextField';
import { useT } from '../../../lib/i18n';
import type { MedicineInput, PrescriptionPayload } from '../../../lib/api/vetnet';

interface RxEditorProps {
  value: PrescriptionPayload;
  onChange: (next: PrescriptionPayload) => void;
  errors: Record<string, string>;
}

/** Prescription editor shared by appointment completion and the prescriptions page. */
export default function RxEditor({ value, onChange, errors }: RxEditorProps) {
  const t = useT();
  const medicines = value.medicines ?? [];

  const patch = (p: Partial<PrescriptionPayload>) => onChange({ ...value, ...p });

  const patchMed = (index: number, p: Partial<MedicineInput>) => {
    patch({ medicines: medicines.map((m, i) => (i === index ? { ...m, ...p } : m)) });
  };

  return (
    <div className="vetnet-form" style={{ marginTop: 0 }}>
      <div className="vetnet-field-label">📝 {t('vetnetRxSection')}</div>
      <LabeledTextField
        label={t('vetnetRxDiagnosis')}
        value={value.diagnosis}
        onChange={(v) => patch({ diagnosis: v })}
        error={errors.diagnosis}
        required
      />
      <div className="vetnet-field-label">{t('vetnetRxMedicines')}</div>
      {medicines.map((med, i) => (
        <div key={i} className="vetnet-med">
          <div className="vetnet-med-head">
            <span className="vetnet-med-title">
              {t('vetnetRxMedName')} #{i + 1}
            </span>
            <button type="button" className="vetnet-med-remove" onClick={() => patch({ medicines: medicines.filter((_, j) => j !== i) })}>
              ✕ {t('vetnetRxRemove')}
            </button>
          </div>
          <LabeledTextField
            label={t('vetnetRxMedName')}
            value={med.name}
            onChange={(v) => patchMed(i, { name: v })}
            error={errors[`medName${i}`]}
            required
          />
          <LabeledTextField
            label={t('vetnetRxDosage')}
            value={med.dosage ?? ''}
            onChange={(v) => patchMed(i, { dosage: v })}
          />
          <LabeledTextField
            label={t('vetnetRxFrequency')}
            value={med.frequency ?? ''}
            onChange={(v) => patchMed(i, { frequency: v })}
          />
          <LabeledTextField
            label={t('vetnetRxDuration')}
            value={med.durationDays ? String(med.durationDays) : ''}
            onChange={(v) => patchMed(i, { durationDays: Number(v) || 0 })}
            type="number"
            inputMode="numeric"
          />
          <LabeledTextField
            label={t('vetnetRxMedNotes')}
            value={med.notes ?? ''}
            onChange={(v) => patchMed(i, { notes: v })}
          />
        </div>
      ))}
      <div style={{ marginTop: 8 }}>
        <button type="button" className="av-btn av-btn-ghost" onClick={() => patch({ medicines: [...medicines, { name: '' }] })}>
          ＋ {t('vetnetRxAddMedicine')}
        </button>
      </div>
      <LabeledTextField
        label={t('vetnetRxAdvice')}
        value={value.advice ?? ''}
        onChange={(v) => patch({ advice: v })}
      />
      <LabeledTextField
        label={t('vetnetRxMilkWithdrawal')}
        value={value.milkWithdrawalDays ? String(value.milkWithdrawalDays) : ''}
        onChange={(v) => patch({ milkWithdrawalDays: Number(v) || 0 })}
        type="number"
        inputMode="numeric"
        error={errors.milkWithdrawalDays}
      />
      <div className="av-field">
        <label className="av-label">{t('vetnetRxFollowUp')}</label>
        <input
          className="av-input"
          type="date"
          value={value.followUpDate ?? ''}
          onChange={(e) => patch({ followUpDate: e.target.value })}
        />
      </div>
    </div>
  );
}
