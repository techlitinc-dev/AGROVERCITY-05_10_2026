import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ToolShell from '../../../components/trade/ToolShell';
import { useEnsureProfile } from '../../../components/trade/useEnsureProfile';
import { toast } from '../../../components/toast';
import LabeledTextField from '../../../components/LabeledTextField';
import ModalSheet from '../../../components/ModalSheet';
import { isApiError } from '../../../lib/api/client';
import {
  createMember,
  deactivateMember,
  listMembers,
  updateMember,
  type DairyMember,
  type DairyMemberInput,
  type EntityStatus,
} from '../../../lib/api/dairy';
import { useT } from '../../../lib/i18n';
import EmptyState from '../components/EmptyState';
import SpeciesToggle from '../components/SpeciesToggle';

/** Create / edit member farmer; edit mode also offers deactivate (soft delete). */
export default function MemberFormPage() {
  const t = useT();
  const navigate = useNavigate();
  const { memberId } = useParams<{ memberId: string }>();
  const isEdit = Boolean(memberId);
  useEnsureProfile('dairyManager');

  const [member, setMember] = useState<DairyMember | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [farmerUid, setFarmerUid] = useState('');
  const [memberCode, setMemberCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [holderName, setHolderName] = useState('');
  const [defaultSpecies, setDefaultSpecies] = useState<'cow' | 'buffalo'>('cow');
  const [deduction, setDeduction] = useState('');
  const [status, setStatus] = useState<EntityStatus>('active');

  useEffect(() => {
    if (!memberId) return;
    listMembers({ status: 'all', pageSize: 500 })
      .then((res) => {
        const found = res.data.find((m) => m.id === memberId);
        if (!found) {
          setNotFound(true);
          return;
        }
        setMember(found);
        setName(found.name);
        setPhone(found.phone);
        setVillage(found.village);
        setFarmerUid(found.farmerUid);
        setMemberCode(found.memberCode);
        setAccountNumber(found.bankDetails?.accountNumber ?? '');
        setIfsc(found.bankDetails?.ifsc ?? '');
        setHolderName(found.bankDetails?.holderName ?? '');
        setDefaultSpecies(found.defaultSpecies);
        setDeduction(found.deduction > 0 ? String(found.deduction) : '');
        setStatus(found.status);
      })
      .catch((e) => {
        if (isApiError(e) && e.status === 404) setNotFound(true);
        else setNotFound(true);
      });
  }, [memberId]);

  const save = async () => {
    if (busy) return;
    if (!name.trim()) {
      setErrors({ name: t('commonRequired') });
      return;
    }
    setBusy(true);
    setErrors({});
    const payload: DairyMemberInput = {
      name: name.trim(),
      phone: phone.trim(),
      village: village.trim(),
      farmerUid: farmerUid.trim(),
      memberCode: memberCode.trim(),
      bankDetails: {
        accountNumber: accountNumber.trim(),
        ifsc: ifsc.trim().toUpperCase(),
        holderName: holderName.trim(),
      },
      defaultSpecies,
      deduction: Number(deduction) || 0,
      status,
    };
    try {
      const saved = isEdit && memberId ? await updateMember(memberId, payload) : await createMember(payload);
      toast(t(isEdit ? 'dairyMemberUpdated' : 'dairyMemberCreated'));
      if (!isEdit && saved.memberCode) {
        toast(`${t('dairyMemberSavedHint')}: ${saved.memberCode}`);
      }
      navigate(`/dairy/console/members/${saved.id}`, { replace: true });
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors);
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const deactivate = useCallback(async () => {
    if (!memberId || busy) return;
    setBusy(true);
    try {
      await deactivateMember(memberId);
      toast(t('dairyMemberDeactivated'));
      navigate('/dairy/console/members', { replace: true });
    } catch {
      toast(t('actionFailed'), { error: true });
      setDeleting(false);
    } finally {
      setBusy(false);
    }
  }, [memberId, busy, navigate, t]);

  if (notFound) {
    return (
      <ToolShell toolId="dairyConsole" backTo="/dairy/console/members">
        <EmptyState
          icon="🔍"
          titleKey="dairyMemberNotFound"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={() => navigate('/dairy/console/members')}>
              ← {t('dairyQaMembers')}
            </button>
          }
        />
      </ToolShell>
    );
  }

  return (
    <ToolShell toolId="dairyConsole" backTo="/dairy/console/members">
      <div className="dairy-wrap">
        {isEdit && !member ? <p className="dairy-hint">{t('commonLoading')}</p> : null}

        <div className="dairy-form">
          <LabeledTextField
            label={t('dairyMemberName')}
            value={name}
            onChange={setName}
            error={errors.name}
            required
          />
          <LabeledTextField
            label={t('dairyMemberPhone')}
            value={phone}
            onChange={setPhone}
            type="tel"
            inputMode="tel"
            error={errors.phone}
          />
          <LabeledTextField
            label={t('dairyMemberVillage')}
            value={village}
            onChange={setVillage}
            error={errors.village}
          />
          <LabeledTextField
            label={t('dairyMemberFarmerUid')}
            value={farmerUid}
            onChange={setFarmerUid}
            placeholder="uid…"
            error={errors.farmerUid}
          />
          <p className="dairy-hint" style={{ marginTop: -10 }}>
            {t('dairyMemberFarmerUidHint')}
          </p>
          <LabeledTextField
            label={t('dairyMemberCode')}
            value={memberCode}
            onChange={setMemberCode}
            placeholder={t('dairyMemberCodePlaceholder')}
            error={errors.memberCode}
            disabled={isEdit}
          />

          <div className="dairy-section-title" style={{ margin: '10px 0 4px' }}>
            🏦 {t('dairyMemberBankSection')}
          </div>
          <LabeledTextField
            label={t('dairyMemberAccount')}
            value={accountNumber}
            onChange={setAccountNumber}
            inputMode="numeric"
            error={errors.accountNumber}
          />
          <LabeledTextField
            label={t('dairyMemberIfsc')}
            value={ifsc}
            onChange={setIfsc}
            error={errors.ifsc}
          />
          <LabeledTextField
            label={t('dairyMemberHolder')}
            value={holderName}
            onChange={setHolderName}
            error={errors.holderName}
          />

          <div className="av-field">
            <label className="av-label">{t('dairyMemberDefaultSpecies')}</label>
            <SpeciesToggle value={defaultSpecies} onChange={setDefaultSpecies} />
          </div>
          <LabeledTextField
            label={t('dairyMemberDeduction')}
            value={deduction}
            onChange={setDeduction}
            type="number"
            inputMode="decimal"
            error={errors.deduction}
          />

          <div className="av-field">
            <label className="av-label">{t('dairyMemberStatus')}</label>
            <SpeciesStatus value={status} onChange={setStatus} />
          </div>

          <div className="dairy-actions">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void save()} disabled={busy}>
              {busy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
            </button>
            {isEdit && status === 'active' ? (
              <button
                type="button"
                className="av-btn av-btn-plain"
                style={{ background: 'var(--av-error)' }}
                onClick={() => setDeleting(true)}
                disabled={busy}
              >
                {t('dairyMemberDeactivate')}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <ModalSheet open={deleting} onClose={() => setDeleting(false)} title={t('dairyMemberDeactivate')}>
        <p className="dairy-hint" style={{ marginBottom: 12 }}>
          {t('dairyMemberDeactivateBody')}
        </p>
        <div className="dairy-actions">
          <button
            type="button"
            className="av-btn av-btn-plain"
            style={{ background: 'var(--av-error)' }}
            onClick={() => void deactivate()}
            disabled={busy}
          >
            {busy ? <span className="av-spinner" aria-hidden /> : t('dairyMemberDeactivate')}
          </button>
          <button type="button" className="av-btn av-btn-ghost" onClick={() => setDeleting(false)} disabled={busy}>
            {t('commonCancel')}
          </button>
        </div>
      </ModalSheet>
    </ToolShell>
  );
}

function SpeciesStatus({
  value,
  onChange,
}: {
  value: EntityStatus;
  onChange: (value: EntityStatus) => void;
}) {
  const t = useT();
  return (
    <div className="av-chip-row">
      {(['active', 'inactive'] as const).map((s) => (
        <button
          key={s}
          type="button"
          className={`av-chip${value === s ? ' selected' : ''}`}
          onClick={() => onChange(s)}
        >
          {t(`dairy_status_${s}`)}
        </button>
      ))}
    </div>
  );
}
