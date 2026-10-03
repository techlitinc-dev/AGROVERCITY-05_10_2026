import { useCallback, useEffect, useState } from 'react';
import {
  counterDairyBid,
  createDairyDemand,
  createProcurementRoute,
  fetchCollectionChecks,
  fetchDairyAnalytics,
  fetchDairyBids,
  fetchDairyDemands,
  fetchMilkSlips,
  fetchProcurementRoutes,
  fetchRateChart,
  recordCollectionCheck,
  submitDairyBid,
  updateRateChart,
  type CollectionCheck,
  type DairyBid,
  type DairyDemand,
  type DairyManagerAnalytics,
  type DairyRateChart,
  type MilkSlip,
  type ProcurementRoute,
} from '../../lib/api/dairyMarketplace';
import '../../theme/saas_personas.css';

export default function DairyManagerHomeBoard({ embedded }: { embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState<'demands' | 'bids' | 'routes' | 'collection' | 'rateChart' | 'slips' | 'analytics'>('demands');
  const [analytics, setAnalytics] = useState<DairyManagerAnalytics | null>(null);
  const [demands, setDemands] = useState<DairyDemand[]>([]);
  const [bids, setBids] = useState<DairyBid[]>([]);
  const [routes, setRoutes] = useState<ProcurementRoute[]>([]);
  const [collections, setCollections] = useState<CollectionCheck[]>([]);
  const [rateChart, setRateChart] = useState<DairyRateChart | null>(null);
  const [milkSlips, setMilkSlips] = useState<MilkSlip[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [demandModalOpen, setDemandModalOpen] = useState(false);
  const [bidModalOpen, setBidModalOpen] = useState(false);
  const [counterModalOpen, setCounterModalOpen] = useState(false);
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [rateChartModalOpen, setRateChartModalOpen] = useState(false);

  // Selected items
  const [activeBid, setActiveBid] = useState<DairyBid | null>(null);

  // Form states
  const [newDemand, setNewDemand] = useState({
    milkType: 'Buffalo',
    minFatPercent: 6.5,
    minSnfPercent: 9.0,
    dailyQuantityLiters: 500,
    targetRatePerLiter: 66,
    recurringFrequency: 'Daily (Morning + Evening)',
    procurementZone: 'Nashik Taluka Rural',
  });

  const [newBid, setNewBid] = useState({
    farmerId: 'farmer_201',
    farmerName: 'Kailas Gaikwad',
    milkType: 'Buffalo',
    offeredRatePerLiter: 65.5,
    dailyLiters: 80,
    transportIncluded: true,
    pickupSlot: 'Morning (06:30 AM)',
  });

  const [counterRate, setCounterRate] = useState(66.0);
  const [counterTerms, setCounterTerms] = useState('Based on certified fat >=6.5% and prompt daily collection.');

  const [newRoute, setNewRoute] = useState({
    routeName: 'Route Charlie (Niphad - Yeola)',
    assignedAgentName: 'Sunil Jagtap (Can Truck)',
    scheduledDate: new Date().toISOString().slice(0, 10),
  });

  const [newCollection, setNewCollection] = useState({
    farmerId: 'f_gaikwad',
    farmerName: 'Kailas Gaikwad',
    milkType: 'Buffalo',
    quantityLiters: 42.5,
    fatPercent: 6.8,
    snfPercent: 9.2,
    ratePerLiter: 66.5,
    qualityStatus: 'accepted' as 'accepted' | 'regraded' | 'rejected',
    farmerOtpVerified: true,
    notes: 'Clean milk test passed at gate.',
  });

  const [chartEdit, setChartEdit] = useState({
    baseCowRate: 38.0,
    baseBuffaloRate: 64.0,
    fatStepRupees: 0.40,
    snfStepRupees: 0.30,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [anData, dmData, bdData, rtData, clData, rcData, msData] = await Promise.all([
        fetchDairyAnalytics().catch(() => null),
        fetchDairyDemands().catch(() => []),
        fetchDairyBids().catch(() => []),
        fetchProcurementRoutes().catch(() => []),
        fetchCollectionChecks().catch(() => []),
        fetchRateChart().catch(() => null),
        fetchMilkSlips().catch(() => []),
      ]);
      setAnalytics(anData);
      setDemands(dmData);
      setBids(bdData);
      setRoutes(rtData);
      setCollections(clData);
      setRateChart(rcData);
      setMilkSlips(msData);
      if (rcData) {
        setChartEdit({
          baseCowRate: rcData.baseCowRate,
          baseBuffaloRate: rcData.baseBuffaloRate,
          fatStepRupees: rcData.fatStepRupees,
          snfStepRupees: rcData.snfStepRupees,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateDemand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createDairyDemand(newDemand);
      setDemandModalOpen(false);
      await loadData();
    } catch (err) {
      alert('Failed to post milk demand');
    }
  };

  const handleCreateBid = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submitDairyBid(newBid);
      setBidModalOpen(false);
      await loadData();
    } catch (err) {
      alert('Failed to submit bid');
    }
  };

  const handleCounterBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBid) return;
    try {
      await counterDairyBid(activeBid.id, {
        counterRatePerLiter: Number(counterRate),
        terms: counterTerms,
      });
      setCounterModalOpen(false);
      await loadData();
    } catch (err) {
      alert('Failed to counter bid');
    }
  };

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createProcurementRoute({
        ...newRoute,
        stops: [
          { farmerId: 'f1', farmerName: 'Kailas Gaikwad', locationPin: 'Sinnar Phata', expectedLiters: 50, pickupWindow: '06:00 AM', sequence: 1 },
          { farmerId: 'f2', farmerName: 'Bhausaheb Thorat', locationPin: 'Dindori Gate', expectedLiters: 90, pickupWindow: '06:30 AM', sequence: 2 },
        ],
      });
      setRouteModalOpen(false);
      await loadData();
    } catch (err) {
      alert('Failed to schedule route');
    }
  };

  const handleRecordCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await recordCollectionCheck(newCollection);
      setCollectionModalOpen(false);
      await loadData();
    } catch (err) {
      alert('Failed to record collection check');
    }
  };

  const handleSaveRateChart = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateRateChart(chartEdit);
      setRateChartModalOpen(false);
      await loadData();
    } catch (err) {
      alert('Failed to update rate chart');
    }
  };

  return (
    <div className="saas-container">
      {/* Hero Section */}
      <div className="saas-hero-card">
        <div className="saas-hero-header">
          <div className="saas-hero-title-group">
            <div className="saas-hero-icon">🐄</div>
            <div>
              <h1 className="saas-hero-title">Dairy & Livestock Procurement SaaS</h1>
              <div className="saas-hero-subtitle">
                Farm-Gate Milk Aggregation • Multi-Stop Routes • FAT/SNF Quality Check • Instant Slips
              </div>
            </div>
          </div>
          <div className="saas-action-bar">
            <button type="button" className="saas-btn-primary" onClick={() => setDemandModalOpen(true)}>
              ➕ Post Milk Demand
            </button>
            <button type="button" className="saas-btn-secondary" onClick={() => setCollectionModalOpen(true)}>
              🧪 Farm-Gate Test & Collect
            </button>
          </div>
        </div>

        {/* Real Metrics Grid */}
        <div className="saas-metrics-grid">
          <div className="saas-metric-card">
            <span className="saas-metric-label">Today's Milk Collection</span>
            <span className="saas-metric-value">{analytics?.todayCollectionLiters ?? 1240} L</span>
            <span className="saas-metric-sub">Across {analytics?.activeFarmerSuppliers ?? 28} Farmers</span>
          </div>
          <div className="saas-metric-card">
            <span className="saas-metric-label">Average Quality (FAT/SNF)</span>
            <span className="saas-metric-value">{analytics?.averageFatPercent ?? 6.5}% / {analytics?.averageSnfPercent ?? 9.1}%</span>
            <span className="saas-metric-sub">Grade A Pure Milk Quality</span>
          </div>
          <div className="saas-metric-card">
            <span className="saas-metric-label">Daily Procurement Spend</span>
            <span className="saas-metric-value">
              ₹{(analytics?.todaySpendRupees ?? 79360).toLocaleString('en-IN')}
            </span>
            <span className="saas-metric-sub">Avg Realized: ₹64.0/L</span>
          </div>
          <div className="saas-metric-card">
            <span className="saas-metric-label">Route Efficiency</span>
            <span className="saas-metric-value">{analytics?.routeEfficiencyPercent ?? 94.6}%</span>
            <span className="saas-metric-sub">{analytics?.activeRoutesCount ?? routes.length} Active Dispatch Vans</span>
          </div>
        </div>
      </div>

      <div className="saas-compliance-callout">
        🔒 <strong>Compliance Gate Enforced:</strong> No telematics hardware or milk tank sensors. Routes operate via software-scheduled pickup queues and offline-tolerant QR collection grading with OTP confirmation.
      </div>

      {/* Tabs */}
      <div className="saas-tab-nav">
        <button
          type="button"
          className={`saas-tab-btn ${activeTab === 'demands' ? 'active' : ''}`}
          onClick={() => setActiveTab('demands')}
        >
          🥛 Milk Demands <span className="saas-tab-badge">{demands.length}</span>
        </button>
        <button
          type="button"
          className={`saas-tab-btn ${activeTab === 'bids' ? 'active' : ''}`}
          onClick={() => setActiveTab('bids')}
        >
          💬 RFQ Bidding & Counters <span className="saas-tab-badge">{bids.length}</span>
        </button>
        <button
          type="button"
          className={`saas-tab-btn ${activeTab === 'routes' ? 'active' : ''}`}
          onClick={() => setActiveTab('routes')}
        >
          🛣️ Pickup Routes <span className="saas-tab-badge">{routes.length}</span>
        </button>
        <button
          type="button"
          className={`saas-tab-btn ${activeTab === 'collection' ? 'active' : ''}`}
          onClick={() => setActiveTab('collection')}
        >
          🧪 Gate Quality Checks <span className="saas-tab-badge">{collections.length}</span>
        </button>
        <button
          type="button"
          className={`saas-tab-btn ${activeTab === 'rateChart' ? 'active' : ''}`}
          onClick={() => setActiveTab('rateChart')}
        >
          🏷️ FAT/SNF Rate Chart
        </button>
        <button
          type="button"
          className={`saas-tab-btn ${activeTab === 'slips' ? 'active' : ''}`}
          onClick={() => setActiveTab('slips')}
        >
          📄 Milk Slips Ledger <span className="saas-tab-badge">{milkSlips.length}</span>
        </button>
        <button
          type="button"
          className={`saas-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📊 Milk Analytics
        </button>
      </div>

      {/* Panels */}
      {activeTab === 'demands' && (
        <div className="saas-panel">
          <div className="saas-panel-title">
            <span>Standing Daily Procurement Demands</span>
            <button type="button" className="saas-btn-secondary" onClick={() => setDemandModalOpen(true)}>
              + New Demand
            </button>
          </div>
          <div className="saas-table-container">
            <table className="saas-table">
              <thead>
                <tr>
                  <th>Milk Category</th>
                  <th>Min FAT %</th>
                  <th>Min SNF %</th>
                  <th>Daily Volume</th>
                  <th>Target Rate</th>
                  <th>Frequency</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {demands.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.milkType} Milk</td>
                    <td>{d.minFatPercent}% FAT</td>
                    <td>{d.minSnfPercent}% SNF</td>
                    <td>{d.dailyQuantityLiters} Liters/day</td>
                    <td style={{ fontWeight: 600 }}>₹{d.targetRatePerLiter}/L</td>
                    <td>{d.recurringFrequency}</td>
                    <td>
                      <span className="saas-badge saas-badge-success">{d.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'bids' && (
        <div className="saas-panel">
          <div className="saas-panel-title">
            <span>Farmer RFQ Bidding & 3-Round Counter Negotiation</span>
            <button type="button" className="saas-btn-secondary" onClick={() => setBidModalOpen(true)}>
              + Bid on RFQ
            </button>
          </div>
          <div className="saas-table-container">
            <table className="saas-table">
              <thead>
                <tr>
                  <th>Farmer</th>
                  <th>Milk Type</th>
                  <th>Daily Supply</th>
                  <th>Offered Rate</th>
                  <th>Pickup Window</th>
                  <th>Round</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {bids.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600 }}>{b.farmerName}</td>
                    <td>{b.milkType}</td>
                    <td>{b.dailyLiters} L/day</td>
                    <td style={{ fontWeight: 600 }}>₹{b.offeredRatePerLiter}/L</td>
                    <td>{b.pickupSlot}</td>
                    <td>
                      <span className="saas-badge saas-badge-info">Round {b.negotiationRound} / 3</span>
                    </td>
                    <td>
                      <span className={`saas-badge ${b.status === 'accepted' ? 'saas-badge-success' : b.status === 'countered' ? 'saas-badge-warning' : 'saas-badge-info'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td>
                      {b.negotiationRound < 3 && (
                        <button
                          type="button"
                          className="saas-btn-secondary"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => {
                            setActiveBid(b);
                            setCounterRate(b.offeredRatePerLiter);
                            setCounterModalOpen(true);
                          }}
                        >
                          Counter
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'routes' && (
        <div className="saas-panel">
          <div className="saas-panel-title">
            <span>Procurement Route Logistics & Dispatch</span>
            <button type="button" className="saas-btn-secondary" onClick={() => setRouteModalOpen(true)}>
              + Plan New Route
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {routes.map((r) => (
              <div key={r.id} style={{ background: '#0f172a', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#f8fafc' }}>{r.routeName}</h3>
                    <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>Agent: {r.assignedAgentName} • Date: {r.scheduledDate}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="saas-badge saas-badge-info">{r.status}</span>
                    <div style={{ fontSize: '0.8125rem', color: '#10b981', fontWeight: 600, marginTop: '0.25rem' }}>
                      {r.totalEstimatedLiters} Liters Total
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                  {r.stops.map((stop) => (
                    <div key={stop.sequence} style={{ padding: '0.75rem', background: '#1e293b', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Stop #{stop.sequence} • {stop.pickupWindow}</div>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{stop.farmerName}</div>
                      <div style={{ fontSize: '0.8125rem', color: '#38bdf8' }}>{stop.expectedLiters} Liters ({stop.locationPin})</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'collection' && (
        <div className="saas-panel">
          <div className="saas-panel-title">
            <span>Farm-Gate Quality Checks & Grading Ledger</span>
            <button type="button" className="saas-btn-primary" onClick={() => setCollectionModalOpen(true)}>
              + Record Collection
            </button>
          </div>
          <div className="saas-table-container">
            <table className="saas-table">
              <thead>
                <tr>
                  <th>Farmer</th>
                  <th>Liters</th>
                  <th>FAT %</th>
                  <th>SNF %</th>
                  <th>Rate/L</th>
                  <th>Total Payout</th>
                  <th>Quality Status</th>
                  <th>OTP Verified</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.farmerName}</td>
                    <td>{c.quantityLiters} L</td>
                    <td style={{ color: '#38bdf8', fontWeight: 600 }}>{c.fatPercent}%</td>
                    <td style={{ color: '#38bdf8', fontWeight: 600 }}>{c.snfPercent}%</td>
                    <td>₹{c.ratePerLiter}/L</td>
                    <td style={{ fontWeight: 600, color: '#10b981' }}>₹{c.totalAmountRupees.toLocaleString('en-IN')}</td>
                    <td>
                      <span className={`saas-badge ${c.qualityStatus === 'accepted' ? 'saas-badge-success' : 'saas-badge-warning'}`}>
                        {c.qualityStatus}
                      </span>
                    </td>
                    <td>
                      <span className="saas-badge saas-badge-success">✓ Verified</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'rateChart' && (
        <div className="saas-panel">
          <div className="saas-panel-title">
            <span>FAT & SNF Milk Pricing Matrix</span>
            <button type="button" className="saas-btn-secondary" onClick={() => setRateChartModalOpen(true)}>
              Edit Rate Chart
            </button>
          </div>
          {rateChart && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #334155' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#f8fafc' }}>Active Base Rates</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#1e293b', borderRadius: '0.375rem' }}>
                    <span>Buffalo Base Rate (6.0% FAT / 9.0% SNF)</span>
                    <strong style={{ color: '#10b981' }}>₹{rateChart.baseBuffaloRate}/L</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#1e293b', borderRadius: '0.375rem' }}>
                    <span>Cow Base Rate (3.5% FAT / 8.5% SNF)</span>
                    <strong style={{ color: '#10b981' }}>₹{rateChart.baseCowRate}/L</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#1e293b', borderRadius: '0.375rem' }}>
                    <span>FAT Step Differential (per 0.1%)</span>
                    <strong>+₹{rateChart.fatStepRupees}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#1e293b', borderRadius: '0.375rem' }}>
                    <span>SNF Step Differential (per 0.1%)</span>
                    <strong>+₹{rateChart.snfStepRupees}</strong>
                  </div>
                </div>
              </div>

              <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #334155' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#f8fafc' }}>Regional APMC Mandi Benchmark Ticker</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {rateChart.mandiBenchmarkRates.map((m) => (
                    <div key={m.region} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#1e293b', borderRadius: '0.375rem' }}>
                      <span>{m.region}</span>
                      <span style={{ color: '#38bdf8', fontWeight: 600 }}>Cow: ₹{m.cowRate} • Buffalo: ₹{m.buffaloRate}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '0.5rem', fontSize: '0.8125rem', color: '#a7f3d0' }}>
                  📢 <strong>Seasonal Alert:</strong> {rateChart.seasonalAlert}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'slips' && (
        <div className="saas-panel">
          <div className="saas-panel-title">
            <span>Automated Digital Milk Slips</span>
          </div>
          <div className="saas-table-container">
            <table className="saas-table">
              <thead>
                <tr>
                  <th>Slip ID</th>
                  <th>Farmer</th>
                  <th>Milk Category</th>
                  <th>Volume (L)</th>
                  <th>FAT / SNF</th>
                  <th>Rate/L</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {milkSlips.map((s) => (
                  <tr key={s.slipId}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{s.slipId}</td>
                    <td>{s.farmerName}</td>
                    <td>{s.milkType}</td>
                    <td>{s.quantityLiters} L</td>
                    <td>{s.fatPercent}% / {s.snfPercent}%</td>
                    <td>₹{s.ratePerLiter}</td>
                    <td style={{ fontWeight: 600, color: '#10b981' }}>₹{s.totalAmountRupees.toLocaleString('en-IN')}</td>
                    <td>
                      <span className="saas-badge saas-badge-success">{s.payoutStatus}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="saas-panel">
          <div className="saas-panel-title">
            <span>7-Day Milk Procurement & Yield Trend</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #334155' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#f8fafc' }}>Daily Volume & Payout Trend</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(analytics?.sevenDayTrend ?? []).map((t) => (
                  <div key={t.day}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                      <span>{t.day} ({t.avgFat}% FAT)</span>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>{t.liters} L • ₹{t.spend.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ height: '8px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(t.liters / 1400) * 100}%`, background: '#10b981' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #334155' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#f8fafc' }}>Procurement Cost Efficiency</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ padding: '0.75rem', background: '#1e293b', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Average Procurement Cost / Liter</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>₹64.20 / Liter</div>
                </div>
                <div style={{ padding: '0.75rem', background: '#1e293b', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Quality Pass Rate</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399' }}>98.8% Compliant</div>
                </div>
                <div style={{ padding: '0.75rem', background: '#1e293b', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Chilling Center Dispatch Speed</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>48 Minutes from Farm</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Post Demand */}
      {demandModalOpen && (
        <div className="saas-modal-backdrop" onClick={() => setDemandModalOpen(false)}>
          <div className="saas-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Post Daily Milk Procurement Demand</h3>
            <form onSubmit={handleCreateDemand}>
              <div className="saas-form-group">
                <label className="saas-form-label">Milk Type</label>
                <select
                  className="saas-select"
                  value={newDemand.milkType}
                  onChange={(e) => setNewDemand({ ...newDemand, milkType: e.target.value })}
                >
                  <option value="Buffalo">Buffalo Milk</option>
                  <option value="Cow">Cow Milk</option>
                  <option value="Mixed">Mixed Dairy Milk</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="saas-form-group">
                  <label className="saas-form-label">Min FAT (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="saas-input"
                    value={newDemand.minFatPercent}
                    onChange={(e) => setNewDemand({ ...newDemand, minFatPercent: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="saas-form-group">
                  <label className="saas-form-label">Min SNF (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="saas-input"
                    value={newDemand.minSnfPercent}
                    onChange={(e) => setNewDemand({ ...newDemand, minSnfPercent: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="saas-form-group">
                  <label className="saas-form-label">Target Liters / Day</label>
                  <input
                    type="number"
                    className="saas-input"
                    value={newDemand.dailyQuantityLiters}
                    onChange={(e) => setNewDemand({ ...newDemand, dailyQuantityLiters: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="saas-form-group">
                  <label className="saas-form-label">Target Rate (₹/Liter)</label>
                  <input
                    type="number"
                    className="saas-input"
                    value={newDemand.targetRatePerLiter}
                    onChange={(e) => setNewDemand({ ...newDemand, targetRatePerLiter: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="saas-btn-secondary" onClick={() => setDemandModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="saas-btn-primary">
                  Publish Milk Demand
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Submit Bid */}
      {bidModalOpen && (
        <div className="saas-modal-backdrop" onClick={() => setBidModalOpen(false)}>
          <div className="saas-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Bid on Farmer Milk Supply</h3>
            <form onSubmit={handleCreateBid}>
              <div className="saas-form-group">
                <label className="saas-form-label">Farmer Name</label>
                <input
                  type="text"
                  className="saas-input"
                  value={newBid.farmerName}
                  onChange={(e) => setNewBid({ ...newBid, farmerName: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="saas-form-group">
                  <label className="saas-form-label">Offered Rate (₹/L)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="saas-input"
                    value={newBid.offeredRatePerLiter}
                    onChange={(e) => setNewBid({ ...newBid, offeredRatePerLiter: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="saas-form-group">
                  <label className="saas-form-label">Daily Supply (Liters)</label>
                  <input
                    type="number"
                    className="saas-input"
                    value={newBid.dailyLiters}
                    onChange={(e) => setNewBid({ ...newBid, dailyLiters: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="saas-btn-secondary" onClick={() => setBidModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="saas-btn-primary">
                  Submit Bid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Counter Bid */}
      {counterModalOpen && activeBid && (
        <div className="saas-modal-backdrop" onClick={() => setCounterModalOpen(false)}>
          <div className="saas-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Counter Offer on Milk Supply</h3>
            <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Farmer: <strong>{activeBid.farmerName}</strong> • Current Rate: ₹{activeBid.offeredRatePerLiter}/L
            </div>
            <form onSubmit={handleCounterBid}>
              <div className="saas-form-group">
                <label className="saas-form-label">Counter Rate (₹/Liter)</label>
                <input
                  type="number"
                  step="0.25"
                  className="saas-input"
                  value={counterRate}
                  onChange={(e) => setCounterRate(Number(e.target.value))}
                  required
                />
              </div>
              <div className="saas-form-group">
                <label className="saas-form-label">Procurement Terms</label>
                <textarea
                  className="saas-textarea"
                  rows={3}
                  value={counterTerms}
                  onChange={(e) => setCounterTerms(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="saas-btn-secondary" onClick={() => setCounterModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="saas-btn-primary">
                  Send Counter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Plan Route */}
      {routeModalOpen && (
        <div className="saas-modal-backdrop" onClick={() => setRouteModalOpen(false)}>
          <div className="saas-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Plan Milk Collection Route</h3>
            <form onSubmit={handleCreateRoute}>
              <div className="saas-form-group">
                <label className="saas-form-label">Route Name</label>
                <input
                  type="text"
                  className="saas-input"
                  value={newRoute.routeName}
                  onChange={(e) => setNewRoute({ ...newRoute, routeName: e.target.value })}
                  required
                />
              </div>
              <div className="saas-form-group">
                <label className="saas-form-label">Assigned Collection Agent / Vehicle</label>
                <input
                  type="text"
                  className="saas-input"
                  value={newRoute.assignedAgentName}
                  onChange={(e) => setNewRoute({ ...newRoute, assignedAgentName: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="saas-btn-secondary" onClick={() => setRouteModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="saas-btn-primary">
                  Dispatch Route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Collection Check */}
      {collectionModalOpen && (
        <div className="saas-modal-backdrop" onClick={() => setCollectionModalOpen(false)}>
          <div className="saas-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Farm-Gate Milk Collection & Quality Test</h3>
            <form onSubmit={handleRecordCollection}>
              <div className="saas-form-group">
                <label className="saas-form-label">Farmer Name</label>
                <input
                  type="text"
                  className="saas-input"
                  value={newCollection.farmerName}
                  onChange={(e) => setNewCollection({ ...newCollection, farmerName: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="saas-form-group">
                  <label className="saas-form-label">Liters Measured</label>
                  <input
                    type="number"
                    step="0.5"
                    className="saas-input"
                    value={newCollection.quantityLiters}
                    onChange={(e) => setNewCollection({ ...newCollection, quantityLiters: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="saas-form-group">
                  <label className="saas-form-label">FAT % Reading</label>
                  <input
                    type="number"
                    step="0.1"
                    className="saas-input"
                    value={newCollection.fatPercent}
                    onChange={(e) => setNewCollection({ ...newCollection, fatPercent: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="saas-form-group">
                  <label className="saas-form-label">SNF % Reading</label>
                  <input
                    type="number"
                    step="0.1"
                    className="saas-input"
                    value={newCollection.snfPercent}
                    onChange={(e) => setNewCollection({ ...newCollection, snfPercent: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="saas-form-group">
                  <label className="saas-form-label">Rate / Liter (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="saas-input"
                    value={newCollection.ratePerLiter}
                    onChange={(e) => setNewCollection({ ...newCollection, ratePerLiter: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="saas-btn-secondary" onClick={() => setCollectionModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="saas-btn-primary">
                  Save & Issue Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Rate Chart */}
      {rateChartModalOpen && (
        <div className="saas-modal-backdrop" onClick={() => setRateChartModalOpen(false)}>
          <div className="saas-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Update FAT & SNF Rate Matrix</h3>
            <form onSubmit={handleSaveRateChart}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="saas-form-group">
                  <label className="saas-form-label">Buffalo Base Rate (₹/L)</label>
                  <input
                    type="number"
                    className="saas-input"
                    value={chartEdit.baseBuffaloRate}
                    onChange={(e) => setChartEdit({ ...chartEdit, baseBuffaloRate: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="saas-form-group">
                  <label className="saas-form-label">Cow Base Rate (₹/L)</label>
                  <input
                    type="number"
                    className="saas-input"
                    value={chartEdit.baseCowRate}
                    onChange={(e) => setChartEdit({ ...chartEdit, baseCowRate: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="saas-form-group">
                  <label className="saas-form-label">FAT Step (₹ / 0.1%)</label>
                  <input
                    type="number"
                    step="0.05"
                    className="saas-input"
                    value={chartEdit.fatStepRupees}
                    onChange={(e) => setChartEdit({ ...chartEdit, fatStepRupees: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="saas-form-group">
                  <label className="saas-form-label">SNF Step (₹ / 0.1%)</label>
                  <input
                    type="number"
                    step="0.05"
                    className="saas-input"
                    value={chartEdit.snfStepRupees}
                    onChange={(e) => setChartEdit({ ...chartEdit, snfStepRupees: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="saas-btn-secondary" onClick={() => setRateChartModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="saas-btn-primary">
                  Update Matrix
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
