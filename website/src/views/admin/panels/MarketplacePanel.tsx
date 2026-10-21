import React, { useState } from 'react';
import { Layers, ShoppingCart, Package, Award, RotateCcw, ClipboardList, ShieldAlert, Store, Tags, Pencil } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin, apiErrorMessage, ApiError } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  Btn,
  Tabs,
  Field,
  TextInput,
  Select,
  Banner,
  idOf,
  str,
  num,
  money,
  useAsync,
  useReasonModal,
  type Row,
} from './shared';

/**
 * SOP-05 — Produce Lots & B2B Procurement, SOP-06 — Marketplace Catalog & Orders.
 * Lots force-status, procurement audit trail, order refunds (maker-checker aware),
 * product CRUD + authenticity certificates, seller registry, category management,
 * and the UGC moderation queue.
 */
export const MarketplacePanel: React.FC = () => {
  const [tab, setTab] = useState('lots');
  return (
    <>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'lots', label: 'Produce lots (SOP-05)' },
          { id: 'procurements', label: 'Procurements (SOP-05)' },
          { id: 'orders', label: 'Orders & refunds (SOP-06)' },
          { id: 'products', label: 'Products (SOP-06)' },
          { id: 'sellers', label: 'Sellers (SOP-06)' },
          { id: 'categories', label: 'Categories (SOP-06)' },
          { id: 'moderation', label: 'Moderation (SOP-06)' },
        ]}
      />
      {tab === 'lots' && <LotsCard />}
      {tab === 'procurements' && <ProcurementsCard />}
      {tab === 'orders' && <OrdersCard />}
      {tab === 'products' && <ProductsCard />}
      {tab === 'sellers' && <SellersCard />}
      {tab === 'categories' && <CategoriesCard />}
      {tab === 'moderation' && <ModerationCard />}
    </>
  );
};

const LOT_STATUSES = ['open', 'active', 'booked', 'sold', 'expired', 'delisted'];

const LotsCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const lots = useAsync(() => admin.marketplace.lots(), []);

  return (
    <PanelShell
      title="SOP-05: Produce Lots & B2B Trade"
      subtitle="Moderate farmer produce lots — delist fraudulent listings or reopen wrongly closed ones. A sold lot is terminal (409 LOT_NOT_EDITABLE)."
      icon={Layers}
      loading={lots.loading}
      error={lots.error}
      onRefresh={lots.reload}
    >
      <DataTable
        rows={(lots.data ?? []) as Row[]}
        empty="No produce lots."
        columns={[
          {
            header: 'Lot',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'crop', 'commodity', 'title', 'name')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
              </div>
            ),
          },
          {
            header: 'Farmer',
            cell: (r) => <span className="text-slate-600">{str(r, 'farmerName', 'sellerName', 'ownerName', 'userId')}</span>,
          },
          {
            header: 'Qty / Price',
            cell: (r) => (
              <div>
                <p className="font-bold">{money(num(r, 'pricePerQuintal', 'price', 'askingPrice'))}/q</p>
                <p className="text-[10px] text-slate-400">{str(r, 'quantityQuintals', 'quantity', 'qty')} q</p>
              </div>
            ),
          },
          {
            header: 'Location',
            cell: (r) => <span className="text-slate-500">{str(r, 'village', 'mandi', 'district')}</span>,
          },
          {
            header: 'Status',
            cell: (r) => <StatusBadge status={str(r, 'status', 'state')} />,
          },
          {
            header: 'Set status',
            className: 'text-right',
            cell: (r) => (
              <Select
                className="w-36 ml-auto"
                value=""
                onChange={(v) =>
                  v &&
                  request({
                    title: `Lot ${idOf(r)} → ${v}`,
                    confirmLabel: 'Apply',
                    tone: v === 'delisted' || v === 'suspended' ? 'danger' : 'primary',
                    action: (reason) => admin.marketplace.setLotStatus(idOf(r), v, reason),
                    onDone: lots.reload,
                  })
                }
                options={[{ value: '', label: 'Set…' }, ...LOT_STATUSES.map((s) => ({ value: s, label: s }))]}
              />
            ),
          },
        ]}
      />
      {modal}
    </PanelShell>
  );
};

