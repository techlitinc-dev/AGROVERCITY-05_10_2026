import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  ProduceLot,
  MandiRate,
  FarmDiaryEntry,
  AdvisoryScan,
  SoilTest,
  Vehicle,
  TransportBooking,
  BuyerOrg,
  B2BDeal,
  BuyerContract,
  WomenShg,
  GruhCert,
  WomenEnterpriseProduct,
  TreeNursery,
  TreeRequest,
  NurseryPlant,
  MarketplaceOrder,
  MarketplaceProduct,
  AuditLogEntry,
  AgriNewsItem,
  LiveChannel,
  WorkshopItem,
  VideoGuideItem,
  BlogArticleItem,
  GovSchemeItem,
  LandListing,
  LandLease,
  EquipmentItem,
  EquipmentBooking,
  FpoItem,
  FpoPoolItem,
  LivestockVet,
  GaushalaItem,
  ColdStorageFacility,
  GurukulCourse,
  TeacherProfile,
  FinanceLoan,
  InsuranceClaim,
  ExportRfq,
  ExportOrder,
} from '../types/entities';
import { AdminUser } from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/v1';

class ApiService {
  private client: AxiosInstance;
  private currentRole: string = 'superadmin';

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('agrovercity_superadmin_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      if (this.currentRole) {
        config.headers['X-Admin-Role'] = this.currentRole;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        const message =
          error.response?.data?.error?.message ||
          error.response?.data?.detail?.message ||
          error.response?.data?.detail ||
          error.message ||
          'Backend Request Failed';
        return Promise.reject(new Error(message));
      }
    );
  }

  setRole(role: string) {
    this.currentRole = role;
  }

  // --------------------------------------------------------------------------
  // AUTH & MULTI-USER MANAGEMENT
  // --------------------------------------------------------------------------
  async loginWithPhoneMpin(phone: string, mpin: string): Promise<{ accessToken: string; user: AdminUser }> {
    const res = await this.client.post('/auth/login', { phone, mpin });
    const { accessToken, user } = res.data;
    localStorage.setItem('agrovercity_superadmin_token', accessToken);
    return { accessToken, user };
  }

  async getPlatformOverview(): Promise<any> {
    const res = await this.client.get('/admin/analytics/summary');
    return res.data;
  }

  async getAdminRoster(): Promise<AdminUser[]> {
    const res = await this.client.get('/admin/users', { params: { pageSize: 100 } });
    const list = res.data?.data || res.data || [];
    return list.filter((u: any) => u.isAdmin || u.adminRole || u.activeProfile === 'admin');
  }

  async getAllUsers(persona?: string, status?: string, search?: string): Promise<any[]> {
    const res = await this.client.get('/admin/users', {
      params: { persona, status, search, pageSize: 100 },
    });
    return res.data?.data || res.data || [];
  }

  async updateUserStatus(uid: string, status: string, reason: string): Promise<any> {
    const res = await this.client.put(
      `/admin/users/${uid}/status`,
      { status },
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    try {
      const res = await this.client.get('/admin/audit/logs');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // 1. FARMER OPERATIONS
  // --------------------------------------------------------------------------
  async getFarmerLots(status?: string): Promise<ProduceLot[]> {
    const res = await this.client.get('/admin/lots');
    const lots = res.data?.data || res.data || [];
    if (status && status !== 'all') {
      return lots.filter((l: ProduceLot) => l.status === status);
    }
    return lots;
  }

  async moderateLot(lotId: string, status: string, reason: string): Promise<any> {
    const mappedStatus = status === 'approved' ? 'active' : status === 'rejected' ? 'suspended' : status;
    try {
      const res = await this.client.put(
        `/admin/lots/${lotId}/status`,
        { status: mappedStatus },
        { headers: { 'X-Audit-Reason': reason } }
      );
      return res.data;
    } catch {
      const res = await this.client.post(
        `/admin/market/lots/${lotId}/moderate`,
        { action: status === 'approved' ? 'approve' : 'reject', reason },
        { headers: { 'X-Audit-Reason': reason } }
      );
      return res.data;
    }
  }

  async getMandiRates(): Promise<MandiRate[]> {
    const res = await this.client.get('/admin/mandi/rates');
    return res.data?.data || res.data || [];
  }

  async getPendingMandiRates(): Promise<MandiRate[]> {
    try {
      const res = await this.client.get('/admin/rates/pending');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  async approveMandiRate(rateId: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/rates/${rateId}/approve`,
      {},
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async rejectMandiRate(rateId: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/rates/${rateId}/reject`,
      { reason },
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async getFarmDiaryEntries(): Promise<FarmDiaryEntry[]> {
    const res = await this.client.get('/admin/diary/entries');
    return res.data?.data || res.data || [];
  }

  async getAdvisoryScans(): Promise<AdvisoryScan[]> {
    const res = await this.client.get('/admin/advisory/scans');
    return res.data?.data || res.data || [];
  }

  async getSoilTests(): Promise<SoilTest[]> {
    const res = await this.client.get('/admin/soil-tests');
    return res.data?.data || res.data || [];
  }

  async validateSoilTest(testId: string, payload: any, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/soil-tests/${testId}/results`,
      payload,
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  // --------------------------------------------------------------------------
  // 2. TRANSPORTER OPERATIONS
  // --------------------------------------------------------------------------
  async getVehicles(): Promise<Vehicle[]> {
    const res = await this.client.get('/admin/transport/vehicles');
    return res.data?.data || res.data || [];
  }

  async verifyVehicle(vehicleId: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/transport/vehicles/${vehicleId}/verify`,
      {},
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async getTransportBookings(): Promise<TransportBooking[]> {
    const res = await this.client.get('/admin/transport/bookings');
    return res.data?.data || res.data || [];
  }

  async updateBookingStatus(bookingId: string, status: string, reason: string): Promise<any> {
    const res = await this.client.put(
      `/admin/transport/bookings/${bookingId}/status`,
      { status },
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async suspendTransporter(transporterId: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/transport/transporters/${transporterId}/suspend`,
      { reason },
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async getTransportDrivers(): Promise<any[]> {
    try {
      const res = await this.client.get('/admin/transport/drivers');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  async getTransportPricingRules(): Promise<any> {
    try {
      const res = await this.client.get('/admin/transport/pricing-rules');
      return res.data?.data || res.data || {};
    } catch {
      return {};
    }
  }

  // --------------------------------------------------------------------------
  // 3. VYAPARI OPERATIONS
  // --------------------------------------------------------------------------
  async getBuyers(): Promise<BuyerOrg[]> {
    const res = await this.client.get('/admin/buyers');
    return res.data?.data || res.data || [];
  }

  async verifyBuyer(buyerId: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/buyers/${buyerId}/verify`,
      {},
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async suspendBuyer(buyerId: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/buyers/${buyerId}/suspend`,
      { reason },
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async getB2BDeals(): Promise<B2BDeal[]> {
    const res = await this.client.get('/admin/deals');
    return res.data?.data || res.data || [];
  }

  async escalateDeal(dealId: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/deals/${dealId}/escalate`,
      { reason },
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async getProcurements(): Promise<any[]> {
    try {
      const res = await this.client.get('/admin/procurements');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  async getContracts(): Promise<BuyerContract[]> {
    try {
      const res = await this.client.get('/admin/contracts');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  async updateContractStatus(contractId: string, status: string, reason: string): Promise<any> {
    const res = await this.client.put(
      `/admin/contracts/${contractId}/status`,
      { status },
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  // --------------------------------------------------------------------------
  // 4. MAHILA GRAHA UDYOG OPERATIONS
  // --------------------------------------------------------------------------
  async getShgQueue(): Promise<WomenShg[]> {
    const res = await this.client.get('/admin/women/shgs/queue');
    return res.data?.data || res.data || [];
  }

  async verifyShg(shgId: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/women/shgs/${shgId}/verify`,
      {},
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async getGruhCertificationsQueue(): Promise<GruhCert[]> {
    const res = await this.client.get('/admin/gruh/certifications/queue');
    return res.data?.data || res.data || [];
  }

  async verifyGruhCertification(certId: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/gruh/certifications/${certId}/verify`,
      {},
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async rejectGruhCertification(certId: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/gruh/certifications/${certId}/reject`,
      { reason },
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async getWomenEnterpriseProducts(): Promise<WomenEnterpriseProduct[]> {
    const res = await this.client.get('/admin/women/enterprise-products');
    return res.data?.data || res.data || [];
  }

  async getWomenEnterprises(): Promise<any[]> {
    try {
      const res = await this.client.get('/admin/women/enterprises');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  async getWomenLoans(): Promise<any[]> {
    try {
      const res = await this.client.get('/admin/women/loans');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  async disburseWomenSubsidy(payload: any, reason: string): Promise<any> {
    const res = await this.client.post(
      '/admin/women/subsidies/disburse',
      payload,
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async getWomenImpactReport(): Promise<any> {
    try {
      const res = await this.client.get('/admin/women/impact-report');
      return res.data;
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // 5. NURSERY OPERATIONS
  // --------------------------------------------------------------------------
  async getNurseries(): Promise<TreeNursery[]> {
    const res = await this.client.get('/admin/nurseries');
    return res.data?.data || res.data || [];
  }

  async verifyNursery(nurseryId: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/nurseries/${nurseryId}/verify`,
      {},
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async rejectNursery(nurseryId: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/nurseries/${nurseryId}/reject`,
      { reason },
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async getTreeRequests(): Promise<TreeRequest[]> {
    const res = await this.client.get('/admin/tree/requests');
    return res.data?.data || res.data || [];
  }

  async updateTreeRequestStatus(requestId: string, status: string, reason: string): Promise<any> {
    const res = await this.client.put(
      `/admin/tree/requests/${requestId}/status`,
      { status },
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async getTreeNgos(): Promise<any[]> {
    try {
      const res = await this.client.get('/admin/tree/ngos');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  async getNurseryKpis(): Promise<any> {
    try {
      const res = await this.client.get('/admin/nursery/kpis');
      return res.data;
    } catch {
      return null;
    }
  }

  async moderateNurseryPlant(plantId: string, action: 'approved' | 'rejected' | 'taken_down', reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/plants/${plantId}/moderate`,
      { action, reason },
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  // --------------------------------------------------------------------------
  // 6. EMARKET CUSTOMER OPERATIONS
  // --------------------------------------------------------------------------
  async getMarketplaceOrders(): Promise<MarketplaceOrder[]> {
    const res = await this.client.get('/admin/marketplace/orders');
    return res.data?.data || res.data || [];
  }

  async refundMarketplaceOrder(orderId: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/marketplace/orders/${orderId}/refund`,
      { reason },
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async getMarketplaceProducts(): Promise<MarketplaceProduct[]> {
    const res = await this.client.get('/admin/marketplace/products');
    return res.data?.data || res.data || [];
  }

  async getMarketplaceCategories(): Promise<any[]> {
    try {
      const res = await this.client.get('/admin/marketplace/categories');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  async getAds(): Promise<any[]> {
    try {
      const res = await this.client.get('/admin/ads');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  async approveAd(adId: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/ads/${adId}/approve`,
      {},
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async rejectAd(adId: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/ads/${adId}/reject`,
      { reason },
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  // --------------------------------------------------------------------------
  // 7. FARMER PAGES MANAGEMENT & CONTENT CMS
  // --------------------------------------------------------------------------
  async getNews(): Promise<AgriNewsItem[]> {
    const res = await this.client.get('/admin/content/news');
    return res.data?.data || res.data || [];
  }

  async createNews(payload: Partial<AgriNewsItem>, reason: string): Promise<any> {
    const res = await this.client.post(
      '/admin/content/news',
      payload,
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async updateNews(newsId: string, payload: Partial<AgriNewsItem>, reason: string): Promise<any> {
    const res = await this.client.put(
      `/admin/content/news/${newsId}`,
      payload,
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async deleteNews(newsId: string, reason: string): Promise<any> {
    const res = await this.client.delete(
      `/admin/content/news/${newsId}`,
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async getChannels(): Promise<LiveChannel[]> {
    const res = await this.client.get('/admin/content/channels');
    return res.data?.data || res.data || [];
  }

  async moderateChannel(channelId: string, action: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/content/channels/${channelId}/moderate`,
      { action },
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async getWorkshops(): Promise<WorkshopItem[]> {
    const res = await this.client.get('/admin/content/workshops');
    return res.data?.data || res.data || [];
  }

  async getWorkshopRoster(workshopId: string): Promise<any[]> {
    try {
      const res = await this.client.get(`/admin/workshops/${workshopId}/roster`);
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  async getVideos(): Promise<VideoGuideItem[]> {
    const res = await this.client.get('/admin/content/videos');
    return res.data?.data || res.data || [];
  }

  async getBlogs(): Promise<BlogArticleItem[]> {
    const res = await this.client.get('/admin/content/blogs');
    return res.data?.data || res.data || [];
  }

  async getSchemes(): Promise<GovSchemeItem[]> {
    const res = await this.client.get('/schemes');
    return res.data?.data || res.data || [];
  }

  // --------------------------------------------------------------------------
  // 8. LANDLORD DESK
  // --------------------------------------------------------------------------
  async getLandListings(): Promise<LandListing[]> {
    const res = await this.client.get('/admin/land/listings');
    return res.data?.data || res.data || [];
  }

  async getLandLeases(): Promise<LandLease[]> {
    const res = await this.client.get('/admin/land/leases');
    return res.data?.data || res.data || [];
  }

  async terminateLandLease(leaseId: string, reason: string): Promise<any> {
    const res = await this.client.put(
      `/admin/land/leases/${leaseId}/terminate`,
      { reason },
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  // --------------------------------------------------------------------------
  // 9. EQUIPMENT OWNER / MACHINERY DESK
  // --------------------------------------------------------------------------
  async getEquipment(): Promise<EquipmentItem[]> {
    const res = await this.client.get('/admin/equipment');
    return res.data?.data || res.data || [];
  }

  async getEquipmentBookings(): Promise<EquipmentBooking[]> {
    const res = await this.client.get('/admin/equipment/bookings');
    return res.data?.data || res.data || [];
  }

  async verifyEquipment(equipmentId: string, reason: string): Promise<any> {
    const res = await this.client.put(
      `/admin/equipment/${equipmentId}/verify`,
      { status: 'verified' },
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async escalateEquipmentBooking(bookingId: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/equipment/bookings/${bookingId}/escalate`,
      { reason },
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  // --------------------------------------------------------------------------
  // 10. FPO & COOPERATIVE HUB
  // --------------------------------------------------------------------------
  async getFpos(): Promise<FpoItem[]> {
    const res = await this.client.get('/admin/fpo');
    return res.data?.data || res.data || [];
  }

  async verifyFpo(fpoId: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/fpo/verify/${fpoId}`,
      {},
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async getFpoPools(fpoId: string): Promise<FpoPoolItem[]> {
    try {
      const res = await this.client.get(`/admin/fpos/${fpoId}/pools`);
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  async updateFpoPoolStatus(poolId: string, status: string, reason: string): Promise<any> {
    const res = await this.client.put(
      `/admin/fpo/pools/${poolId}/status`,
      { status },
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  // --------------------------------------------------------------------------
  // 11. LIVESTOCK, VET, GAUSHALA & DAIRY HUB
  // --------------------------------------------------------------------------
  async getLivestockVets(): Promise<LivestockVet[]> {
    const res = await this.client.get('/admin/livestock/vets');
    return res.data?.data || res.data || [];
  }

  async verifyVet(vetId: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/livestock/vets/${vetId}/verify`,
      {},
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async rejectVet(vetId: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/vets/${vetId}/reject`,
      { reason },
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async getGaushalas(): Promise<GaushalaItem[]> {
    const res = await this.client.get('/admin/livestock/gaushalas');
    return res.data?.data || res.data || [];
  }

  async getDairyOrders(): Promise<any[]> {
    try {
      const res = await this.client.get('/admin/livestock/orders');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  async getDairyRateCharts(): Promise<any[]> {
    try {
      const res = await this.client.get('/admin/livestock/dairy/rate-charts');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  async getMilkClients(): Promise<any[]> {
    try {
      const res = await this.client.get('/milk-seller/clients');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  async getMilkDeliveries(): Promise<any[]> {
    try {
      const res = await this.client.get('/milk-seller/deliveries');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  async getMilkBills(): Promise<any[]> {
    try {
      const res = await this.client.get('/milk-seller/bills');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // 12. GURUKUL ACADEMY & TEACHERS DESK
  // --------------------------------------------------------------------------
  async getCourses(): Promise<GurukulCourse[]> {
    const res = await this.client.get('/courses');
    return res.data?.data || res.data || [];
  }

  async getTeachers(): Promise<TeacherProfile[]> {
    const res = await this.client.get('/teachers');
    return res.data?.data || res.data || [];
  }

  // --------------------------------------------------------------------------
  // 13. BANKING & INSURANCE FINANCE DESK
  // --------------------------------------------------------------------------
  async getFinanceLoans(): Promise<FinanceLoan[]> {
    const res = await this.client.get('/admin/finance/loans');
    return res.data?.data || res.data || [];
  }

  async updateLoanStatus(applicationId: string, status: string, note: string, reason: string): Promise<any> {
    const res = await this.client.put(
      `/admin/finance/loans/${applicationId}/status`,
      { status, note },
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async getKccAccounts(): Promise<any[]> {
    try {
      const res = await this.client.get('/admin/finance/kcc');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  async getInsuranceClaims(): Promise<InsuranceClaim[]> {
    const res = await this.client.get('/admin/claims');
    return res.data?.data || res.data || [];
  }

  async advanceClaimStatus(userId: string, claimId: string, payload: any, reason: string): Promise<any> {
    const res = await this.client.put(
      `/admin/claims/${userId}/${claimId}`,
      payload,
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  async getInsuranceRates(): Promise<any[]> {
    try {
      const res = await this.client.get('/admin/insurance/rates');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // 14. COLD STORAGE HUB
  // --------------------------------------------------------------------------
  async getColdStorages(): Promise<ColdStorageFacility[]> {
    const res = await this.client.get('/admin/cold-storage/facilities');
    return res.data?.data || res.data || [];
  }

  async verifyColdStorage(facilityId: string, reason: string): Promise<any> {
    const res = await this.client.post(
      `/admin/cold-storage/facilities/${facilityId}/verify`,
      {},
      { headers: { 'X-Audit-Reason': reason } }
    );
    return res.data;
  }

  // --------------------------------------------------------------------------
  // 15. EXPORTER, DIRECT BUYER & BROKER DESK
  // --------------------------------------------------------------------------
  async getExportRfqs(): Promise<ExportRfq[]> {
    try {
      const res = await this.client.get('/exporter/rfqs/browse');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  async getExportOrders(): Promise<ExportOrder[]> {
    try {
      const res = await this.client.get('/exporter/orders');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  async getExportSuppliers(): Promise<any[]> {
    try {
      const res = await this.client.get('/exporter/suppliers');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  async getDirectBuyerFeed(): Promise<any[]> {
    try {
      const res = await this.client.get('/direct-buyer/feed');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }

  async getBrokerDeals(): Promise<any[]> {
    try {
      const res = await this.client.get('/broker/deals');
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  }
}

export const api = new ApiService();
