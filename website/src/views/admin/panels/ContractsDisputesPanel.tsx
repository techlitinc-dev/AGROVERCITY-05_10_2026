import React, { useState } from 'react';
import { FileSignature, FileCheck2 } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin, apiErrorMessage } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  KV,
  Btn,
  Field,
  Select,
  TextInput,
  Banner,
  idOf,
  str,
  num,
  money,
  useAsync,
  useReasonModal,
  asRow,
  asRows,
  type Row,
} from './shared';

/**
 * SOP-07 — Buyer Contracts & Escrow Desk.
 * Institutional contract oversight: list across stages, publish an open
 * (untargeted) offer any verified farmer can accept (POST /admin/contracts),
 * admin-cancel with a recorded reason, and inspect e-sign acceptances.
 */
export const ContractsDeskPanel: React.FC = () => {
  const { request, modal } = useReasonModal();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const contracts = useAsync(() => admin.contractsDesk.list(), []);
  const acceptances = useAsync(
    () => (selectedId ? admin.contractsDesk.acceptances(selectedId).catch(() => null) : Promise.resolve(null)),
    [selectedId]
  );

  // Publish form state
  const [buyerCompany, setBuyerCompany] = useState('');
  const [crop, setCrop] = useState('');
  const [quantity, setQuantity] = useState('');
  const [baseRate, setBaseRate] = useState('');
  const [priceType, setPriceType] = useState('fixed');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [qtyPerDelivery, setQtyPerDelivery] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishMsg, setPublishMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const rows = (contracts.data ?? []) as Row[];
  const selected = selectedId ? rows.find((r) => idOf(r) === selectedId) ?? null : null;

  const publish = async () => {
    setPublishBusy(true);
    setPublishMsg(null);
    try {
      await admin.contractsDesk.create(
        {
          buyerCompany: buyerCompany.trim(),
          crop: crop.trim(),
          title: `${crop.trim()} supply — ${buyerCompany.trim()}`,
          quantityTotal: Number(quantity),
          priceType,
          baseRate: baseRate ? Number(baseRate) : undefined,
          schedule: {
            startDate,
            endDate,
            frequency,
            qtyPerDelivery: Number(qtyPerDelivery),
          },
          deliveryLocation: deliveryLocation.trim(),
        },
        `Contract published: ${crop.trim()} → ${buyerCompany.trim()}`
      );
      setPublishMsg({ kind: 'success', text: 'Contract published — open for verified farmers to accept.' });
      setBuyerCompany('');
      setCrop('');
      setQuantity('');
      setBaseRate('');
      setQtyPerDelivery('');
      setDeliveryLocation('');
      contracts.reload();
    } catch (e) {
      setPublishMsg({ kind: 'error', text: apiErrorMessage(e) });
    } finally {
      setPublishBusy(false);
    }
  };

  const publishable =
    buyerCompany.trim().length >= 2 &&
    crop.trim() &&
    Number(quantity) > 0 &&
    startDate &&
    endDate &&
    Number(qtyPerDelivery) > 0;

  return (
    <>
      <PanelShell
        title="SOP-07: Buyer Contracts & Escrow Desk"
        subtitle="B2B supply contracts under escrow. Admin cancellation (with reason) is the only manual status move the machine accepts beyond farmer flows."
        icon={FileSignature}
        loading={contracts.loading}
        error={contracts.error}
        onRefresh={contracts.reload}
      >
        <DataTable
          rows={rows}
          empty="No contracts."
          columns={[
            {
              header: 'Contract',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'title', 'crop', 'commodity', 'buyerCompany')}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
                </div>
              ),
            },
            {
              header: 'Parties',
              cell: (r) => (
                <span className="text-slate-600">
                  {str(r, 'buyerCompany', 'buyerName', 'buyer')} ↔ {str(r, 'sellerName', 'farmerName', 'seller', 'farmerId')}
                </span>
              ),
            },
            {
              header: 'Value',
              cell: (r) => (
                <div>
                  <p className="font-bold">{money(num(r, 'value', 'totalValue', 'contractValue', 'amount', 'lockedRateQuintal'))}</p>
                  <p className="text-[10px] text-slate-400">qty {str(r, 'quantityTotal', 'minQuantityQuintals')} q</p>
                </div>
              ),
            },
            {
              header: 'Status',
              cell: (r) => <StatusBadge status={str(r, 'status', 'state')} />,
            },
            {
              header: 'Actions',
              className: 'text-right',
              cell: (r) => (
                <div className="flex justify-end gap-1.5">
                  <Btn onClick={() => setSelectedId(idOf(r))}>Detail</Btn>
                  <Btn
                    tone="danger"
                    disabled={['cancelled', 'completed', 'breached'].includes(str(r, 'status', 'state').toLowerCase())}
                    onClick={() =>
                      request({
                        title: `Cancel contract ${idOf(r)}`,
                        description: 'The backend machine only supports admin cancellation — reason is stored as the cancellation cause.',
                        confirmLabel: 'Cancel contract',
                        tone: 'danger',
                        action: (reason) => admin.contractsDesk.setStatus(idOf(r), { status: 'cancelled', reason }, reason),
                        onDone: contracts.reload,
                      })
                    }
                  >
                    Cancel
                  </Btn>
                </div>
              ),
            },
          ]}
        />
      </PanelShell>

      <PanelShell
        title="Publish institutional contract"
        subtitle="Open (untargeted) offer any verified farmer can accept — POST /admin/contracts."
        icon={FileSignature}
        actions={
          <Btn tone="primary" busy={publishBusy} disabled={!publishable} onClick={publish}>
            Publish contract
          </Btn>
        }
      >
        {publishMsg && <Banner kind={publishMsg.kind}>{publishMsg.text}</Banner>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Buyer company" className="col-span-2">
            <TextInput value={buyerCompany} onChange={setBuyerCompany} placeholder="Sahyadri Agro Processors Pvt Ltd" />
          </Field>
          <Field label="Crop">
            <TextInput value={crop} onChange={setCrop} placeholder="Soybean" />
          </Field>
          <Field label="Total qty (q)">
            <TextInput type="number" value={quantity} onChange={setQuantity} placeholder="500" />
          </Field>
          <Field label="Price type">
            <Select
              value={priceType}
              onChange={setPriceType}
              options={[
                { value: 'fixed', label: 'Fixed rate' },
                { value: 'mandiLinked', label: 'Mandi-linked' },
              ]}
            />
          </Field>
          <Field label="Base rate ₹/q">
            <TextInput type="number" value={baseRate} onChange={setBaseRate} placeholder="4600" />
          </Field>
          <Field label="Start date">
            <TextInput type="date" value={startDate} onChange={setStartDate} />
          </Field>
          <Field label="End date">
            <TextInput type="date" value={endDate} onChange={setEndDate} />
          </Field>
          <Field label="Delivery frequency">
            <Select
              value={frequency}
              onChange={setFrequency}
              options={[
                { value: 'weekly', label: 'Weekly' },
                { value: 'biweekly', label: 'Bi-weekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
            />
          </Field>
          <Field label="Qty / delivery (q)">
            <TextInput type="number" value={qtyPerDelivery} onChange={setQtyPerDelivery} placeholder="25" />
          </Field>
          <Field label="Delivery location" className="col-span-2">
            <TextInput value={deliveryLocation} onChange={setDeliveryLocation} placeholder="Nashik APMC, Gate 3" />
          </Field>
        </div>
      </PanelShell>

      {selected && (
        <PanelShell
          title={`Contract ${idOf(selected)}`}
          subtitle="Full contract record and party acceptances (e-sign records)."
          icon={FileCheck2}
          loading={acceptances.loading}
          actions={<Btn onClick={() => setSelectedId(null)}>Close</Btn>}
        >
          <KV record={selected} />
          {!!acceptances.data && (
            <div>
              <h4 className="text-xs font-extrabold text-slate-700 mb-2">Acceptances</h4>
              <DataTable
                rows={asRows(acceptances.data)}
                empty="No acceptances recorded."
                columns={[
                  { header: 'Party', cell: (r) => <span className="font-semibold text-slate-700">{str(r, 'party', 'name', 'uid', 'farmerName')}</span> },
                  { header: 'Accepted at', cell: (r) => <span className="text-slate-500">{str(r, 'acceptedAt', 'signedAt', 'createdAt')}</span> },
                  { header: 'MPIN verified', cell: (r) => <StatusBadge status={String(Boolean(firstValOf(r, ['mpinVerified', 'verified'])))} /> },
                ]}
              />
            </div>
          )}
        </PanelShell>
      )}
      {modal}
    </>
  );
};

const firstValOf = (r: Row, keys: string[]): unknown => {
  for (const k of keys) if (r[k] !== undefined && r[k] !== null) return r[k];
  return undefined;
};
