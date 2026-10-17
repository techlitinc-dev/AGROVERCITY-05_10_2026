import React, { useState } from 'react';
import {
  Store,
  Package,
  Layers,
  FileSpreadsheet,
  DollarSign,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Search,
} from 'lucide-react';
import { StatCard } from '../../components/common/StatCard';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';

export const SellerHome: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'orders' | 'procure' | 'pos'>('catalog');

  // Storefront Catalog State
  const [products, setProducts] = useState([
    { id: 'p1', title: 'Certified Lokwan Wheat Seeds (40kg)', brand: 'Mahyco Gold', price: 1750, stock: 85, category: 'Seeds' },
    { id: 'p2', title: 'IFFCO 19:19:19 100% Water Soluble (25kg)', brand: 'IFFCO', price: 2450, stock: 120, category: 'Fertilizers' },
    { id: 'p3', title: 'Pure Cold Pressed Neem Oil (1L)', brand: 'GreenBio', price: 680, stock: 14, category: 'Crop Protection' },
  ]);

  // Mall Orders State
  const [orders, setOrders] = useState([
    { id: 'ord_9182', customer: 'Suresh More', product: 'Wheat Seeds (40kg)', qty: 2, total: 3500, status: 'placed' },
    { id: 'ord_9183', customer: 'Vikas Kadam', product: 'IFFCO NPK (25kg)', qty: 1, total: 2450, status: 'packed' },
  ]);

  // J-Form Procurement State
  const [jForms, setJForms] = useState([
    { id: 'JF-2026-401', farmer: 'Ramesh Patil', crop: 'Soybean Grade A', qty: '20 Quintals', rate: 4750, total: 95000, date: '17 Oct 2026' },
  ]);

  const [addProductModal, setAddProductModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newPrice, setNewPrice] = useState(1200);
  const [newStock, setNewStock] = useState(50);
  const [newCat, setNewCat] = useState('Seeds');

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setProducts([
      { id: 'p_' + Date.now(), title: newTitle, brand: newBrand, price: newPrice, stock: newStock, category: newCat },
      ...products,
    ]);
    setAddProductModal(false);
  };

  const updateOrderStatus = (id: string, nextStatus: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: nextStatus } : o))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Store className="w-7 h-7 text-emerald-600" />
            Agri Vyapari & Retailer Suite
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Storefront input sales on Krishi Mall, direct farmer crop procurement, J-Form issuance, and customer Khata ledger
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl self-start sm:self-auto overflow-x-auto no-scrollbar">
          {[
            { id: 'catalog', label: 'Store Products' },
            { id: 'orders', label: 'Mall Orders' },
            { id: 'procure', label: 'Procurement (J-Form)' },
            { id: 'pos', label: 'Khata & POS' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Today's Input Sales"
          value={formatCurrency(18400)}
          subtitle="Mall + Counter POS"
          icon={DollarSign}
          colorScheme="green"
        />
        <StatCard
          title="Pending Orders"
          value="2 Orders"
          subtitle="Ready for packing"
          icon={Package}
          colorScheme="amber"
        />
        <StatCard
          title="Low Stock Alert"
          value="1 SKU"
          subtitle="Neem Oil (14 left)"
          icon={AlertTriangle}
          colorScheme="purple"
        />
        <StatCard
          title="Procured This Week"
          value="45 Quintals"
          subtitle="Soybean & Wheat J-Forms"
          icon={FileSpreadsheet}
          colorScheme="blue"
        />
      </div>

      {/* Tab 1: Storefront Catalog */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm text-slate-900">Live Krishi Mall SKUs ({products.length})</h3>
            <button
              onClick={() => setAddProductModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add New SKU
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-6">Product Title & Brand</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Selling Price</th>
                  <th className="py-3 px-4">Stock In Hand</th>
                  <th className="py-3 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {p.title}
                      <span className="text-[11px] text-slate-400 block font-normal">{p.brand}</span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-600">{p.category}</td>
                    <td className="py-3.5 px-4 font-bold text-emerald-800">{formatCurrency(p.price)}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">{p.stock} Units</td>
                    <td className="py-3.5 px-6 text-right">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.stock > 20 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {p.stock > 20 ? 'In Stock' : 'Low Stock'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Mall Orders */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Customer Mall Orders & Shipping Desk</h3>
          <div className="space-y-3">
            {orders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-slate-900">Order #{ord.id}</h4>
                    <StatusBadge status={ord.status} />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Customer: <strong>{ord.customer}</strong> • Item: {ord.product} (Qty: {ord.qty})
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-emerald-800">{formatCurrency(ord.total)}</span>
                  {ord.status === 'placed' && (
                    <button
                      onClick={() => updateOrderStatus(ord.id, 'packed')}
                      className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs"
                    >
                      Mark Packed
                    </button>
                  )}
                  {ord.status === 'packed' && (
                    <button
                      onClick={() => updateOrderStatus(ord.id, 'shipped')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                    >
                      Mark Dispatched
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: J-Form Procurement */}
      {activeTab === 'procure' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">APMC J-Form Digital Sale Receipts</h3>
              <p className="text-xs text-slate-400">Statutory procurement receipt under Agricultural Produce Marketing Act</p>
            </div>
            <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs">
              Generate New J-Form
            </button>
          </div>

          <div className="space-y-3">
            {jForms.map((jf) => (
              <div key={jf.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>J-Form: {jf.id}</span>
                  <span className="text-emerald-700">{formatCurrency(jf.total)}</span>
                </div>
                <p className="text-slate-600">
                  Seller Farmer: <strong>{jf.farmer}</strong> • Produce: {jf.crop} ({jf.qty} @ ₹{jf.rate}/q)
                </p>
                <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200">
                  <span>Date: {jf.date}</span>
                  <span className="text-emerald-800 font-bold">✓ APMC Market Fee (1%) Remitted</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Khata & POS */}
      {activeTab === 'pos' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Customer Udhar Khata Ledger</h3>
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-950 flex justify-between items-center">
            <div>
              <h5 className="font-bold">Total Udhar Outstanding Across 12 Farmers</h5>
              <p className="text-[11px] text-amber-800">Auto SMS reminders scheduled for next harvest cycle</p>
            </div>
            <span className="text-xl font-black text-amber-900">₹42,850</span>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      <ModalSheet
        isOpen={addProductModal}
        onClose={() => setAddProductModal(false)}
        title="Add New Agri Input SKU"
        description="Publish product on Krishi Shopping Mall"
        maxWidth="md"
      >
        <form onSubmit={handleAddProduct} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Product Title</label>
            <input
              type="text"
              placeholder="e.g. Mahyco Hybrid Cotton Seeds (450g)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Brand</label>
              <input
                type="text"
                placeholder="e.g. Mahyco / Bayer / IFFCO"
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <select
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="Seeds">Seeds</option>
                <option value="Fertilizers">Fertilizers</option>
                <option value="Crop Protection">Crop Protection</option>
                <option value="Tools & Machinery">Tools & Machinery</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Price (₹)</label>
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Initial Stock Qty</label>
              <input
                type="number"
                value={newStock}
                onChange={(e) => setNewStock(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all"
          >
            Publish SKU to Krishi Mall
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
