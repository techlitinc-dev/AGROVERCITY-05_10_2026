import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../api/api_exception.dart';
import '../../api/transport_api.dart';
import '../../state/app_state.dart';
import '../profile_home/transport_home_widgets.dart';

class LoadBoardView extends StatefulWidget {
  final AppState state;
  final TransportApi? transportApi;

  const LoadBoardView({
    super.key,
    required this.state,
    this.transportApi,
  });

  @override
  State<LoadBoardView> createState() => _LoadBoardViewState();
}

class _LoadBoardViewState extends State<LoadBoardView> {
  late final TransportApi _api = widget.transportApi ?? TransportApi();

  bool _loading = true;
  List<Map<String, dynamic>> _loads = [];
  List<Map<String, dynamic>> _myVehicles = [];
  String _selectedCropFilter = 'सभी';
  final _searchCtrl = TextEditingController();

  static const _filterOptions = ['सभी', 'टमाटर', 'प्याज', 'फल', 'सब्जियां'];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final res = await _api.getOpenLoads();
      final vehRes = await _api.getMyVehicles();
      if (!mounted) return;
      setState(() {
        _loads = (res['data'] as List).cast<Map<String, dynamic>>();
        _myVehicles = (vehRes['data'] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openBidSheet(Map<String, dynamic> load) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => _PlaceBidSheet(
        state: widget.state,
        load: load,
        vehicles: _myVehicles,
        api: _api,
        onBidPlaced: () {
          widget.state.showToast("आपकी बोली सफलतापूर्वक सबमिट हो गई! ✅");
          _loadData();
        },
      ),
    );
  }

  List<Map<String, dynamic>> get _filteredLoads {
    var list = _loads;
    if (_selectedCropFilter != 'सभी') {
      list = list
          .where((l) =>
              "${l['crop']}".toLowerCase().contains(_selectedCropFilter.toLowerCase()))
          .toList();
    }
    final q = _searchCtrl.text.trim().toLowerCase();
    if (q.isNotEmpty) {
      list = list.where((l) {
        final pickup = "${l['pickupLocation']}".toLowerCase();
        final drop = "${l['dropLocation']}".toLowerCase();
        final crop = "${l['crop']}".toLowerCase();
        return pickup.contains(q) || drop.contains(q) || crop.contains(q);
      }).toList();
    }
    return list;
  }

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF0284C7);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF1E293B)),
          onPressed: widget.state.navigateBack,
        ),
        title: const Text(
          "लोड बाज़ार (Agri Load Board)",
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w900,
            color: Color(0xFF1E293B),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: primaryColor),
            onPressed: _loadData,
          ),
        ],
      ),
      body: RefreshIndicator(
        color: primaryColor,
        onRefresh: _loadData,
        child: ListView(
          physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          children: [
            // Search Bar
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: TextField(
                controller: _searchCtrl,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  hintText: "खेत, मंडी या फसल से खोजें...",
                  hintStyle: TextStyle(fontSize: 13, color: Colors.grey.shade400),
                  prefixIcon:
                      const Icon(Icons.search_rounded, color: Color(0xFF64748B)),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
            const SizedBox(height: 10),

            // Crop Filter Chips
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: _filterOptions.map((crop) {
                  final active = _selectedCropFilter == crop;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(crop,
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: active ? Colors.white : const Color(0xFF1E293B))),
                      selected: active,
                      selectedColor: primaryColor,
                      backgroundColor: Colors.white,
                      onSelected: (_) =>
                          setState(() => _selectedCropFilter = crop),
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 14),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  "उपलब्ध लोड (${_filteredLoads.length}):",
                  style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF1E293B)),
                ),
                Text(
                  "लाइव स्पॉट रेट्स",
                  style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: Colors.green.shade700),
                ),
              ],
            ),
            const SizedBox(height: 10),

            if (_loading)
              const Center(
                  child: Padding(
                padding: EdgeInsets.only(top: 40),
                child: CircularProgressIndicator(color: primaryColor),
              ))
            else if (_filteredLoads.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 60),
                child: Center(
                  child: Column(
                    children: [
                      Icon(Icons.inventory_2_outlined,
                          size: 48, color: Colors.grey.shade400),
                      const SizedBox(height: 10),
                      Text("कोई लोड उपलब्ध नहीं है",
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: Colors.grey.shade600)),
                    ],
                  ),
                ),
              )
            else
              ..._filteredLoads.map(_buildLoadCard),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadCard(Map<String, dynamic> load) {
    final targetFare = (load['targetFare'] as num?) ?? 0;
    final qty = (load['quantityQuintals'] as num?) ?? 0;
    final bidsCount = (load['bidsCount'] as num?)?.toInt() ?? 0;
    final isPerishable = load['perishable'] == true;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Crop & Budget
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    Flexible(
                      child: Container(
                        padding:
                            const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE0F2FE),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          "${load['crop']}",
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0369A1),
                          ),
                        ),
                      ),
                    ),
                    if (isPerishable) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.ac_unit_rounded,
                                size: 11, color: Color(0xFFDC2626)),
                            SizedBox(width: 2),
                            Text(
                              "पेरिशेबल",
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFFDC2626),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                "₹${NumberFormat.decimalPattern('en_IN').format(targetFare)}",
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF16A34A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Route
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.location_on_rounded,
                  color: Color(0xFF0284C7), size: 18),
              const SizedBox(width: 6),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "${load['pickupLocation']} ➔ ${load['dropLocation']}",
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF1E293B),
                      ),
                    ),
                    Text(
                      "मात्रा: $qty क्विंटल • ${load['packaging'] ?? 'बोरी'} • ${load['preferredVehicleType'] ?? 'Tata Ace'}",
                      style: TextStyle(
                          fontSize: 11.5, color: Colors.grey.shade600),
                    ),
                  ],
                ),
              ),
            ],
          ),

          if (load['notes'] != null && "${load['notes']}".isNotEmpty) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                "नोट: ${load['notes']}",
                style: const TextStyle(fontSize: 11.5, color: Color(0xFF475569)),
              ),
            ),
          ],
          const SizedBox(height: 12),

          // Footer & Action
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    const Icon(Icons.gavel_rounded,
                        size: 15, color: Color(0xFF64748B)),
                    const SizedBox(width: 4),
                    Text(
                      "$bidsCount बोलियां दर्ज",
                      style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF64748B)),
                    ),
                    const SizedBox(width: 8),
                    Text("• ${load['pickupDate']}",
                        style:
                            TextStyle(fontSize: 11.5, color: Colors.grey.shade500)),
                  ],
                ),
              ),
              ElevatedButton.icon(
                onPressed: () => _openBidSheet(load),
                icon: const Icon(Icons.handshake_rounded, size: 16),
                label: const Text("बोली लगाएं",
                    style:
                        TextStyle(fontSize: 12.5, fontWeight: FontWeight.w900)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0284C7),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PlaceBidSheet extends StatefulWidget {
  final AppState state;
  final Map<String, dynamic> load;
  final List<Map<String, dynamic>> vehicles;
  final TransportApi api;
  final VoidCallback onBidPlaced;

  const _PlaceBidSheet({
    required this.state,
    required this.load,
    required this.vehicles,
    required this.api,
    required this.onBidPlaced,
  });

  @override
  State<_PlaceBidSheet> createState() => _PlaceBidSheetState();
}

class _PlaceBidSheetState extends State<_PlaceBidSheet> {
  final _fareCtrl = TextEditingController();
  final _timeCtrl = TextEditingController(text: "सुबह 06:00 बजे");
  final _notesCtrl = TextEditingController();
  String? _selectedVehicleId;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    final targetFare = widget.load['targetFare'];
    if (targetFare != null) {
      _fareCtrl.text = "$targetFare";
    }
    if (widget.vehicles.isNotEmpty) {
      _selectedVehicleId = "${widget.vehicles.first['id']}";
    }
  }

  @override
  void dispose() {
    _fareCtrl.dispose();
    _timeCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitBid() async {
    final fare = double.tryParse(_fareCtrl.text.trim());
    if (fare == null || fare <= 0) {
      widget.state.showToast("कृपया उचित भाड़ा दर्ज करें");
      return;
    }
    setState(() => _submitting = true);

    final veh = widget.vehicles.firstWhere(
      (v) => "${v['id']}" == _selectedVehicleId,
      orElse: () => const {},
    );

    try {
      await widget.api.submitLoadBid(
        "${widget.load['id']}",
        quotedFare: fare,
        vehicleId: _selectedVehicleId,
        vehicleNo: veh['registrationNo'] as String?,
        estimatedPickupTime: _timeCtrl.text.trim(),
        notes: _notesCtrl.text.trim(),
      );
      if (mounted) {
        Navigator.pop(context);
        widget.onBidPlaced();
      }
    } on ApiException catch (e) {
      if (mounted) {
        widget.state.showToast(e.message.isNotEmpty ? e.message : e.code);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 18,
        right: 18,
        top: 18,
        bottom: MediaQuery.of(context).viewInsets.bottom + 18,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Expanded(
                child: Text(
                  "भाड़ा बोली सबमिट करें (Place Quote)",
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            "${widget.load['crop']} (${widget.load['quantityQuintals']} क्विंटल) — ${widget.load['pickupLocation']} ➔ ${widget.load['dropLocation']}",
            style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 14),

          // Vehicle Dropdown
          if (widget.vehicles.isNotEmpty)
            DropdownButtonFormField<String>(
              initialValue: _selectedVehicleId,
              decoration: const InputDecoration(
                labelText: "गाड़ी चुनें (Assign Vehicle)",
                border: OutlineInputBorder(),
              ),
              items: widget.vehicles
                  .map(
                    (v) => DropdownMenuItem(
                      value: "${v['id']}",
                      child: Text(
                        "${v['registrationNo']} (${v['vehicleType']})",
                        style: const TextStyle(fontSize: 13),
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (v) => setState(() => _selectedVehicleId = v),
            ),
          const SizedBox(height: 12),

          // Quoted Fare Input
          TextField(
            controller: _fareCtrl,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: "आपकी भाड़ा बोली (Quoted Fare ₹)",
              hintText: "उदा. 35000",
              helperText:
                  "किसान का बजट: ₹${NumberFormat.decimalPattern('en_IN').format(widget.load['targetFare'] ?? 0)}",
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _timeCtrl,
                  decoration: const InputDecoration(
                    labelText: "पिकअप समय",
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _notesCtrl,
                  decoration: const InputDecoration(
                    labelText: "शर्तें/नोट्स (वैकल्पिक)",
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          ElevatedButton(
            onPressed: _submitting ? null : _submitBid,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 50),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
            ),
            child: Text(
              _submitting ? "बोली भेजी जा रही है..." : "बोली भेजें (Submit Quote)",
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
    );
  }
}
