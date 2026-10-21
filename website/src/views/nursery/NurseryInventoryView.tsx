import React, { useEffect, useState } from 'react';
import {
  Sprout,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
} from 'lucide-react';
import { nursery } from '../../lib/api';

const CATEGORIES = [
  { id: 'all', label: 'All Plants' },
  { id: 'fruit', label: 'Fruit' },
  { id: 'timber', label: 'Timber' },
  { id: 'medicinal', label: 'Medicinal' },
  { id: 'ornamental', label: 'Ornamental' },
  { id: 'flowering', label: 'Flowering' },
  { id: 'vegetables', label: 'Vegetables' },
];

export const NurseryInventoryView: React.FC = () => {
  const [plants, setPlants] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Record<string, unknown> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [species, setSpecies] = useState('');
  const [variety, setVariety] = useState('');
  const [cat, setCat] = useState('fruit');
  const [plantAge, setPlantAge] = useState('1-2 years');
  const [plantHeight, setPlantHeight] = useState('2-3 ft');
  const [mrp, setMrp] = useState<number>(200);
  const [price, setPrice] = useState<number>(160);
  const [stock, setStock] = useState<number>(100);
  const [unit, setUnit] = useState('sapling');
  const [minOrderQty, setMinOrderQty] = useState<number>(5);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const loadPlants = () => {
    setLoading(true);
    const params: Record<string, unknown> = {};
    if (category !== 'all') params.category = category;
    if (search.trim()) params.search = search.trim();

    nursery
      .plants(params)
      .then((res) => {
        setPlants(Array.isArray(res) ? (res as Array<Record<string, unknown>>) : []);
      })
      .catch(() => setPlants([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPlants();
  }, [category]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPlants();
  };

  const openAddModal = () => {
    setEditingPlant(null);
    setTitle('');
    setSpecies('');
    setVariety('');
    setCat('fruit');
    setPlantAge('1-2 years');
    setPlantHeight('2-3 ft');
    setMrp(200);
    setPrice(160);
    setStock(100);
    setUnit('sapling');
    setMinOrderQty(5);
    setDescription('');
    setImageUrl('https://images.unsplash.com/photo-1553279768-865429fa0078');
    setShowModal(true);
  };

  const openEditModal = (p: Record<string, unknown>) => {
    setEditingPlant(p);
    setTitle(String(p.title || ''));
    setSpecies(String(p.species || ''));
    setVariety(String(p.variety || ''));
    setCat(String(p.category || 'fruit'));
    setPlantAge(String(p.plantAge || '1-2 years'));
    setPlantHeight(String(p.plantHeight || '2-3 ft'));
    setMrp(Number(p.mrp || 200));
    setPrice(Number(p.price || 160));
    setStock(Number(p.stock || 0));
    setUnit(String(p.unit || 'sapling'));
    setMinOrderQty(Number(p.minOrderQty || 1));
    setDescription(String(p.description || ''));
    setImageUrl(String(p.imageUrl || ''));
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        title,
        species,
        variety,
        category: cat,
        plantAge,
        plantHeight,
        mrp: Number(mrp),
        price: Number(price),
        stock: Number(stock),
        unit,
        minOrderQty: Number(minOrderQty),
        description,
        imageUrl,
      };

      if (editingPlant && editingPlant.id) {
        await nursery.updatePlant(String(editingPlant.id), payload);
      } else {
        await nursery.createPlant(payload);
      }
      setShowModal(false);
      loadPlants();
    } catch (err) {
      alert('Failed to save plant');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (plantId: string) => {
    if (!window.confirm('Are you sure you want to delete/archive this plant listing?')) return;
    try {
      await nursery.deletePlant(plantId);
      loadPlants();
    } catch (err) {
      alert('Failed to delete plant');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Sprout className="w-6 h-6 text-emerald-700" />
            My Plants & Inventory Catalog
          </h1>
          <p className="text-xs text-slate-500">
            List and manage saplings, fruit grafts, commercial timber, and ornamental plant stocks.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition"
        >
          <Plus className="w-4 h-4" /> Add New Plant
        </button>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by species, variety (e.g. Kesar Mango, Teak, Taiwan Guava)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap gap-2 pt-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                category === c.id
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Plants Grid */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 font-bold">Loading inventory…</div>
      ) : plants.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
          <Sprout className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No Plants Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You have not listed any plants under this category yet. Click "Add New Plant" to start selling on the E-Market.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {plants.map((p) => {
            const pId = String(p.id || '');
            const currentStock = Number(p.stock || 0);
            const isLowStock = currentStock <= 15;
            const photo =
              String(p.imageUrl || '') ||
              'https://images.unsplash.com/photo-1553279768-865429fa0078';

            return (
              <div
                key={pId}
                className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                    <img src={photo} alt={String(p.title)} className="w-full h-full object-cover" />
                    <div className="absolute top-2.5 left-2.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-900/80 backdrop-blur text-white">
                        {String(p.category || 'plant')}
                      </span>
                    </div>

                    <div className="absolute top-2.5 right-2.5">
                      {isLowStock ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/90 text-white flex items-center gap-1 shadow">
                          <AlertTriangle className="w-3 h-3" /> Low Stock
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600/90 text-white flex items-center gap-1 shadow">
                          <CheckCircle2 className="w-3 h-3" /> In Stock
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
                        {String(p.title)}
                      </h3>
                      <p className="text-xs text-emerald-800 font-medium">
                        {String(p.species)} {Boolean(p.variety) && `• ${String(p.variety)}`}
                      </p>
                    </div>

                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      <p>Age: {String(p.plantAge || '1 year')} • Height: {String(p.plantHeight || '2 ft')}</p>
                      <p>Stock: <span className="font-bold text-slate-900">{currentStock}</span> {String(p.unit || 'saplings')}</p>
                    </div>

                    <div className="pt-2 flex items-baseline justify-between border-t border-slate-100">
                      <div>
                        <span className="text-base font-black text-slate-900">
                          ₹{Number(p.price || 0)}
                        </span>
                        {Number(p.mrp || 0) > Number(p.price || 0) && (
                          <span className="text-xs text-slate-400 line-through ml-1.5">
                            ₹{Number(p.mrp || 0)}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Min: {Number(p.minOrderQty || 1)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => openEditModal(p)}
                    className="p-1.5 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition text-xs font-bold flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>

                  <button
                    onClick={() => handleDelete(pId)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition text-xs font-bold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sprout className="w-5 h-5 text-emerald-700" />
                {editingPlant ? 'Edit Plant Listing' : 'Add New Plant Sapling'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Display Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Kesar Mango Grafted Sapling"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Species Name *</label>
                  <input
                    type="text"
                    required
                    value={species}
                    onChange={(e) => setSpecies(e.target.value)}
                    placeholder="Mango / आंबा"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Variety</label>
                  <input
                    type="text"
                    value={variety}
                    onChange={(e) => setVariety(e.target.value)}
                    placeholder="Gir Kesar / Alphonso"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Category *</label>
                  <select
                    value={cat}
                    onChange={(e) => setCat(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="fruit">Fruit</option>
                    <option value="timber">Timber / Agroforestry</option>
                    <option value="medicinal">Medicinal</option>
                    <option value="ornamental">Ornamental</option>
                    <option value="flowering">Flowering</option>
                    <option value="vegetables">Vegetables</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Unit Type</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="sapling">Sapling</option>
                    <option value="bag">Grow Bag</option>
                    <option value="pot">Potted Plant</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Age of Plant</label>
                  <input
                    type="text"
                    value={plantAge}
                    onChange={(e) => setPlantAge(e.target.value)}
                    placeholder="1-2 years"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Height</label>
                  <input
                    type="text"
                    value={plantHeight}
                    onChange={(e) => setPlantHeight(e.target.value)}
                    placeholder="2-3 ft"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Selling Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">MRP (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={mrp}
                    onChange={(e) => setMrp(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Available Stock *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Min Order Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={minOrderQty}
                    onChange={(e) => setMinOrderQty(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Photo URL</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Certified disease-free grafted saplings with vigorous rootstock..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : editingPlant ? 'Update Plant' : 'Publish Plant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