const ProcurementsCard: React.FC = () => {
  const procurements = useAsync(() => admin.contractsDesk.procurements(), []);

  return (
    <PanelShell
      title="SOP-05: B2B Procurement Audit"
      subtitle="Trader procurement records and slips — purchases booked by trader-role buyers with payment + escrow summary (GET /admin/procurements)."
      icon={ClipboardList}
      loading={procurements.loading}
      error={procurements.error}
      onRefresh={procurements.reload}
    >
      <DataTable
        rows={(procurements.data ?? []) as Row[]}
        empty="No procurement records."
        columns={[
          {
            header: 'Procurement',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'crop', 'commodity', 'title')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
              </div>
            ),
          },
          {
            header: 'Buyer',
            cell: (r) => (
              <div>
                <p className="font-semibold text-slate-700">{str(r, 'buyerName', 'traderName', 'buyer')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'buyerType', 'persona')}</p>
              </div>
            ),
          },
          {
            header: 'Farmer',
            cell: (r) => <span className="text-slate-600">{str(r, 'farmerName', 'sellerName', 'farmer')}</span>,
          },
          {
            header: 'Qty / Value',
            cell: (r) => (
              <div>
                <p className="font-bold">{money(num(r, 'total', 'amount', 'value'))}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'quantityQuintals', 'quantity', 'qty')} q</p>
              </div>
            ),
          },
          {
            header: 'Payment',
            cell: (r) => (
              <div>
                <p className="text-slate-600">{str(r, 'paymentStatus', 'paymentMethod')}</p>
                <p className="text-[10px] text-slate-400">escrow {str(r, 'escrowStatus', 'escrow')}</p>
              </div>
            ),
          },
          {
            header: 'Status',
            cell: (r) => <StatusBadge status={str(r, 'status', 'state')} />,
          },
        ]}
      />
    </PanelShell>
  );
};

const OrdersCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const [approvalNotice, setApprovalNotice] = useState<string | null>(null);
  const orders = useAsync(() => admin.marketplace.orders(), []);

  return (
    <PanelShell
      title="SOP-06: Orders & Refunds"
      subtitle="Marketplace order oversight. High-value refunds enter maker-checker: they show as approval-pending instead of executing."
      icon={ShoppingCart}
      loading={orders.loading}
      error={orders.error}
      onRefresh={orders.reload}
    >
      {approvalNotice && <Banner kind="info">{approvalNotice}</Banner>}
      <DataTable
        rows={(orders.data ?? []) as Row[]}
        empty="No orders."
        columns={[
          {
            header: 'Order',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'buyerName', 'buyer', 'customerName')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
              </div>
            ),
          },
          {
            header: 'Items',
            cell: (r) => <span className="text-slate-600">{str(r, 'items', 'productName', 'summary', 'lotId')}</span>,
          },
          {
            header: 'Amount',
            cell: (r) => <span className="font-bold">{money(num(r, 'total', 'amount', 'orderValue'))}</span>,
          },
          {
            header: 'Payment',
            cell: (r) => <span className="text-slate-500">{str(r, 'paymentStatus', 'paymentMethod', 'escrowStatus')}</span>,
          },
          {
            header: 'Status',
            cell: (r) => <StatusBadge status={str(r, 'status', 'state')} />,
          },
          {
            header: 'Action',
            className: 'text-right',
            cell: (r) => (
              <Btn
                tone="warn"
                onClick={() =>
                  request({
                    title: `Refund order ${idOf(r)}`,
                    description: `${money(num(r, 'total', 'amount', 'orderValue'))} back to buyer.`,
                    confirmLabel: 'Initiate refund',
                    tone: 'warn',
                    action: async (reason) => {
                      try {
                        await admin.marketplace.refundOrder(idOf(r), { reason }, reason);
                        setApprovalNotice(null);
                      } catch (e) {
                        if (e instanceof ApiError && e.code === 'requiresApproval') {
                          setApprovalNotice(
                            `Refund for ${idOf(r)} requires a second admin's approval — it is now pending in the approvals inbox.`
                          );
                        }
                        throw e;
                      }
                    },
                    onDone: orders.reload,
                  })
                }
              >
                <RotateCcw className="w-3.5 h-3.5" /> Refund
              </Btn>
            ),
          },
        ]}
      />
      {modal}
    </PanelShell>
  );
};

