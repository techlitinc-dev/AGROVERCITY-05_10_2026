import { useCallback, useEffect, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  createCustomerDemand,
  deleteCustomerDemand,
  fetchCustomerDemands,
  type CustomerDemand,
} from '../../lib/api/emarketCustomer';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const EMPTY_FORM = {
  crop: '',
  variety: 'Standard',
  grade: 'A',
  quantityQuintals: '',
  targetMinPrice: '',
  targetMaxPrice: '',
  recurringFrequency: 'Weekly',
  deliveryWindow: '7 Days',
  district: '',
  notes: '',
};

/**
 * Standing demands (WS-03 task 3.5, spec C1) — list POST /v1/customer/demands,
 * create, delete. Every row keeps its own id as the delete key; no demo data and
 * no `?? <number>` fallbacks.
 */
export default function DemandsPage() {
  const t = useT();
  const [demands, setDemands] = useState<CustomerDemand[] | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchCustomerDemands()
      .then(setDemands)
      .catch(() => {
        setDemands([]);
        toast(t('emarketLoadFailed'), { error: true });
      });
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await createCustomerDemand({
        crop: form.crop.trim(),
        variety: form.variety.trim(),
        grade: form.grade.trim(),
        quantityQuintals: Number(form.quantityQuintals),
        targetMinPrice: Number(form.targetMinPrice),
        targetMaxPrice: Number(form.targetMaxPrice),
        recurringFrequency: form.recurringFrequency,
        deliveryWindow: form.deliveryWindow,
        district: form.district.trim(),
        notes: form.notes.trim(),
      });
      setForm({ ...EMPTY_FORM });
      toast(t('emarketDemandCreated'));
      load();
    } catch {
      toast(t('emarketActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (demandId: string) => {
    try {
      await deleteCustomerDemand(demandId);
      setPendingDelete(null);
      toast(t('emarketDemandDeleted'));
      load();
    } catch {
      toast(t('emarketActionFailed'), { error: true });
    }
  };

  return (
    <ToolShell toolId="demands">
      <section className="dash-section">
        <h3>{t('emarketDemands')}</h3>
        {demands === null ? (
          <p className="dash-empty-line">{t('emarketLoading')}</p>
        ) : demands.length === 0 ? (
          <p className="dash-empty-line">📣 {t('emarketNoDemands')}</p>
        ) : (
          demands.map((demand) => (
            <div
              key={demand.id}
              style={{ padding: '10px 0', borderBottom: '1px solid #F3F4F6', display: 'grid', gap: 4 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <strong>
                  {demand.crop}
                  {demand.variety ? ` • ${demand.variety}` : ''}
                </strong>
                <span className="av-chip" style={{ fontSize: 12 }}>
                  {t('emarketStatusOpen')}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#6B7280' }}>
                {t('emarketQuantityQuintals')}: {demand.quantityQuintals} • {t('emarketTargetMin')}:{' '}
                {demand.targetMinPrice} • {t('emarketTargetMax')}: {demand.targetMaxPrice} •{' '}
                {t('emarketGrade')}: {demand.grade}
              </div>
              <div style={{ fontSize: 13, color: '#6B7280' }}>
                {t('emarketFrequency')}: {demand.recurringFrequency} • {t('emarketDeliveryWindow')}:{' '}
                {demand.deliveryWindow}
                {demand.district ? ` • ${t('emarketDistrict')}: ${demand.district}` : ''}
              </div>
              {demand.notes ? <div style={{ fontSize: 13 }}>{demand.notes}</div> : null}
              {pendingDelete === demand.id ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="av-btn" onClick={() => handleDelete(demand.id)}>
                    {t('emarketDelete')}
                  </button>
                  <button type="button" className="av-btn" onClick={() => setPendingDelete(null)}>
                    {t('emarketCancel')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="av-btn"
                  style={{ justifySelf: 'start' }}
                  onClick={() => setPendingDelete(demand.id)}
                >
                  {t('emarketDelete')}
                </button>
              )}
            </div>
          ))
        )}
      </section>

      <section className="dash-section">
        <h3>{t('emarketNewDemand')}</h3>
        <form onSubmit={handleCreate} style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
          <input
            className="av-input"
            placeholder={t('emarketCrop')}
            value={form.crop}
            onChange={(e) => setForm({ ...form, crop: e.target.value })}
            required
          />
          <input
            className="av-input"
            placeholder={t('emarketVariety')}
            value={form.variety}
            onChange={(e) => setForm({ ...form, variety: e.target.value })}
          />
          <input
            className="av-input"
            placeholder={t('emarketGrade')}
            value={form.grade}
            onChange={(e) => setForm({ ...form, grade: e.target.value })}
          />
          <input
            className="av-input"
            type="number"
            step="0.01"
            placeholder={t('emarketQuantityQuintals')}
            value={form.quantityQuintals}
            onChange={(e) => setForm({ ...form, quantityQuintals: e.target.value })}
            required
          />
          <input
            className="av-input"
            type="number"
            step="0.01"
            placeholder={t('emarketTargetMin')}
            value={form.targetMinPrice}
            onChange={(e) => setForm({ ...form, targetMinPrice: e.target.value })}
            required
          />
          <input
            className="av-input"
            type="number"
            step="0.01"
            placeholder={t('emarketTargetMax')}
            value={form.targetMaxPrice}
            onChange={(e) => setForm({ ...form, targetMaxPrice: e.target.value })}
            required
          />
          <input
            className="av-input"
            placeholder={t('emarketFrequency')}
            value={form.recurringFrequency}
            onChange={(e) => setForm({ ...form, recurringFrequency: e.target.value })}
          />
          <input
            className="av-input"
            placeholder={t('emarketDeliveryWindow')}
            value={form.deliveryWindow}
            onChange={(e) => setForm({ ...form, deliveryWindow: e.target.value })}
          />
          <input
            className="av-input"
            placeholder={t('emarketDistrict')}
            value={form.district}
            onChange={(e) => setForm({ ...form, district: e.target.value })}
          />
          <textarea
            className="av-input"
            placeholder={t('emarketNotes')}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <button type="submit" className="av-btn" disabled={busy}>
            {t('emarketCreateDemand')}
          </button>
        </form>
      </section>
    </ToolShell>
  );
}
