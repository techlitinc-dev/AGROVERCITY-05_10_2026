import React from 'react';
import { Milk, Stethoscope, Home, ShoppingBag, TreePine } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  Btn,
  idOf,
  str,
  num,
  money,
  useAsync,
  useReasonModal,
  type Row,
} from './shared';

/**
 * SOP-19 — Livestock, Vet & Dairy Network.
 * Vets verify/reject, gaushala directory, livestock orders, dairy rate charts,
 * nursery verification.
 */
export const LivestockPanel: React.FC = () => {
  const { request, modal } = useReasonModal();

  const vets = useAsync(() => admin.org.vets(), []);
  const gaushalas = useAsync(() => admin.org.gaushalas(), []);
  const orders = useAsync(() => admin.org.livestockOrders(), []);
  const rateCharts = useAsync(() => admin.org.dairyRateCharts(), []);
  const nurseries = useAsync(() => admin.org.nurseries(), []);

  const verifyBtn = (kind: string, run: (reason: string) => Promise<unknown>, reload: () => void, label: string) => (
    <Btn
      tone="primary"
      onClick={() =>
        request({
          title: `${kind} — verify ${label}`,
          defaultReason: 'Credentials + facility verified',
          confirmLabel: 'Verify',
          action: run,
          onDone: reload,
        })
      }
    >
      Verify
    </Btn>
  );

  return (
    <>
      <PanelShell
        title="SOP-19: Veterinarian Network"
        subtitle="Onboarded vets — verify credentials or reject with a reason."
        icon={Stethoscope}
        loading={vets.loading}
        error={vets.error}
        onRefresh={vets.reload}
      >
        <DataTable
          rows={(vets.data ?? []) as Row[]}
          empty="No vets registered."
          columns={[
            {
              header: 'Vet',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'name', 'vetName', 'doctorName')}</p>
                  <p className="text-[10px] text-slate-400">{str(r, 'qualification', 'specialization', 'clinic')}</p>
                </div>
              ),
            },
            { header: 'Location', cell: (r) => <span className="text-slate-600">{str(r, 'village', 'district', 'area')}</span> },
            { header: 'Experience', cell: (r) => <span className="text-slate-500">{str(r, 'experienceYears', 'experience')} yrs</span> },
            { header: 'Verification', cell: (r) => <StatusBadge status={str(r, 'verificationStatus', 'status', 'state')} /> },
            {
              header: 'Actions',
              className: 'text-right',
              cell: (r) => (
                <div className="flex justify-end gap-1.5">
                  <Btn
                    tone="danger"
                    onClick={() =>
                      request({
                        title: `Reject vet ${str(r, 'name', 'vetName')}`,
                        confirmLabel: 'Reject',
                        tone: 'danger',
                        action: (reason) => admin.org.rejectVet(idOf(r), { reason }, reason),
                        onDone: vets.reload,
                      })
                    }
                  >
                    Reject
                  </Btn>
                  {verifyBtn('Vet', (reason) => admin.org.verifyVet(idOf(r), reason), vets.reload, str(r, 'name', 'vetName'))}
                </div>
              ),
            },
          ]}
        />
      </PanelShell>

      <PanelShell
        title="SOP-19: Gaushala Directory"
        subtitle="Registered cow shelters."
        icon={Home}
        loading={gaushalas.loading}
        error={gaushalas.error}
        onRefresh={gaushalas.reload}
      >
        <DataTable
          rows={(gaushalas.data ?? []) as Row[]}
          empty="No gaushalas registered."
          columns={[
            {
              header: 'Gaushala',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'name', 'gaushalaName')}</p>
                  <p className="text-[10px] text-slate-400">{str(r, 'district', 'state', 'registrationNo')}</p>
                </div>
              ),
            },
            { header: 'Cattle', cell: (r) => <span className="font-semibold">{num(r, 'cattleCount', 'cattle', 'animalCount') ?? '—'}</span> },
            { header: 'Manager', cell: (r) => <span className="text-slate-500">{str(r, 'managerName', 'manager', 'contact')}</span> },
            { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state', 'verificationStatus')} /> },
          ]}
        />
      </PanelShell>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <PanelShell
          title="SOP-19: Livestock Orders"
          subtitle="Cattle / livestock trade orders."
          icon={ShoppingBag}
          loading={orders.loading}
          error={orders.error}
          onRefresh={orders.reload}
        >
          <DataTable
            rows={(orders.data ?? []) as Row[]}
            empty="No livestock orders."
            columns={[
              { header: 'Animal', cell: (r) => <span className="font-bold text-slate-900">{str(r, 'animal', 'breed', 'category', 'title')}</span> },
              { header: 'Buyer', cell: (r) => <span className="text-slate-600">{str(r, 'buyerName', 'buyer')}</span> },
              { header: 'Amount', cell: (r) => <span className="font-bold">{money(num(r, 'amount', 'price', 'total'))}</span> },
              { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
            ]}
          />
        </PanelShell>

        <PanelShell
          title="SOP-19: Dairy Rate Charts"
          subtitle="Milk procurement rates per fat/SNF slab."
          icon={Milk}
          loading={rateCharts.loading}
          error={rateCharts.error}
          onRefresh={rateCharts.reload}
        >
          <DataTable
            rows={(rateCharts.data ?? []) as Row[]}
            empty="No rate charts."
            columns={[
              { header: 'Chart', cell: (r) => <span className="font-bold text-slate-900">{str(r, 'name', 'title', 'dairyName')}</span> },
              { header: 'Type', cell: (r) => <span className="text-slate-600">{str(r, 'milkType', 'type', 'category')}</span> },
              { header: 'Rate', cell: (r) => <span className="font-bold">{money(num(r, 'rate', 'pricePerLiter', 'ratePerLitre'))}/L</span> },
              { header: 'Effective', cell: (r) => <span className="text-slate-500">{str(r, 'effectiveFrom', 'effectiveDate', 'updatedAt')}</span> },
            ]}
          />
        </PanelShell>
      </div>

      <PanelShell
        title="SOP-19: Nurseries"
        subtitle="Fruit / forestry nurseries pending verification."
        icon={TreePine}
        loading={nurseries.loading}
        error={nurseries.error}
        onRefresh={nurseries.reload}
      >
        <DataTable
          rows={(nurseries.data ?? []) as Row[]}
          empty="No nurseries registered."
          columns={[
            {
              header: 'Nursery',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'name', 'nurseryName')}</p>
                  <p className="text-[10px] text-slate-400">{str(r, 'district', 'state')}</p>
                </div>
              ),
            },
            { header: 'Saplings', cell: (r) => <span className="font-semibold">{num(r, 'saplingCount', 'capacity', 'stock') ?? '—'}</span> },
            { header: 'Verification', cell: (r) => <StatusBadge status={str(r, 'verificationStatus', 'status', 'state')} /> },
            {
              header: 'Action',
              className: 'text-right',
              cell: (r) =>
                verifyBtn('Nursery', (reason) => admin.org.verifyNursery(idOf(r), reason), nurseries.reload, str(r, 'name', 'nurseryName')),
            },
          ]}
        />
      </PanelShell>
      {modal}
    </>
  );
};
