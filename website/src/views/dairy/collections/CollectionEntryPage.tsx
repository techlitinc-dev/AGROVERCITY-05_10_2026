import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ToolShell from '../../../components/trade/ToolShell';
import { useEnsureProfile } from '../../../components/trade/useEnsureProfile';
import { toast } from '../../../components/toast';
import { isApiError } from '../../../lib/api/client';
import {
  fmtINR,
  listCollections,
  listMembers,
  recordCollection,
  type CollectionShift,
  type DairyMember,
  type MilkCollection,
} from '../../../lib/api/dairy';
import { useDairyStore, type CollectionDraft } from '../../../stores/dairy';
import { useT } from '../../../lib/i18n';
import CollectionForm from '../components/CollectionForm';
import EmptyState from '../components/EmptyState';
import MemberPicker from '../components/MemberPicker';
import SlipCard from '../components/SlipCard';
import '../../../theme/dairy-ops.css';
import '../../../lib/i18n/locales/en.dairy-ops';
import '../../../lib/i18n/locales/hi.dairy-ops';

const todayStr = (): string => new Date().toLocaleDateString('en-CA');

const defaultShift = (): CollectionShift => (new Date().getHours() < 12 ? 'morning' : 'evening');

const emptyDraft = (shift: CollectionShift): CollectionDraft => ({
  memberId: '',
  shift,
  milkType: 'cow',
  liters: '',
  fatPercent: '',
  snfPercent: '',
});

