import { useEffect, useState } from 'react';
import { useT } from '../../lib/i18n';
import { adminGet, adminPost, adminPut, mutationHeaders } from '../../lib/api/admin';
import { GridPage, useRole } from './adminShared';
import ConfirmActionModal from './components/ConfirmActionModal';

export function MandiRatesPage() {
  return (
    <GridPage
      titleKey="admin.nav.mandi"
      url="/admin/mandi/rates"
      statusChips={['all', 'pending', 'approved', 'rejected']}
      params={{ status: 'pending' }}
      columns={[
        { key: 'commodity', labelKey: 'admin.mandi.commodity', sortable: true },
        { key: 'market', labelKey: 'admin.mandi.market' },
        { key: 'rate', labelKey: 'admin.mandi.rate' },
        { key: 'modalPrice', labelKey: 'admin.mandi.modal' },
        { key: 'outOfBand', labelKey: 'admin.mandi.outOfBand', render: (r) => (r.outOfBand ? '⚠' : '') },
      ]}
      actions={[
        { labelKey: 'admin.mandi.approve', path: (r) => `/admin/mandi/rates/${String(r.id)}/approve` },
        {
          labelKey: 'admin.mandi.reject',
          destructive: true,
          path: (r) => `/admin/mandi/rates/${String(r.id)}/reject`,
          fields: [{ key: 'reason', labelKey: 'admin.mandi.reason' }],
        },
      ]}
    />
  );
}

export function LotsDealsPage() {
  return (
    <div>
      <GridPage
        titleKey="admin.lots.lotsTitle"
        url="/admin/lots"
        statusChips={['all', 'open', 'sold', 'closed']}
        columns={[
          { key: 'id', labelKey: 'admin.lots.id', sortable: true },
          { key: 'commodity', labelKey: 'admin.lots.commodity' },
          { key: 'status', labelKey: 'admin.lots.status' },
        ]}
      />
      <GridPage
        titleKey="admin.lots.dealsTitle"
        url="/admin/deals"
        statusChips={['all', 'negotiating', 'completed', 'cancelled']}
        columns={[
          { key: 'id', labelKey: 'admin.lots.id', sortable: true },
          { key: 'commodity', labelKey: 'admin.lots.commodity' },
          { key: 'status', labelKey: 'admin.lots.status' },
        ]}
        actions={[
          { labelKey: 'admin.lots.escalate', destructive: true, path: (r) => `/admin/deals/${String(r.id)}/escalate` },
        ]}
      />
    </div>
  );
}

export function OrdersPage() {
  return (
    <GridPage
      titleKey="admin.nav.orders"
      url="/admin/orders"
      statusChips={['all', 'placed', 'shipped', 'delivered', 'cancelled']}
      columns={[
        { key: 'id', labelKey: 'admin.orders.id', sortable: true },
        { key: 'userId', labelKey: 'admin.orders.user' },
        { key: 'status', labelKey: 'admin.orders.status' },
        { key: 'total', labelKey: 'admin.orders.total' },
      ]}
      actions={[
        {
          labelKey: 'admin.orders.refund',
          destructive: true,
          path: (r) => `/admin/orders/${String(r.id)}/refund`,
          fields: [{ key: 'amountPaise', labelKey: 'admin.orders.amountPaise' }],
        },
      ]}
    />
  );
}

export function BuyersPage() {
  return (
    <GridPage
      titleKey="admin.nav.buyers"
      url="/admin/buyers"
      statusChips={['all', 'pending', 'verified', 'suspended']}
      params={{ status: 'pending' }}
      columns={[
        { key: 'id', labelKey: 'admin.buyers.id', sortable: true },
        { key: 'companyName', labelKey: 'admin.buyers.company' },
        { key: 'status', labelKey: 'admin.buyers.status' },
      ]}
      actions={[
        { labelKey: 'admin.buyers.verify', path: (r) => `/admin/buyers/${String(r.id)}/verify` },
        { labelKey: 'admin.buyers.suspend', destructive: true, path: (r) => `/admin/buyers/${String(r.id)}/suspend` },
      ]}
    />
  );
}

export function FleetPage() {
  return (
    <GridPage
      titleKey="admin.nav.fleet"
      url="/admin/transport/vehicles"
      statusChips={['all', 'pending', 'verified']}
      params={{ status: 'pending' }}
      columns={[
        { key: 'id', labelKey: 'admin.fleet.id', sortable: true },
        { key: 'vehicleNumber', labelKey: 'admin.fleet.number' },
        { key: 'rcStatus', labelKey: 'admin.fleet.rc' },
        { key: 'insuranceStatus', labelKey: 'admin.fleet.insurance' },
        { key: 'fitnessStatus', labelKey: 'admin.fleet.fitness' },
      ]}
      actions={[
        { labelKey: 'admin.fleet.verify', path: (r) => `/admin/transport/vehicles/${String(r.id)}/verify` },
        {
          labelKey: 'admin.fleet.suspendTransporter',
          destructive: true,
          path: (r) => `/admin/transport/transporters/${String(r.ownerId)}/suspend`,
        },
      ]}
    />
  );
}