const CERT_TYPES = ['agmark', 'organic', 'fssai', 'ministry_qr', 'iso'];

const ProductsCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [certType, setCertType] = useState('agmark');
  const [certNumber, setCertNumber] = useState('');
  const [certIssuer, setCertIssuer] = useState('');
  const [certUrl, setCertUrl] = useState('');
  const [certProductId, setCertProductId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const products = useAsync(() => admin.marketplace.products(), []);
  const rows = (products.data ?? []) as Row[];

  const create = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await admin.marketplace.createProduct(
        { name: name.trim(), category: category.trim(), price: Number(price) || 0 },
        `Catalog entry created: ${name.trim()}`
      );
      setMsg({ kind: 'success', text: 'Product created.' });
      setName('');
      setCategory('');
      setPrice('');
      products.reload();
    } catch (e) {
      setMsg({ kind: 'error', text: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const addCert = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await admin.marketplace.addProductCertificate(
        certProductId,
        {
          certType,
          certNumber: certNumber.trim(),
          issuer: certIssuer.trim(),
          certUrl: certUrl.trim(),
        },
        `Certificate attached: ${certType} ${certNumber.trim()}`
      );
      setMsg({ kind: 'success', text: 'Certificate attached.' });
      setCertNumber('');
      setCertIssuer('');
      setCertUrl('');
      products.reload();
    } catch (e) {
      setMsg({ kind: 'error', text: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = (r: Row) =>
    request({
      title: `${['active', 'true'].includes(String(r.status).toLowerCase()) ? 'Deactivate' : 'Activate'} product ${str(r, 'name', 'title')}`,
      confirmLabel: 'Update',
      action: (reason) =>
        admin.marketplace.updateProduct(
          idOf(r),
          { status: ['active', 'true'].includes(String(r.status).toLowerCase()) ? 'inactive' : 'active' },
          reason
        ),
      onDone: products.reload,
    });

  return (
    <PanelShell
      title="SOP-06: Marketplace Catalog"
      subtitle="Curate mall products and attach Agmark / Ministry QR authenticity certificates (certType, certNumber, issuer, certUrl)."
      icon={Package}
      loading={products.loading}
      error={products.error}
      onRefresh={products.reload}
    >
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
          <h4 className="text-xs font-extrabold text-slate-700">Create product</h4>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Name" className="col-span-3 sm:col-span-1">
              <TextInput value={name} onChange={setName} placeholder="Organic Turmeric 500g" />
            </Field>
            <Field label="Category" className="col-span-3 sm:col-span-1">
              <TextInput value={category} onChange={setCategory} placeholder="spices" />
            </Field>
            <Field label="Price ₹" className="col-span-3 sm:col-span-1">
              <TextInput type="number" value={price} onChange={setPrice} placeholder="149" />
            </Field>
          </div>
          <Btn tone="primary" busy={busy} disabled={!name.trim()} onClick={create}>Create product</Btn>
        </div>
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
          <h4 className="text-xs font-extrabold text-slate-700">Attach authenticity certificate</h4>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Product" className="col-span-2">
              <Select
                value={certProductId}
                onChange={setCertProductId}
                options={[{ value: '', label: 'Select product…' }, ...rows.map((r) => ({ value: idOf(r), label: str(r, 'name', 'title') }))]}
              />
            </Field>
            <Field label="Cert type">
              <Select value={certType} onChange={setCertType} options={CERT_TYPES.map((t) => ({ value: t, label: t }))} />
            </Field>
            <Field label="Cert number">
              <TextInput value={certNumber} onChange={setCertNumber} placeholder="AGM-2026-11823" />
            </Field>
            <Field label="Issuer">
              <TextInput value={certIssuer} onChange={setCertIssuer} placeholder="APEDA / FSSAI" />
            </Field>
            <Field label="Document URL">
              <TextInput value={certUrl} onChange={setCertUrl} placeholder="https://…" />
            </Field>
          </div>
          <Btn tone="primary" busy={busy} disabled={!certProductId || !certNumber.trim() || !certIssuer.trim() || !certUrl.trim()} onClick={addCert}>
            <Award className="w-3.5 h-3.5" /> Add certificate
          </Btn>
        </div>
      </div>
      <DataTable
        rows={rows}
        empty="No catalog products."
        columns={[
          {
            header: 'Product',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'name', 'title')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'category', 'sellerName')}</p>
              </div>
            ),
          },
          { header: 'Price', cell: (r) => <span className="font-bold">{money(num(r, 'price', 'mrp'))}</span> },
          { header: 'Stock', cell: (r) => <span className="text-slate-600">{str(r, 'stock', 'stockQty', 'inventory')}</span> },
          { header: 'Certificates', cell: (r) => <span className="text-slate-500">{str(r, 'certificates', 'certs', 'isCertified')}</span> },
          { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
          {
            header: 'Action',
            className: 'text-right',
            cell: (r) => <Btn onClick={() => toggleActive(r)}>Toggle active</Btn>,
          },
        ]}
      />
      {modal}
    </PanelShell>
  );
};

const ModerationCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const queue = useAsync(() => admin.moderation.queue(), []);

  return (
    <PanelShell
      title="SOP-06: UGC Moderation Queue"
      subtitle="Reported reviews, listings and content awaiting moderator action (GET /admin/moderation-queue, POST /admin/moderation/{id}/action)."
      icon={ShieldAlert}
      loading={queue.loading}
      error={queue.error}
      onRefresh={queue.reload}
    >
      <DataTable
        rows={(queue.data ?? []) as Row[]}
        empty="No items awaiting moderation."
        columns={[
          {
            header: 'Item',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'title', 'summary', 'content', 'type', 'reason')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{idOf(r)} • {str(r, 'module', 'entity', 'collection')}</p>
              </div>
            ),
          },
          {
            header: 'Reported by',
            cell: (r) => <span className="text-slate-600">{str(r, 'reportedBy', 'reporter', 'userId')}</span>,
          },
          {
            header: 'Reports',
            cell: (r) => <span className="font-semibold text-rose-600">{num(r, 'reportCount', 'reports') ?? 1}</span>,
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
                <Btn
                  onClick={() =>
                    request({
                      title: `Keep item ${idOf(r)}`,
                      defaultReason: 'Content reviewed — no violation found',
                      confirmLabel: 'Keep',
                      action: (reason) => admin.moderation.act(idOf(r), { action: 'dismiss', reason }, reason),
                      onDone: queue.reload,
                    })
                  }
                >
                  Keep
                </Btn>
                <Btn
                  tone="danger"
                  onClick={() =>
                    request({
                      title: `Remove item ${idOf(r)}`,
                      confirmLabel: 'Remove',
                      tone: 'danger',
                      action: (reason) => admin.moderation.act(idOf(r), { action: 'remove', reason }, reason),
                      onDone: queue.reload,
                    })
                  }
                >
                  Remove
                </Btn>
              </div>
            ),
          },
        ]}
      />
      {modal}
    </PanelShell>
  );
};

