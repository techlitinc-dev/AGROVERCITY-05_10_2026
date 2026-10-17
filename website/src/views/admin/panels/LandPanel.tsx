import React, { useState } from 'react';
import { Map, Sprout } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  KV,
  Btn,
  Tabs,
  idOf,
  str,
  num,
  money,
  useAsync,
  useReasonModal,
  type Row,
} from './shared';

/**
 * SOP-10 — Land Leasing Disputes.
 * Land listings + active leases; terminate a lease (MPIN step-up) and view the
 * stored agreement.
 */
export const LandPanel: React.FC = () => {
  const [tab, setTab] = useState('leases');
  const { request, modal } = useReasonModal();
  const [agreement, setAgreement] = useState<Row | null>(null);

  const listings = useAsync(() => admin.fieldOps.landListings(), []);
  const leases = useAsync(() => admin.fieldOps.landLeases(), []);

  const openAgreement = async (leaseId: string) => {
    try {
      const data = await admin.fieldOps.leaseAgreement(leaseId);
      setAgreement(data && typeof data === 'object' ? (data as Row) : { leaseId, body: data });
    } catch {
      setAgreement({ leaseId, error: 'Agreement document unavailable' });
    }
  };

  return (
    <>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'leases', label: 'Active leases' },
          { id: 'listings', label: 'Land listings' },
        ]}
      />
      {tab === 'leases' ? (
        <PanelShell
          title="SOP-10: Land Leases"
          subtitle="Farmer ↔ landlord lease contracts. Termination requires MPIN step-up."
          icon={Map}
          loading={leases.loading}
          error={leases.error}
          onRefresh={leases.reload}
        >
          <DataTable
            rows={(leases.data ?? []) as Row[]}
            empty="No land leases on record."
            columns={[
              {
                header: 'Plot',
                cell: (r) => (
                  <div>
                    <p className="font-bold text-slate-900">{str(r, 'plotName', 'plot', 'title', 'village')}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
                  </div>
                ),
              },
              {
                header: 'Landlord → Tenant',
                cell: (r) => (
                  <span className="text-slate-600">
                    {str(r, 'landlordName', 'landlord')} → {str(r, 'tenantName', 'farmerName', 'tenant')}
                  </span>
                ),
              },
              {
                header: 'Rent',
                cell: (r) => (
                  <div>
                    <p className="font-bold">{money(num(r, 'rentPerYear', 'annualRent', 'rent'))}/yr</p>
                    <p className="text-[10px] text-slate-400">{num(r, 'areaAcres', 'acres', 'area')} acres</p>
                  </div>
                ),
              },
              {
                header: 'Term',
                cell: (r) => (
                  <span className="text-slate-500">
                    {str(r, 'startDate', 'from')} → {str(r, 'endDate', 'to')}
                  </span>
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
                    <Btn onClick={() => openAgreement(idOf(r))}>Agreement</Btn>
                    <Btn
                      tone="danger"
                      onClick={() =>
                        request({
                          title: `Terminate lease ${idOf(r)}`,
                          description: `${str(r, 'plotName', 'plot', 'title')} — ${str(r, 'landlordName', 'landlord')} → ${str(r, 'tenantName', 'farmerName', 'tenant')}`,
                          confirmLabel: 'Terminate lease',
                          requireMpin: true,
                          tone: 'danger',
                          action: (reason) => admin.fieldOps.terminateLease(idOf(r), { reason }, reason),
                          onDone: leases.reload,
                        })
                      }
                    >
                      Terminate
                    </Btn>
                  </div>
                ),
              },
            ]}
          />
        </PanelShell>
      ) : (
        <PanelShell
          title="SOP-10: Land Listings"
          subtitle="Plots listed for lease on the marketplace."
          icon={Sprout}
          loading={listings.loading}
          error={listings.error}
          onRefresh={listings.reload}
        >
          <DataTable
            rows={(listings.data ?? []) as Row[]}
            empty="No land listings."
            columns={[
              {
                header: 'Plot',
                cell: (r) => (
                  <div>
                    <p className="font-bold text-slate-900">{str(r, 'title', 'plotName', 'village')}</p>
                    <p className="text-[10px] text-slate-400">{str(r, 'district', 'state')}</p>
                  </div>
                ),
              },
              { header: 'Owner', cell: (r) => <span className="text-slate-600">{str(r, 'ownerName', 'landlordName', 'owner')}</span> },
              {
                header: 'Area / Rent',
                cell: (r) => (
                  <div>
                    <p className="font-bold">{money(num(r, 'expectedRent', 'rentPerYear', 'rent'))}/yr</p>
                    <p className="text-[10px] text-slate-400">{num(r, 'areaAcres', 'acres', 'area')} acres</p>
                  </div>
                ),
              },
              { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
            ]}
          />
        </PanelShell>
      )}

      {agreement && (
        <PanelShell
          title={`Lease agreement — ${str(agreement, 'leaseId')}`}
          subtitle="Stored lease agreement snapshot."
          icon={Map}
          actions={<Btn onClick={() => setAgreement(null)}>Close</Btn>}
        >
          <KV record={agreement} />
        </PanelShell>
      )}
      {modal}
    </>
  );
};