export function EquipmentPage() {
  return (
    <GridPage
      titleKey="admin.nav.equipment"
      url="/admin/equipment"
      statusChips={['all', 'available', 'booked', 'maintenance']}
      columns={[
        { key: 'id', labelKey: 'admin.equipment.id', sortable: true },
        { key: 'type', labelKey: 'admin.equipment.type' },
        { key: 'status', labelKey: 'admin.equipment.status' },
      ]}
      actions={[
        {
          labelKey: 'admin.equipment.escalate',
          destructive: true,
          path: (r) => `/admin/equipment/bookings/${String(r.id)}/escalate`,
        },
      ]}
    />
  );
}

export function DiaryPage() {
  return (
    <GridPage
      titleKey="admin.nav.diary"
      url="/admin/diary/entries"
      statusChips={['all']}
      columns={[
        { key: 'id', labelKey: 'admin.diary.id', sortable: true },
        { key: 'type', labelKey: 'admin.diary.type' },
        { key: 'amount', labelKey: 'admin.diary.amount' },
        { key: 'cropName', labelKey: 'admin.diary.crop' },
      ]}
    />
  );
}

interface Settlement {
  id: string;
  netRupees?: number;
  status?: string;
  held?: boolean;
  paymentRef?: string;
}

export function SettlementsPage() {
  const t = useT();
  const role = useRole();
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState<Settlement[]>([]);
  const [holds, setHolds] = useState<Settlement[]>([]);
  const [modal, setModal] = useState<'batch' | 'commissions' | 'mark-paid' | null>(null);
  const [selected, setSelected] = useState<Settlement | null>(null);
  const [commissions] = useState({ transporterPct: 10, equipmentPct: 12, brokerPct: 2, effectiveFrom: '' });
  const [message, setMessage] = useState('');

  const load = () => {
    adminGet<{ data?: Settlement[]; holds?: Settlement[] }>('/admin/settlements', { status })
      .then((r) => {
        setRows(r.data ?? []);
        setHolds(r.holds ?? []);
      })
      .catch(() => setRows([]));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div>
      <h2>{t('admin.nav.settlements')}</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {['pending', 'approved', 'paid'].map((s) => (
          <button key={s} className={`admin-chip${status === s ? ' active' : ''}`} onClick={() => setStatus(s)}>
            {s}
          </button>
        ))}
        <button className="admin-button secondary" onClick={() => setModal('batch')}>
          {t('admin.settlements.runBatch')}
        </button>
        <button className="admin-button secondary" onClick={() => setModal('commissions')}>
          {t('admin.settlements.commissions')}
        </button>
      </div>
      {message && <p className="admin-nav-group-label">{message}</p>}

      <table className="admin-grid">
        <thead>
          <tr>
            <th>{t('admin.settlements.id')}</th>
            <th>{t('admin.settlements.net')}</th>
            <th>{t('admin.settlements.status')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.id}</td>
              <td>{row.netRupees}</td>
              <td>{row.status}</td>
              <td>
                <button
                  className="admin-chip"
                  onClick={() => {
                    setSelected(row);
                    setModal('mark-paid');
                  }}
                >
                  {t('admin.settlements.markPaid')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>{t('admin.settlements.holds')}</h4>
      {holds.length === 0 ? (
        <p className="admin-nav-group-label">{t('admin.settlements.noHolds')}</p>
      ) : (
        <ul>
          {holds.map((hold) => (
            <li key={hold.id}>
              {hold.id} — {hold.netRupees}
            </li>
          ))}
        </ul>
      )}

      {modal === 'batch' && (
        <ConfirmActionModal
          title={t('admin.settlements.runBatch')}
          fields={[
            { key: 'periodStart', labelKey: 'admin.settlements.periodStart' },
            { key: 'periodEnd', labelKey: 'admin.settlements.periodEnd' },
          ]}
          onConfirm={async (reason, extra) => {
            await adminPost(
              '/admin/jobs/settlements/run',
              { periodStart: extra.periodStart || undefined, periodEnd: extra.periodEnd || undefined },
              mutationHeaders(role, reason)
            );
            setMessage(t('admin.settlements.batchRun'));
            load();
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'commissions' && (
        <ConfirmActionModal
          title={t('admin.settlements.commissions')}
          fields={[
            { key: 'transporterPct', labelKey: 'admin.settlements.transporter' },
            { key: 'equipmentPct', labelKey: 'admin.settlements.equipment' },
            { key: 'brokerPct', labelKey: 'admin.settlements.broker' },
            { key: 'effectiveFrom', labelKey: 'admin.settlements.effectiveFrom' },
          ]}
          onConfirm={async (reason, extra) => {
            await adminPut(
              '/admin/platform-config/commissions',
              {
                rates: {
                  transporterPct: Number(extra.transporterPct || commissions.transporterPct),
                  equipmentPct: Number(extra.equipmentPct || commissions.equipmentPct),
                  brokerPct: Number(extra.brokerPct || commissions.brokerPct),
                },
                effectiveFrom: extra.effectiveFrom || new Date().toISOString().slice(0, 10),
              },
              mutationHeaders(role, reason)
            );
            setMessage(t('admin.settlements.commissionPending'));
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'mark-paid' && selected && (
        <ConfirmActionModal
          title={t('admin.settlements.markPaid')}
          fields={[{ key: 'paymentRef', labelKey: 'admin.settlements.paymentRef' }]}
          onConfirm={async (reason, extra) => {
            await adminPost(
              `/admin/settlements/${selected.id}/mark-paid`,
              { paymentRef: extra.paymentRef },
              mutationHeaders(role, reason)
            );
            setMessage(t('admin.settlements.paid'));
            load();
          }}
          onClose={() => {
            setModal(null);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