const SellersCard: React.FC = () => {
  const [search, setSearch] = useState('');
  const sellers = useAsync(
    () => admin.marketplace.sellers({ ...(search.trim() ? { search: search.trim() } : {}) }),
    [search.trim()]
  );
  const rows = (sellers.data ?? []) as Row[];

  return (
    <PanelShell
      title="SOP-06: Seller Registry"
      subtitle="Every seller persona on the platform with product count, order count and attributed order revenue (GET /admin/sellers)."
      icon={Store}
      loading={sellers.loading}
      error={sellers.error}
      onRefresh={sellers.reload}
      actions={
        <Field label="Search" className="w-56">
          <TextInput value={search} onChange={setSearch} placeholder="name, phone…" />
        </Field>
      }
    >
      <DataTable
        rows={rows}
        empty="No sellers found."
        columns={[
          {
            header: 'Seller',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'name')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
              </div>
            ),
          },
          { header: 'Phone', cell: (r) => <span className="text-slate-600">{str(r, 'phone')}</span> },
          {
            header: 'Verified',
            cell: (r) => (
              <StatusBadge status={r.vyapariVerified ? 'verified' : 'unverified'} />
            ),
          },
          { header: 'Products', cell: (r) => <span className="font-semibold">{num(r, 'productCount') ?? 0}</span> },
          { header: 'Orders', cell: (r) => <span className="font-semibold">{num(r, 'orderCount') ?? 0}</span> },
          {
            header: 'Revenue',
            cell: (r) => <span className="font-bold text-emerald-700">{money(num(r, 'revenueRupees'))}</span>,
          },
          { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status')} /> },
          { header: 'Joined', cell: (r) => <span className="text-slate-500">{str(r, 'createdAt')}</span> },
        ]}
      />
    </PanelShell>
  );
};

const CategoriesCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const categories = useAsync(() => admin.marketplace.categories(), []);
  const rows = (categories.data ?? []) as Row[];

  const add = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await admin.marketplace.createCategory({ name: newName.trim(), active: true }, `Category created: ${newName.trim()}`);
      setMsg({ kind: 'success', text: `Category “${newName.trim()}” created.` });
      setNewName('');
      categories.reload();
    } catch (e) {
      setMsg({ kind: 'error', text: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="SOP-06: Marketplace Categories"
      subtitle="Admin-managed catalog categories (GET/POST /admin/marketplace/categories). Renames and deactivations are audit-logged; delete is a soft deactivate."
      icon={Tags}
      loading={categories.loading}
      error={categories.error}
      onRefresh={categories.reload}
      actions={
        <div className="flex items-end gap-2">
          <Field label="New category" className="w-52">
            <TextInput value={newName} onChange={setNewName} placeholder="Spices" />
          </Field>
          <Btn tone="primary" busy={busy} disabled={!newName.trim()} onClick={add}>
            Add category
          </Btn>
        </div>
      }
    >
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      {renaming && (
        <div className="p-3 border border-emerald-200 bg-emerald-50/40 rounded-2xl flex flex-wrap items-end gap-2">
          <Field label={`Rename ${renaming.id}`} className="flex-1 min-w-52">
            <TextInput value={renaming.name} onChange={(v) => setRenaming({ ...renaming, name: v })} />
          </Field>
          <Btn onClick={() => setRenaming(null)}>Cancel</Btn>
          <Btn
            tone="primary"
            disabled={!renaming.name.trim()}
            onClick={() =>
              request({
                title: `Rename category ${renaming.id}`,
                description: `New name: “${renaming.name.trim()}”.`,
                confirmLabel: 'Rename',
                action: async (reason) => {
                  await admin.marketplace.updateCategory(renaming.id, { name: renaming.name.trim() }, reason);
                  setRenaming(null);
                },
                onDone: categories.reload,
              })
            }
          >
            <Pencil className="w-3.5 h-3.5" /> Save name
          </Btn>
        </div>
      )}
      <DataTable
        rows={rows}
        empty="No categories configured yet."
        columns={[
          { header: 'Category', cell: (r) => <span className="font-bold text-slate-900">{str(r, 'name')}</span> },
          { header: 'ID', cell: (r) => <span className="font-mono text-[10px] text-slate-400">{str(r, 'id')}</span> },
          {
            header: 'Active',
            cell: (r) => (
              <span
                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  r.active === false
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {r.active === false ? 'deactivated' : 'active'}
              </span>
            ),
          },
          {
            header: 'Actions',
            className: 'text-right',
            cell: (r) => (
              <div className="flex justify-end gap-1.5">
                <Btn onClick={() => setRenaming({ id: str(r, 'id'), name: str(r, 'name') })}>
                  <Pencil className="w-3.5 h-3.5" /> Rename
                </Btn>
                <Btn
                  tone="danger"
                  disabled={r.active === false}
                  onClick={() =>
                    request({
                      title: `Deactivate category “${str(r, 'name')}”`,
                      description: 'Products keep their stored category string; the category disappears from buyer filters.',
                      confirmLabel: 'Deactivate',
                      tone: 'danger',
                      action: (reason) => admin.marketplace.deleteCategory(str(r, 'id'), reason),
                      onDone: categories.reload,
                    })
                  }
                >
                  Deactivate
                </Btn>
              </div>
            ),
          },
        ]}
      />
      {modal}
    </PanelShell>
  );
};
