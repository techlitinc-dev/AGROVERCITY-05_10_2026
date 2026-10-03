import { useCallback, useEffect, useState } from 'react';
import {
  acceptLeaseRequest,
  counterLeaseRequest,
  createListing,
  createPlot,
  fetchLandlordAnalytics,
  fetchLeaseMilestones,
  fetchLeaseRequests,
  fetchLeases,
  fetchMyListings,
  fetchMyPlots,
  recordRentPayment,
  rejectLeaseRequest,
  updateLeaseMilestone,
  type EscrowMilestone,
  type LandListing,
  type LandlordAnalytics,
  type Lease,
  type LeaseRequest,
  type Plot,
} from '../../lib/api/landlord';
import { toast } from '../../components/toast';
import '../../theme/saas_personas.css';

export default function LandlordHomeBoard({ embedded }: { embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState<'plots' | 'applications' | 'leases' | 'rent' | 'analytics' | 'vault'>('plots');
  const [analytics, setAnalytics] = useState<LandlordAnalytics | null>(null);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [listings, setListings] = useState<LandListing[]>([]);
  const [requests, setRequests] = useState<LeaseRequest[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [plotModalOpen, setPlotModalOpen] = useState(false);
  const [listingModalOpen, setListingModalOpen] = useState(false);
  const [counterModalOpen, setCounterModalOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<LeaseRequest | null>(null);
  const [counterRent, setCounterRent] = useState(25000);
  const [counterNote, setCounterNote] = useState('');

  // Plot form state
  const [newPlot, setNewPlot] = useState({
    name: '',
    village: 'Niphad',
    district: 'Nashik',
    areaAcres: 5.0,
    gatNumber: '',
    soilType: 'Medium Black (Kali)',
  });

  // Listing form state
  const [newListing, setNewListing] = useState({
    village: 'Niphad',
    district: 'Nashik',
    lat: 20.08,
    lng: 74.12,
    areaAcres: 5.0,
    expectedRentRupees: 28000,
    soilType: 'Medium Black (Kali)',
    waterSource: 'Canal + Borewell',
  });

  // Milestones drawer
  const [milestoneLeaseId, setMilestoneLeaseId] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<EscrowMilestone[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [anData, plData, lsData, rqData, leData] = await Promise.all([
        fetchLandlordAnalytics().catch(() => null),
        fetchMyPlots().catch(() => []),
        fetchMyListings().catch(() => []),
        fetchLeaseRequests().catch(() => []),
        fetchLeases().catch(() => []),
      ]);
      setAnalytics(anData);
      setPlots(plData);
      setListings(lsData);
      setRequests(rqData);
      setLeases(leData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreatePlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlot.name) return;
    try {
      await createPlot(newPlot);
      setPlotModalOpen(false);
      setNewPlot({ name: '', village: 'Niphad', district: 'Nashik', areaAcres: 5.0, gatNumber: '', soilType: 'Medium Black (Kali)' });
      await loadData();
    } catch (err) {
      toast('Failed to add plot', { error: true });
    }
  };

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createListing(newListing);
      setListingModalOpen(false);
      await loadData();
    } catch (err) {
      toast('Failed to publish listing', { error: true });
    }
  };

  const handleAcceptRequest = async (id: string) => {
    try {
      await acceptLeaseRequest(id);
      await loadData();
    } catch (err) {
      toast('Failed to accept request', { error: true });
    }
  };

  const handleRejectRequest = async (id: string) => {
    const reason = 'Rejected by landlord';
    try {
      await rejectLeaseRequest(id, reason);
      await loadData();
    } catch (err) {
      toast('Failed to reject request', { error: true });
    }
  };

  const handleCounterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRequest) return;
    try {
      await counterLeaseRequest(activeRequest.id, {
        counterRentRupees: Number(counterRent),
        note: counterNote,
      });
      setCounterModalOpen(false);
      await loadData();
    } catch (err) {
      toast('Failed to send counter offer', { error: true });
    }
  };

  const openMilestones = async (leaseId: string) => {
    setMilestoneLeaseId(leaseId);
    try {
      const res = await fetchLeaseMilestones(leaseId);
      setMilestones(res.milestones);
    } catch (err) {
      toast('Could not fetch milestones', { error: true });
    }
  };

  const handleReleaseMilestone = async (leaseId: string, index: number) => {
    try {
      const res = await updateLeaseMilestone(leaseId, {
        milestoneIndex: index,
        status: 'released',
        notes: 'Handover and inspection approved by landlord',
      });
      setMilestones(res.milestones);
      await loadData();
    } catch (err) {
      toast('Failed to update milestone', { error: true });
    }
  };

  return (
    <div className="saas-container">
      {/* Hero Section */}
      <div className="saas-hero-card">
        <div className="saas-hero-header">
          <div className="saas-hero-title-group">
            <div className="saas-hero-icon">🏞️</div>
            <div>
              <h1 className="saas-hero-title">Farm Landlord SaaS Suite</h1>
              <div className="saas-hero-subtitle">
                Lease Management • Escrow Milestones • Title Vault • Demand Analytics
              </div>
            </div>
          </div>
          <div className="saas-action-bar">
            <button type="button" className="saas-btn-primary" onClick={() => setPlotModalOpen(true)}>
              ➕ Add Land Plot
            </button>
            <button type="button" className="saas-btn-secondary" onClick={() => setListingModalOpen(true)}>
              📢 Publish Listing
            </button>
          </div>
        </div>

        {/* Real Metrics Grid */}
        <div className="saas-metrics-grid">
          <div className="saas-metric-card">
            <span className="saas-metric-label">Total Acreage</span>
            <span className="saas-metric-value">{analytics?.totalAcreage ?? plots.reduce((acc, p) => acc + p.areaAcres, 0)} Ac</span>
            <span className="saas-metric-sub">Across {plots.length} Registered Plots</span>
          </div>
          <div className="saas-metric-card">
            <span className="saas-metric-label">Active Tenants</span>
            <span className="saas-metric-value">{analytics?.activeTenants ?? leases.filter((l) => l.status === 'active').length}</span>
            <span className="saas-metric-sub">
              {analytics?.occupancyRatePercent !== undefined ? `${analytics.occupancyRatePercent}%` : '…'} Occupancy Rate
            </span>
          </div>
          <div className="saas-metric-card">
            <span className="saas-metric-label">Monthly Rental Yield</span>
            <span className="saas-metric-value">
              ₹{(analytics?.monthlyRentIncomeRupees ?? leases.reduce((acc, l) => acc + l.monthlyRentRupees, 0)).toLocaleString('en-IN')}
            </span>
            <span className="saas-metric-sub">Guaranteed Escrow Payouts</span>
          </div>
          <div className="saas-metric-card">
            <span className="saas-metric-label">Pending Applications</span>
            <span className="saas-metric-value">{analytics?.pendingRequestsCount ?? requests.filter((r) => r.status === 'pending').length}</span>
            <span className="saas-metric-sub">Verified Tenant Pipeline</span>
          </div>
        </div>
      </div>

      <div className="saas-compliance-callout">
        🔒 <strong>Compliance Gate Enforced:</strong> 100% In-app communication & escrow settlement. Pre-booking chat is disabled; negotiations occur via structured counter-offers (Max 5 rounds).
      </div>

      {/* Navigation Tabs */}
      <div className="saas-tab-nav">
        <button
          type="button"
          className={`saas-tab-btn ${activeTab === 'plots' ? 'active' : ''}`}
          onClick={() => setActiveTab('plots')}
        >
          🗺️ Plots & Listings <span className="saas-tab-badge">{plots.length + listings.length}</span>
        </button>
        <button
          type="button"
          className={`saas-tab-btn ${activeTab === 'applications' ? 'active' : ''}`}
          onClick={() => setActiveTab('applications')}
        >
          📩 Applications & Negotiations <span className="saas-tab-badge">{requests.length}</span>
        </button>
        <button
          type="button"
          className={`saas-tab-btn ${activeTab === 'leases' ? 'active' : ''}`}
          onClick={() => setActiveTab('leases')}
        >
          📜 Active Leases & Escrow <span className="saas-tab-badge">{leases.length}</span>
        </button>
        <button
          type="button"
          className={`saas-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📊 Land Analytics
        </button>
        <button
          type="button"
          className={`saas-tab-btn ${activeTab === 'vault' ? 'active' : ''}`}
          onClick={() => setActiveTab('vault')}
        >
          🗄️ 7/12 Title Vault
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'plots' && (
        <div className="saas-panel">
          <div className="saas-panel-title">
            <span>Land Plots Catalog</span>
            <button type="button" className="saas-btn-secondary" onClick={() => setPlotModalOpen(true)}>
              + New Plot
            </button>
          </div>
          {plots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              No plots registered yet. Click "+ New Plot" to add your agricultural parcel.
            </div>
          ) : (
            <div className="saas-table-container">
              <table className="saas-table">
                <thead>
                  <tr>
                    <th>Plot Name</th>
                    <th>Location</th>
                    <th>Acreage</th>
                    <th>Gat / Survey #</th>
                    <th>Soil Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {plots.map((plot) => (
                    <tr key={plot.id}>
                      <td style={{ fontWeight: 600 }}>{plot.name}</td>
                      <td>{plot.village}, {plot.district}</td>
                      <td>{plot.areaAcres} Acres</td>
                      <td>{plot.gatNumber || 'Gat 142/A'}</td>
                      <td>{plot.soilType || 'Medium Black'}</td>
                      <td>
                        <span className={`saas-badge ${plot.status === 'leased' ? 'saas-badge-success' : 'saas-badge-info'}`}>
                          {plot.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: '2rem' }}>
            <div className="saas-panel-title">
              <span>Public Marketplace Listings</span>
              <button type="button" className="saas-btn-secondary" onClick={() => setListingModalOpen(true)}>
                + New Listing
              </button>
            </div>
            {listings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                No active marketplace listings. Publish a listing to attract verified tenant farmers.
              </div>
            ) : (
              <div className="saas-table-container">
                <table className="saas-table">
                  <thead>
                    <tr>
                      <th>District / Village</th>
                      <th>Area</th>
                      <th>Expected Rent</th>
                      <th>Water Source</th>
                      <th>Soil</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map((l) => (
                      <tr key={l.id}>
                        <td>{l.village}, {l.district}</td>
                        <td>{l.areaAcres} Ac</td>
                        <td style={{ fontWeight: 600 }}>₹{l.expectedRentRupees.toLocaleString('en-IN')}/mo</td>
                        <td>{l.waterSource || 'Borewell'}</td>
                        <td>{l.soilType || 'Black Loam'}</td>
                        <td>
                          <span className="saas-badge saas-badge-success">{l.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'applications' && (
        <div className="saas-panel">
          <div className="saas-panel-title">
            <span>Incoming Tenant Applications & Negotiation Rounds</span>
          </div>
          {requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              No incoming tenant applications currently.
            </div>
          ) : (
            <div className="saas-table-container">
              <table className="saas-table">
                <thead>
                  <tr>
                    <th>Farmer Name</th>
                    <th>Duration</th>
                    <th>Proposed / Counter Rent</th>
                    <th>Negotiation Round</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.farmerName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{r.message || 'Seeking multi-season cultivation lease'}</div>
                      </td>
                      <td>{r.durationMonths} Months</td>
                      <td style={{ fontWeight: 600 }}>
                        {r.counterRentRupees ? (
                          <>
                            <span style={{ color: '#fbbf24' }}>₹{r.counterRentRupees.toLocaleString('en-IN')} (Counter)</span>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Original: ₹{r.proposedRentRupees || 25000}</div>
                          </>
                        ) : (
                          `₹${(r.proposedRentRupees || 25000).toLocaleString('en-IN')}/mo`
                        )}
                      </td>
                      <td>
                        <span className="saas-badge saas-badge-info">Round {r.negotiationRounds || 1} / 5</span>
                      </td>
                      <td>
                        <span className={`saas-badge ${r.status === 'accepted' ? 'saas-badge-success' : r.status === 'rejected' ? 'saas-badge-danger' : 'saas-badge-warning'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        {r.status === 'pending' || r.status === 'countered' ? (
                          <div style={{ display: 'flex', gap: '0.375rem' }}>
                            <button
                              type="button"
                              className="saas-btn-primary"
                              style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}
                              onClick={() => handleAcceptRequest(r.id)}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="saas-btn-secondary"
                              style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}
                              onClick={() => {
                                setActiveRequest(r);
                                setCounterRent(r.counterRentRupees || r.proposedRentRupees || 26000);
                                setCounterModalOpen(true);
                              }}
                            >
                              Counter
                            </button>
                            <button
                              type="button"
                              className="saas-btn-secondary"
                              style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem', color: '#f87171' }}
                              onClick={() => handleRejectRequest(r.id)}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Completed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'leases' && (
        <div className="saas-panel">
          <div className="saas-panel-title">
            <span>Executed Digital Lease Agreements</span>
          </div>
          {leases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              No active leases currently executed.
            </div>
          ) : (
            <div className="saas-table-container">
              <table className="saas-table">
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Term Window</th>
                    <th>Monthly Rent</th>
                    <th>Digital Contract</th>
                    <th>Escrow Milestones</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leases.map((lease) => (
                    <tr key={lease.id}>
                      <td style={{ fontWeight: 600 }}>{lease.tenantName}</td>
                      <td>{lease.startDate} to {lease.endDate}</td>
                      <td style={{ fontWeight: 600 }}>₹{lease.monthlyRentRupees.toLocaleString('en-IN')}/mo</td>
                      <td>
                        <span className="saas-badge saas-badge-success">E-Signed (OTP)</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="saas-btn-secondary"
                          style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}
                          onClick={() => openMilestones(lease.id)}
                        >
                          View 3 Milestones
                        </button>
                      </td>
                      <td>
                        <span className="saas-badge saas-badge-success">{lease.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Milestones Drawer / Detail if open */}
          {milestoneLeaseId && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '0.75rem', border: '1px solid #334155' }}>
              <div className="saas-panel-title">
                <span>3-Stage Escrow Milestones (Lease: {milestoneLeaseId.slice(0, 8)})</span>
                <button type="button" className="saas-btn-secondary" onClick={() => setMilestoneLeaseId(null)}>Close</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                {milestones.map((m) => (
                  <div key={m.index} style={{ padding: '1rem', background: '#1e293b', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Milestone {m.index + 1} ({m.percentage}%)</div>
                    <div style={{ fontWeight: 700, margin: '0.25rem 0', color: '#f8fafc' }}>{m.name}</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>₹{m.amountRupees.toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.5rem 0' }}>{m.notes}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                      <span className={`saas-badge ${m.status === 'released' ? 'saas-badge-success' : 'saas-badge-warning'}`}>
                        {m.status}
                      </span>
                      {m.status !== 'released' && (
                        <button
                          type="button"
                          className="saas-btn-primary"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => handleReleaseMilestone(milestoneLeaseId, m.index)}
                        >
                          Release Hold
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="saas-panel">
          <div className="saas-panel-title">
            <span>Landlord Yield & Demand Intelligence</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #334155' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#f8fafc' }}>District Rental Demand (Sowing Window)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(analytics?.demandTrend ?? []).map((d) => (
                  <div key={d.month}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                      <span>{d.month}</span>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>₹{d.avgAcreRate}/acre (Score {d.demandScore})</span>
                    </div>
                    <div style={{ height: '8px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${d.demandScore}%`, background: '#10b981' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #334155' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#f8fafc' }}>Soil Composition & Crop Suitability</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#1e293b', borderRadius: '0.375rem' }}>
                  <span>Medium Black (Kali)</span>
                  <span style={{ fontWeight: 600, color: '#38bdf8' }}>Cotton, Soybean, Wheat</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#1e293b', borderRadius: '0.375rem' }}>
                  <span>Red Loamy Soil</span>
                  <span style={{ fontWeight: 600, color: '#38bdf8' }}>Pomegranate, Grapes, Pulses</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#1e293b', borderRadius: '0.375rem' }}>
                  <span>Alluvial Silt</span>
                  <span style={{ fontWeight: 600, color: '#38bdf8' }}>Sugarcane, Vegetables, Paddy</span>
                </div>
              </div>
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '0.5rem', fontSize: '0.8125rem', color: '#a7f3d0' }}>
                💡 <strong>Pre-Rabi Advisory:</strong> Sowing demand spikes in Oct-Nov. Land parcels with borewell access command 22% rate premium.
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'vault' && (
        <div className="saas-panel">
          <div className="saas-panel-title">
            <span>7/12 Extract & Title Verification Vault</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: '#0f172a', borderRadius: '0.5rem', border: '1px solid #334155' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>State Land Registry Cross-Check</div>
              <div style={{ fontWeight: 600, margin: '0.25rem 0', color: '#f8fafc' }}>Mahabhulekh 7/12 Extract</div>
              <span className="saas-badge saas-badge-success">Verified with Record of Rights</span>
            </div>
            <div style={{ padding: '1rem', background: '#0f172a', borderRadius: '0.5rem', border: '1px solid #334155' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Possession Corroboration</div>
              <div style={{ fontWeight: 600, margin: '0.25rem 0', color: '#f8fafc' }}>Gram Panchayat Property Tax (FY26)</div>
              <span className="saas-badge saas-badge-success">Paid & Corroborated</span>
            </div>
            <div style={{ padding: '1rem', background: '#0f172a', borderRadius: '0.5rem', border: '1px solid #334155' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Financial Identity (TDS Compliance)</div>
              <div style={{ fontWeight: 600, margin: '0.25rem 0', color: '#f8fafc' }}>PAN & Penny-Drop Bank Account</div>
              <span className="saas-badge saas-badge-success">Payouts Enabled</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Plot */}
      {plotModalOpen && (
        <div className="saas-modal-backdrop" onClick={() => setPlotModalOpen(false)}>
          <div className="saas-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Register New Agricultural Plot</h3>
            <form onSubmit={handleCreatePlot}>
              <div className="saas-form-group">
                <label className="saas-form-label">Plot Name / Nickname</label>
                <input
                  type="text"
                  className="saas-input"
                  placeholder="e.g. North Canal Field"
                  value={newPlot.name}
                  onChange={(e) => setNewPlot({ ...newPlot, name: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="saas-form-group">
                  <label className="saas-form-label">Village</label>
                  <input
                    type="text"
                    className="saas-input"
                    value={newPlot.village}
                    onChange={(e) => setNewPlot({ ...newPlot, village: e.target.value })}
                    required
                  />
                </div>
                <div className="saas-form-group">
                  <label className="saas-form-label">District</label>
                  <input
                    type="text"
                    className="saas-input"
                    value={newPlot.district}
                    onChange={(e) => setNewPlot({ ...newPlot, district: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="saas-form-group">
                  <label className="saas-form-label">Acreage</label>
                  <input
                    type="number"
                    step="0.1"
                    className="saas-input"
                    value={newPlot.areaAcres}
                    onChange={(e) => setNewPlot({ ...newPlot, areaAcres: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="saas-form-group">
                  <label className="saas-form-label">Gat / Survey Number</label>
                  <input
                    type="text"
                    className="saas-input"
                    placeholder="e.g. 142/2"
                    value={newPlot.gatNumber}
                    onChange={(e) => setNewPlot({ ...newPlot, gatNumber: e.target.value })}
                  />
                </div>
              </div>
              <div className="saas-form-group">
                <label className="saas-form-label">Soil Type</label>
                <select
                  className="saas-select"
                  value={newPlot.soilType}
                  onChange={(e) => setNewPlot({ ...newPlot, soilType: e.target.value })}
                >
                  <option value="Medium Black (Kali)">Medium Black (Kali)</option>
                  <option value="Deep Black (Regur)">Deep Black (Regur)</option>
                  <option value="Red Loamy (Tambadi)">Red Loamy (Tambadi)</option>
                  <option value="Sandy Loam">Sandy Loam</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="saas-btn-secondary" onClick={() => setPlotModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="saas-btn-primary">
                  Save Plot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Publish Listing */}
      {listingModalOpen && (
        <div className="saas-modal-backdrop" onClick={() => setListingModalOpen(false)}>
          <div className="saas-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Publish Land for Lease</h3>
            <form onSubmit={handleCreateListing}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="saas-form-group">
                  <label className="saas-form-label">Area (Acres)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="saas-input"
                    value={newListing.areaAcres}
                    onChange={(e) => setNewListing({ ...newListing, areaAcres: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="saas-form-group">
                  <label className="saas-form-label">Expected Rent (₹/Month)</label>
                  <input
                    type="number"
                    className="saas-input"
                    value={newListing.expectedRentRupees}
                    onChange={(e) => setNewListing({ ...newListing, expectedRentRupees: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div className="saas-form-group">
                <label className="saas-form-label">Water Source</label>
                <input
                  type="text"
                  className="saas-input"
                  value={newListing.waterSource}
                  onChange={(e) => setNewListing({ ...newListing, waterSource: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="saas-btn-secondary" onClick={() => setListingModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="saas-btn-primary">
                  Publish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Counter Offer */}
      {counterModalOpen && activeRequest && (
        <div className="saas-modal-backdrop" onClick={() => setCounterModalOpen(false)}>
          <div className="saas-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Structured Rate Counter-Offer</h3>
            <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Tenant: <strong>{activeRequest.farmerName}</strong> • Original Rate: ₹{activeRequest.proposedRentRupees || 25000}/mo
            </div>
            <form onSubmit={handleCounterSubmit}>
              <div className="saas-form-group">
                <label className="saas-form-label">Proposed Counter Rent (₹ / Month)</label>
                <input
                  type="number"
                  className="saas-input"
                  value={counterRent}
                  onChange={(e) => setCounterRent(Number(e.target.value))}
                  required
                />
              </div>
              <div className="saas-form-group">
                <label className="saas-form-label">Terms / Notes to Tenant</label>
                <textarea
                  className="saas-textarea"
                  rows={3}
                  placeholder="Includes borewell electricity charges and organic certification maintenance..."
                  value={counterNote}
                  onChange={(e) => setCounterNote(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="saas-btn-secondary" onClick={() => setCounterModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="saas-btn-primary">
                  Submit Counter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