/** Single-screen collection entry (§5.3): member → liters/FAT/SNF → live rate → save → next. */
export default function CollectionEntryPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('dairyManager');

  const persistedDraft = useDairyStore((s) => s.collectionDraft);
  const saveCollectionDraft = useDairyStore((s) => s.saveCollectionDraft);

  const [members, setMembers] = useState<DairyMember[] | null>(null);
  const [membersFailed, setMembersFailed] = useState(false);
  const [member, setMember] = useState<DairyMember | null>(null);
  const [draft, setDraft] = useState<CollectionDraft>(
    () => persistedDraft ?? emptyDraft(defaultShift())
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicate, setDuplicate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<MilkCollection | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    listMembers({ status: 'active', pageSize: 500 })
      .then((res) => setMembers(res.data))
      .catch(() => setMembersFailed(true));
  }, []);

  useEffect(() => {
    if (!members || !draft.memberId) return;
    const found = members.find((m) => m.id === draft.memberId);
    if (!found) {
      const next = emptyDraft(defaultShift());
      setDraft(next);
      saveCollectionDraft(next);
      setMember(null);
      toast(t('dairyMemberDeactivated'), { error: true });
    } else {
      setMember(found);
    }
  }, [members]);

  useEffect(() => {
    if (!member || saved) return;
    let stale = false;
    listCollections({ date: todayStr(), shift: draft.shift, pageSize: 500 })
      .then((res) => {
        if (stale) return;
        setDuplicate(
          res.data.some((s) => s.memberId === member.id || s.farmerCode === member.memberCode)
        );
      })
      .catch(() => {
        if (!stale) setDuplicate(false);
      });
    return () => {
      stale = true;
    };
  }, [member, draft.shift, saved]);

  const patchDraft = (patch: Partial<CollectionDraft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    saveCollectionDraft(next);
  };

  const selectMember = (m: DairyMember) => {
    const next: CollectionDraft = {
      ...draft,
      memberId: m.id,
      milkType: m.defaultSpecies,
      liters: '',
      fatPercent: '',
      snfPercent: '',
    };
    setMember(m);
    setDraft(next);
    saveCollectionDraft(next);
    setErrors({});
  };

  const save = async () => {
    if (saving) return;
    if (!member) {
      toast(t('dairyOpsEntryPickMember'), { error: true });
      return;
    }
    const liters = Number(draft.liters);
    const fat = Number(draft.fatPercent);
    const snf = Number(draft.snfPercent);
    const errs: Record<string, string> = {};
    if (!draft.liters || !(liters > 0) || liters > 2000) errs.liters = t('dairyOpsEntryLitersRange');
    if (!draft.fatPercent || fat < 2 || fat > 14) errs.fatPercent = t('dairyOpsEntryFatRange');
    if (!draft.snfPercent || snf < 6 || snf > 14) errs.snfPercent = t('dairyOpsEntrySnfRange');
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    try {
      const slip = await recordCollection({
        farmerId: member.farmerUid || undefined,
        farmerName: member.name,
        farmerCode: member.memberCode,
        farmerPhone: member.phone || undefined,
        date: todayStr(),
        shift: draft.shift,
        milkType: draft.milkType,
        liters,
        fatPercent: fat,
        snfPercent: snf,
        memberId: member.id,
      });
      setSaved(slip);
      saveCollectionDraft(null);
      setErrors({});
      setDuplicate(false);
      toast(t('dairyOpsEntrySaved'));
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors);
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setSaving(false);
    }
  };

  const nextMember = () => {
    setSaved(null);
    setMember(null);
    setErrors({});
    setDuplicate(false);
    const next = emptyDraft(defaultShift());
    setDraft(next);
    saveCollectionDraft(next);
  };

  const done = () => {
    saveCollectionDraft(null);
    navigate('/dairy/console/collections');
  };

  return (
    <ToolShell toolId="dairyConsole" backTo="/dairy/console/collections">
      {saved ? (
        <div className="dairy-wrap">
          <div className="dairy-ops-success">
            <span className="dairy-ops-success-icon" aria-hidden>
              ✅
            </span>
            <div className="dairy-ops-success-title">{t('dairyOpsEntrySuccessTitle')}</div>
            <div className="dairy-ops-success-amount">{fmtINR(saved.totalAmount)}</div>
            <div className="dairy-hint">
              {t('dairySlipNo')} {saved.slipNumber}
            </div>
          </div>
          <SlipCard slip={saved} />
          <div className="dairy-actions-row" style={{ marginTop: 16 }}>
            <button type="button" className="av-btn av-btn-primary" onClick={nextMember}>
              ➕ {t('dairyOpsEntryNextMember')}
            </button>
            <button type="button" className="av-btn av-btn-ghost" onClick={done}>
              {t('commonDone')}
            </button>
          </div>
        </div>
      ) : (
        <div className="dairy-wrap">
          {members === null && !membersFailed ? (
            <p className="dairy-hint">{t('commonLoading')}</p>
          ) : null}

          {membersFailed ? (
            <EmptyState
              icon="📡"
              titleKey="dairyLoadFailed"
              action={
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => {
                    setMembersFailed(false);
                    listMembers({ status: 'active', pageSize: 500 })
                      .then((res) => setMembers(res.data))
                      .catch(() => setMembersFailed(true));
                  }}
                >
                  ↻ {t('retry')}
                </button>
              }
            />
          ) : null}

          {members !== null && members.length === 0 ? (
            <EmptyState
              icon="👨‍🌾"
              titleKey="dairyMembersEmpty"
              bodyKey="dairyMembersEmptyBody"
              action={
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  onClick={() => navigate('/dairy/console/members/new')}
                >
                  ＋ {t('dairyMemberNew')}
                </button>
              }
            />
          ) : null}

          {members !== null && members.length > 0 ? (
            <>
              <div className="av-field" style={{ marginTop: 4 }}>
                <label className="av-label">{t('dairyTblMember')}</label>
                <button type="button" className="dairy-card" onClick={() => setPickerOpen(true)}>
                  {member ? (
                    <>
                      <span className="dairy-card-row">
                        <span className="dairy-card-title">{member.name}</span>
                        <span className="dairy-card-sub">{member.memberCode}</span>
                      </span>
                      {member.village ? <span className="dairy-card-sub">{member.village}</span> : null}
                    </>
                  ) : (
                    <span className="dairy-ops-member-placeholder">👤 {t('dairyPickMember')}</span>
                  )}
                </button>
              </div>

              <CollectionForm
                value={{
                  shift: draft.shift,
                  milkType: draft.milkType,
                  liters: draft.liters,
                  fatPercent: draft.fatPercent,
                  snfPercent: draft.snfPercent,
                }}
                onChange={patchDraft}
                fieldErrors={errors}
              />

              {duplicate ? <div className="dairy-ops-warn">⚠️ {t('dairyOpsEntryDuplicateWarn')}</div> : null}

              <div className="dairy-actions">
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  onClick={() => void save()}
                  disabled={saving}
                >
                  {saving ? <span className="av-spinner" aria-hidden /> : `💾 ${t('dairyOpsEntrySaveSlip')}`}
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}

      <MemberPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={selectMember} />
    </ToolShell>
  );
}
