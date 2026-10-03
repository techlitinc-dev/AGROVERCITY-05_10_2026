import { useState } from 'react';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import ChipSelect from '../../components/ChipSelect';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { createLead, updateLead, type Lead, type LeadType } from '../../lib/api/broker';
import { useT } from '../../lib/i18n';

const TYPES: LeadType[] = ['farmer', 'buyer', 'trader'];

interface LeadFormSheetProps {
  /** null = create mode. */
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/** Create / edit lead — the lightweight CRM entry (plan §5.1 B-adjacent). */
export default function LeadFormSheet({ lead, open, onClose, onSaved }: LeadFormSheetProps) {
  const t = useT();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<LeadType>('farmer');
  const [commodity, setCommodity] = useState('');
  const [quantityExpected, setQuantityExpected] = useState('');
  const [targetRate, setTargetRate] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Seed state when the sheet opens for a specific lead.
  const openFor = lead?.id ?? 'new';
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (open && seededFor !== openFor) {
    setSeededFor(openFor);
    setName(lead?.name ?? '');
    setPhone(lead?.phone ?? '');
    setType(lead?.type ?? 'farmer');
    setCommodity(lead?.commodity ?? '');
    setQuantityExpected(lead?.quantityExpected ? String(lead.quantityExpected) : '');
    setTargetRate(lead?.targetRate ? String(lead.targetRate) : '');
    setLocation(lead?.location ?? '');
    setNotes(lead?.notes ?? '');
    setErrors({});
  }

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t('commonRequired');
    if (!phone.trim()) next.phone = t('commonRequired');
    setErrors(next);
    if (Object.keys(next).length > 0 || busy) return;
    setBusy(true);
    const body = {
      name: name.trim(),
      phone: phone.trim(),
      type,
      commodity: commodity.trim() || undefined,
      quantityExpected: quantityExpected ? Number(quantityExpected) : undefined,
      targetRate: targetRate ? Number(targetRate) : undefined,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    try {
      if (lead) {
        await updateLead(lead.id, body);
      } else {
        await createLead(body);
      }
      toast(t(lead ? 'leadsUpdatedToast' : 'leadsCreatedToast'));
      onClose();
      onSaved();
    } catch (e) {
      if (isApiError(e) && e.fieldErrors) {
        setErrors(e.fieldErrors);
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={t(lead ? 'leadFormTitleEdit' : 'leadFormTitleNew')}
    >
      <LabeledTextField
        label={t('lfName')}
        value={name}
        onChange={setName}
        error={errors.name}
        required
      />
      <LabeledTextField
        label={t('lfPhone')}
        value={phone}
        onChange={setPhone}
        prefix="+91"
        inputMode="tel"
        error={errors.phone}
        required
      />
      <div className="av-field">
        <span className="av-label">{t('lfType')}</span>
        <ChipSelect
          options={TYPES.map((tp) => t(`leadsType_${tp}`))}
          selected={[t(`leadsType_${type}`)]}
          onToggle={(label) => {
            const found = TYPES.find((tp) => t(`leadsType_${tp}`) === label);
            if (found) setType(found);
          }}
          single
        />
      </div>
      <LabeledTextField
        label={t('lfCommodity')}
        value={commodity}
        onChange={setCommodity}
        placeholder={t('lotsCropPlaceholder')}
      />
      <LabeledTextField
        label={t('lfQty')}
        value={quantityExpected}
        onChange={setQuantityExpected}
        type="number"
        inputMode="decimal"
      />
      <LabeledTextField
        label={t('lfTargetRate')}
        value={targetRate}
        onChange={setTargetRate}
        type="number"
        inputMode="numeric"
        prefix="₹"
      />
      <LabeledTextField label={t('lfLocation')} value={location} onChange={setLocation} />
      <LabeledTextField label={t('lfNotes')} value={notes} onChange={setNotes} maxLength={300} />
      <div className="trade-actions">
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => void submit()}
          disabled={busy}
        >
          {busy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
        </button>
        <button type="button" className="av-btn av-btn-ghost" onClick={onClose} disabled={busy}>
          {t('commonCancel')}
        </button>
      </div>
    </ModalSheet>
  );
}
