// Cold Storage & Godown Provider Executive Home Dashboard

import 'package:flutter/material.dart';
import '../../api/cold_storage_api.dart';
import '../../models/cold_storage_models.dart';
import '../../models/user_profile_type.dart';
import '../../state/app_state.dart';
import '../cold_storage/cold_storage_dialogs.dart';

class ColdStorageHomeView extends StatefulWidget {
  final AppState state;
  final ColdStorageApi? coldStorageApi;

  const ColdStorageHomeView({
    super.key,
    required this.state,
    this.coldStorageApi,
  });

  @override
  State<ColdStorageHomeView> createState() => _ColdStorageHomeViewState();
}

class _ColdStorageHomeViewState extends State<ColdStorageHomeView>
    with SingleTickerProviderStateMixin {
  late final ColdStorageApi _api = widget.coldStorageApi ?? ColdStorageApi();
  late final TabController _tabController;

  ColdStorageProviderStats? _stats;
  List<ColdStorageBookingRecord> _bookings = [];
  List<Map<String, dynamic>> _facilities = [];
  int _selectedFacilityIndex = 0;
  bool _loading = true;
  String _selectedStatus = 'all';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final stats = await _api.getProviderStats();
      final bookings = await _api.listProviderBookings(status: _selectedStatus);
      final facilities = await _api.listFacilities();
      if (!mounted) return;
      setState(() {
        _stats = stats;
        _bookings = bookings;
        _facilities = facilities;
        if (_selectedFacilityIndex >= facilities.length) {
          _selectedFacilityIndex = (facilities.length - 1).clamp(0, 9999);
        }
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0284C7),
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.warehouse_rounded, color: Colors.white, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    widget.state.profile.name.isNotEmpty
                        ? widget.state.profile.name
                        : 'सह्याद्री कोल्ड चेन व गोदाम',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const Text(
              'WDRA पंजीकृत शीतगृह • नाशिक हब',
              style: TextStyle(color: Colors.white70, fontSize: 11),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Colors.white),
            tooltip: 'ताज़ा करें',
            onPressed: _loadData,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          isScrollable: false,
          labelPadding: EdgeInsets.zero,
          labelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
          tabs: const [
            Tab(text: 'आरक्षण'),
            Tab(text: 'आवक व लॉट'),
            Tab(text: 'निकासी'),
            Tab(text: 'कक्ष क्षमता'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF0284C7)))
          : Column(
              children: [
                _buildKpiMetricsStrip(),
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildBookingsQueueTab(),
                      _buildInwardLotsTab(),
                      _buildOutwardDispatchTab(),
                      _buildChambersCapacityTab(),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildKpiMetricsStrip() {
    final stats = _stats ??
        const ColdStorageProviderStats(
          totalCapacityMT: 50.0,
          occupiedMT: 15.0,
          availableMT: 35.0,
          occupancyPercent: 30.0,
          pendingBookingsCount: 3,
          activeStoredLotsCount: 8,
          totalFarmersCount: 14,
          totalAccruedRent: 24000.0,
          totalValuationStored: 450000.0,
        );

    final String occStr = stats.occupancyPercent.truncateToDouble() == stats.occupancyPercent
        ? '${stats.occupancyPercent.toInt()}%'
        : '${stats.occupancyPercent.toStringAsFixed(1)}%';

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          _kpiPill('कुल क्षमता', '${stats.totalCapacityMT.toInt()} MT', Icons.storage_rounded, const Color(0xFF0284C7)),
          const SizedBox(width: 8),
          _kpiPill('उपयोग दर', occStr, Icons.pie_chart_rounded, const Color(0xFF059669)),
          const SizedBox(width: 8),
          _kpiPill('लंबित आवेदन', '${stats.pendingBookingsCount}', Icons.hourglass_top_rounded, const Color(0xFFD97706)),
          const SizedBox(width: 8),
          _kpiPill('सक्रिय लॉट', '${stats.activeStoredLotsCount}', Icons.inventory_2_rounded, const Color(0xFF7C3AED)),
        ],
      ),
    );
  }

  Widget _kpiPill(String title, String val, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withOpacity(0.25)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 14, color: color),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    title,
                    style: TextStyle(fontSize: 10, color: Colors.grey.shade700, fontWeight: FontWeight.w600),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              val,
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: color),
            ),
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // Tab 1: Bookings Queue
  // ===========================================================================

  Widget _buildBookingsQueueTab() {
    final pendingList = _bookings.where((b) => b.isPending).toList();

    return RefreshIndicator(
      onRefresh: _loadData,
      child: pendingList.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.done_all_rounded, size: 48, color: Colors.grey.shade400),
                  const SizedBox(height: 8),
                  const Text('कोई नया आरक्षण अनुरोध लंबित नहीं है।',
                      style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w600)),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(14),
              itemCount: pendingList.length,
              itemBuilder: (ctx, idx) => _buildBookingCard(pendingList[idx]),
            ),
    );
  }

  Widget _buildBookingCard(ColdStorageBookingRecord booking) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    '${booking.cropName} ${booking.variety != null ? "(${booking.variety})" : ""}',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'लंबित (Pending)',
                    style: TextStyle(color: Color(0xFFB45309), fontSize: 11, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'किसान: ${booking.farmerName} • संपर्क: ${booking.farmerPhone}',
              style: const TextStyle(color: Colors.grey, fontSize: 12),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _chip('मात्रा: ${booking.quantityQuintals} क्विंटल'),
                const SizedBox(width: 8),
                _chip('अवधि: ${booking.months} माह'),
                const SizedBox(width: 8),
                _chip('पैकेजिंग: ${booking.packagingType}'),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'अनुमानित कुल भाड़ा: ₹${booking.totalEstimatedRent.toStringAsFixed(0)} (आरंभ तिथि: ${booking.fromDate})',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0284C7)),
            ),
            const Divider(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                OutlinedButton(
                  onPressed: () async {
                    final res = await showRejectBookingDialog(context, booking, _api);
                    if (res == true) _loadData();
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.red.shade700,
                    side: BorderSide(color: Colors.red.shade400),
                  ),
                  child: const Text('अस्वीकृत करें'),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: () async {
                    final res = await showApproveBookingDialog(context, booking, _api);
                    if (res == true) _loadData();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0284C7),
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('स्वीकृत करें'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // Tab 2: Inward & Lots
  // ===========================================================================

  Widget _buildInwardLotsTab() {
    final activeLots = _bookings.where((b) => b.isApproved || b.isInwarded).toList();

    return RefreshIndicator(
      onRefresh: _loadData,
      child: activeLots.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.inventory_2_outlined, size: 48, color: Colors.grey.shade400),
                  const SizedBox(height: 8),
                  const Text('कोई सक्रिय लॉट या स्वीकृत आरक्षण उपलब्ध नहीं।',
                      style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w600)),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(14),
              itemCount: activeLots.length,
              itemBuilder: (ctx, idx) => _buildInwardCard(activeLots[idx]),
            ),
    );
  }

  Widget _buildInwardCard(ColdStorageBookingRecord booking) {
    final bool inwarded = booking.isInwarded;

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    '${booking.cropName} • ${booking.farmerName}',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: inwarded ? const Color(0xFFDCFCE7) : const Color(0xFFE0F2FE),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    inwarded ? 'आवक दर्ज (Inwarded)' : 'स्वीकृत (Approved)',
                    style: TextStyle(
                      color: inwarded ? const Color(0xFF166534) : const Color(0xFF0369A1),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            if (inwarded) ...[
              Text(
                'लॉट संख्या: ${booking.lotNumber ?? "LOT-N/A"} • कक्ष: ${booking.allocatedChamberName ?? "Chamber A"}',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFF0284C7)),
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  _chip('शुद्ध साठा: ${booking.inwardNetQuintals ?? booking.quantityQuintals} Q'),
                  const SizedBox(width: 8),
                  _chip('ग्रेड: ${booking.qcGrade ?? "Grade A"}'),
                  const SizedBox(width: 8),
                  if (booking.moisturePercent != null)
                    _chip('नमी: ${booking.moisturePercent}%'),
                ],
              ),
              const SizedBox(height: 8),
              if (booking.receiptNumber != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.verified_rounded, size: 16, color: Color(0xFF0F766E)),
                      const SizedBox(width: 6),
                      Text(
                        'e-NWR: ${booking.receiptNumber}',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                      ),
                      const Spacer(),
                      TextButton(
                        onPressed: () {
                          showWarehouseReceiptDialog(
                            context,
                            WarehouseReceiptRecord(
                              receiptNumber: booking.receiptNumber!,
                              bookingId: booking.id,
                              facilityId: booking.facilityId,
                              facilityName: booking.facilityName,
                              depositorName: booking.farmerName,
                              depositorPhone: booking.farmerPhone,
                              cropName: booking.cropName,
                              variety: booking.variety,
                              netQuintals: booking.inwardNetQuintals ?? booking.quantityQuintals,
                              bagsCount: booking.inwardBags ?? booking.bagsCount,
                              qcGrade: booking.qcGrade ?? 'Grade A',
                              moisturePercent: booking.moisturePercent,
                              chamberName: booking.allocatedChamberName ?? 'Chamber A',
                              lotNumber: booking.lotNumber ?? 'LOT-01',
                              valuationRupees: booking.valuationRupees ?? (booking.quantityQuintals * 2200),
                              issueDate: booking.inwardDate ?? booking.bookedAt,
                            ),
                          );
                        },
                        child: const Text('रसीद देखें', style: TextStyle(fontSize: 11)),
                      ),
                    ],
                  ),
                ),
            ] else ...[
              Text(
                'आरक्षित मात्रा: ${booking.quantityQuintals} क्विंटल • कक्ष: ${booking.allocatedChamberName ?? "Chamber A"}',
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerRight,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    final res = await showGateInwardDialog(context, booking, _api);
                    if (res == true) _loadData();
                  },
                  icon: const Icon(Icons.input_rounded, size: 16),
                  label: const Text('गेट आवक दर्ज करें'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F766E),
                    foregroundColor: Colors.white,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // Tab 3: Outward & Dispatch
  // ===========================================================================

  Widget _buildOutwardDispatchTab() {
    final releaseCandidates = _bookings
        .where((b) => b.isInwarded || b.isReleaseRequested || b.status == 'partially_released' || b.isReleased)
        .toList();

    return RefreshIndicator(
      onRefresh: _loadData,
      child: releaseCandidates.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.local_shipping_outlined, size: 48, color: Colors.grey.shade400),
                  const SizedBox(height: 8),
                  const Text('कोई निकासी अनुरोध या सक्रिय साठा नहीं है।',
                      style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w600)),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(14),
              itemCount: releaseCandidates.length,
              itemBuilder: (ctx, idx) => _buildReleaseCard(releaseCandidates[idx]),
            ),
    );
  }

  Widget _buildReleaseCard(ColdStorageBookingRecord booking) {
    final double remaining = booking.remainingQuintals ??
        booking.inwardNetQuintals ??
        booking.quantityQuintals;
    final bool released = booking.isReleased;

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    '${booking.cropName} (${booking.farmerName})',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: released ? Colors.grey.shade200 : const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    released
                        ? 'पूर्णतः निर्गत (Released)'
                        : (booking.isReleaseRequested ? 'निकासी अनुरोधित' : 'साठा सक्रिय'),
                    style: TextStyle(
                      color: released ? Colors.grey.shade700 : const Color(0xFFB45309),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'लॉट: ${booking.lotNumber ?? "LOT-N/A"} • शेष साठा: $remaining क्विंटल (निकासी: ${booking.outwardReleasedQuintals} Q)',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
            ),
            if (booking.gatePassNumber != null) ...[
              const SizedBox(height: 4),
              Text(
                'गेट पास क्रमांक: ${booking.gatePassNumber} • भाड़ा भुगतान: ${booking.paymentStatus}',
                style: const TextStyle(fontSize: 11, color: Color(0xFF059669), fontWeight: FontWeight.w700),
              ),
            ],
            if (!released) ...[
              const Divider(height: 18),
              Align(
                alignment: Alignment.centerRight,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    final res = await showGateReleaseDialog(context, booking, _api);
                    if (res == true) _loadData();
                  },
                  icon: const Icon(Icons.local_shipping_rounded, size: 16),
                  label: const Text('गेट पास जारी करें'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0284C7),
                    foregroundColor: Colors.white,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // Tab 4: Chambers & Capacity
  // ===========================================================================

  Widget _buildChambersCapacityTab() {
    final facility = _facilities.isNotEmpty && _selectedFacilityIndex < _facilities.length
        ? _facilities[_selectedFacilityIndex]
        : (_facilities.isNotEmpty
            ? _facilities.first
            : {
                'id': 'cs-1',
                'name': 'Sahyadri Cold Chain & Agri Logistics',
                'availableMT': 50.0,
                'totalCapacityMT': 50.0,
                'ratePerQuintalMonth': 12.0,
                'chambers': [
                  {'name': 'कक्ष A (आलू / सेब)', 'capacityMT': 25.0, 'currentOccupancyMT': 10.0, 'tempRange': '2-4°C'},
                  {'name': 'कक्ष B (प्याज / लहसुन)', 'capacityMT': 25.0, 'currentOccupancyMT': 5.0, 'tempRange': '10-14°C'},
                ],
              });

    final chambers = (facility['chambers'] as List?) ?? [];
    final String facilityType = facility['facilityType'] as String? ?? 'cold_storage';
    final String typeLabel = facilityType == 'cold_storage'
        ? 'शीतगृह (Cold Storage)'
        : (facilityType == 'dry_godown' || facilityType == 'godown'
            ? 'सूखा गोदाम (Dry Godown)'
            : 'अनाज साइलो (Grain Silo)');

    final double totalCap = (facility['totalCapacityMT'] as num?)?.toDouble() ??
        (facility['availableMT'] as num?)?.toDouble() ??
        50.0;
    final double availCap = (facility['availableMT'] as num?)?.toDouble() ?? 50.0;
    final double rate = (facility['ratePerQuintalMonth'] as num?)?.toDouble() ?? 12.0;

    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        // Action Bar: Title & Add Godown/Chamber Buttons
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                facility['name'] as String? ?? 'शीतगृह परिसर',
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Color(0xFF0284C7)),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                OutlinedButton.icon(
                  onPressed: () async {
                    final facId = facility['id'] as String? ?? 'cs-1';
                    final added = await showAddChamberDialog(context, facId, _api);
                    if (added == true) _loadData();
                  },
                  icon: const Icon(Icons.add_rounded, size: 14),
                  label: const Text('कक्ष जोड़ें'),
                  style: OutlinedButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    foregroundColor: const Color(0xFF0284C7),
                    side: const BorderSide(color: Color(0xFF0284C7)),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                  ),
                ),
                const SizedBox(width: 6),
                ElevatedButton.icon(
                  onPressed: () async {
                    final created = await showCreateFacilityDialog(context, _api);
                    if (created == true) {
                      await _loadData();
                      if (mounted && _facilities.isNotEmpty) {
                        setState(() {
                          _selectedFacilityIndex = _facilities.length - 1;
                        });
                      }
                    }
                  },
                  icon: const Icon(Icons.add_business_rounded, size: 14),
                  label: const Text('नया गोदाम'),
                  style: ElevatedButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    backgroundColor: const Color(0xFF0284C7),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 6),

        // Multiple facilities switcher if more than 1 facility
        if (_facilities.length > 1) ...[
          SizedBox(
            height: 34,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: _facilities.length,
              itemBuilder: (ctx, idx) {
                final f = _facilities[idx];
                final bool isSelected = idx == _selectedFacilityIndex;
                final fName = f['name'] as String? ?? 'गोदाम ${idx + 1}';
                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
                    label: Text(fName),
                    selected: isSelected,
                    selectedColor: const Color(0xFF0284C7),
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : Colors.black87,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                      fontSize: 11,
                    ),
                    onSelected: (val) {
                      if (val) setState(() => _selectedFacilityIndex = idx);
                    },
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 6),
        ],

        // Facility Details Card
        Card(
          elevation: 1,
          margin: const EdgeInsets.only(bottom: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '${facility['wdraRegNo'] ?? 'WDRA/MH/NSK/2026/044'} • ${facility['district'] ?? 'नाशिक'}',
                      style: const TextStyle(color: Colors.grey, fontSize: 11),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE0F2FE),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        typeLabel,
                        style: const TextStyle(color: Color(0xFF0369A1), fontSize: 10, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(child: _metricColumn('कुल क्षमता', '${totalCap.toStringAsFixed(1)} MT')),
                    Expanded(child: _metricColumn('उपलब्ध साठा', '${availCap.toStringAsFixed(1)} MT')),
                    Expanded(child: _metricColumn('मासिक दर', '₹${rate.toInt()}/Q')),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        const Text(
          'कक्ष आवंटन व वास्तविक स्थिति',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
        ),
        const SizedBox(height: 8),

        if (chambers.isEmpty)
          Card(
            elevation: 1,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Center(
                child: Column(
                  children: [
                    Icon(Icons.door_sliding_outlined, size: 40, color: Colors.grey.shade400),
                    const SizedBox(height: 8),
                    const Text('इस गोदाम में अभी कोई कक्ष नहीं है।',
                        style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    const Text("ऊपर 'कक्ष जोड़ें' बटन दबाकर नया कक्ष बनाएं।",
                        style: TextStyle(color: Colors.grey, fontSize: 12)),
                  ],
                ),
              ),
            ),
          )
        else
          ...chambers.map((c) {
            final cMap = (c as Map).cast<String, dynamic>();
            final double cap = (cMap['capacityMT'] as num?)?.toDouble() ?? 25.0;
            final double occ = (cMap['currentOccupancyMT'] as num?)?.toDouble() ?? 0.0;
            final double pct = cap > 0 ? (occ / cap).clamp(0.0, 1.0) : 0.0;

            return Card(
              elevation: 1,
              margin: const EdgeInsets.only(bottom: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          cMap['name'] as String? ?? 'कक्ष',
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                        ),
                        Text(
                          cMap['tempRange'] as String? ?? '2-8°C',
                          style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF0284C7), fontSize: 12),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    LinearProgressIndicator(
                      value: pct,
                      backgroundColor: Colors.grey.shade200,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        pct > 0.8 ? Colors.red : (pct > 0.5 ? Colors.amber : const Color(0xFF059669)),
                      ),
                      minHeight: 8,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('उपयोग: ${occ.toStringAsFixed(1)} MT / ${cap.toStringAsFixed(1)} MT',
                            style: const TextStyle(fontSize: 12, color: Colors.grey)),
                        Text('${(pct * 100).toInt()}% आरक्षित',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ],
                ),
              ),
            );
          }),
      ],
    );
  }

  Widget _metricColumn(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 11)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Colors.black87)),
      ],
    );
  }

  Widget _chip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Text(label, style: const TextStyle(fontSize: 11, color: Colors.black87)),
    );
  }
}
