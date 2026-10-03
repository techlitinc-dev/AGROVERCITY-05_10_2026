// Livestock & Dairy Ecosystem — गौशाळा, रोपवाटिका, Dr. for गाय & दुग्धजन्य
// पदार्थ (API-wired port: /v1/gaushalas + manure-order, /v1/nurseries,
// /v1/vets + book, /v1/dairy-products + order).

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_exception.dart';
import '../api/livestock_api.dart';
import '../api/vet_api.dart';
import '../models/livestock_models.dart';
import '../models/user_profile_type.dart';
import '../state/app_state.dart';
import 'livestock_dairy_product.dart';
import 'livestock_dairy_widgets.dart';
import 'livestock_dialogs.dart';
import 'livestock_header_widgets.dart';
import 'livestock_vet_nursery_widgets.dart';

class LivestockDairyView extends StatefulWidget {
  final AppState state;
  final LivestockApi? livestockApi;

  const LivestockDairyView({
    super.key,
    required this.state,
    this.livestockApi,
  });

  @override
  State<LivestockDairyView> createState() => _LivestockDairyViewState();
}

class _LivestockDairyViewState extends State<LivestockDairyView> {
  late final LivestockApi _api = widget.livestockApi ?? LivestockApi();
  final VetApi _vetApi = VetApi();

  int _selectedTab = 0; // 0: Gaushala, 1: Nursery, 2: Vet Doctor, 3: Dairy
  List<GaushalaItem> _gaushalas = const [];
  List<PlantNursery> _nurseries = const [];
  List<VetDoctor> _vets = const [];
  List<DairyProductItem> _dairy = const [];
  bool _loading = true;
  bool _emergencyOnly = false;
  bool _claiming = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    List<GaushalaItem> gaushalas = const [];
    List<PlantNursery> nurseries = const [];
    List<DairyProductItem> dairy = const [];
    try {
      gaushalas =
          await _api.listGaushalas(district: widget.state.profile.district);
    } catch (_) {}
    try {
      nurseries = await _api.listNurseries();
    } catch (_) {}
    try {
      dairy = await _api.listDairyProducts();
    } catch (_) {}
    final vets = await _fetchVets();
    if (!mounted) return;
    setState(() {
      _gaushalas = gaushalas;
      _nurseries = nurseries;
      _vets = vets;
      _dairy = dairy;
      _loading = false;
    });
  }

  Future<List<VetDoctor>> _fetchVets() async {
    try {
      return await _api.listVets(emergency: _emergencyOnly);
    } catch (_) {
      return const [];
    }
  }

  Future<void> _toggleEmergency() async {
    setState(() => _emergencyOnly = !_emergencyOnly);
    final vets = await _fetchVets();
    if (!mounted) return;
    setState(() => _vets = vets);
  }

  Future<void> _claimClinic() async {
    setState(() => _claiming = true);
    try {
      await _vetApi.claimVetProfile();
      await widget.state.loadVetProfile();
      if (!mounted) return;
      _snack(widget.state.tr('livestock.claim.success'));
    } on ApiException catch (e) {
      if (!mounted) return;
      _snack(e.message.isNotEmpty ? e.message : e.code);
    } finally {
      if (mounted) setState(() => _claiming = false);
    }
  }

  /// Vet-tab entry: claimed vets open the Vet Workspace; everyone else sees
  /// the "Claim your clinic" flow (POST /livestock/vets/claim).
  Widget _buildVetWorkspaceCard() {
    final state = widget.state;
    if (state.isVet) {
      return InkWell(
        onTap: () => state.navigateTo('vetHome'),
        borderRadius: BorderRadius.circular(16),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF00838F), Color(0xFF006064)],
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              const Icon(Icons.medical_services_rounded,
                  color: Colors.white, size: 22),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      state.tr('livestock.claim.workspaceTitle'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      state.tr('livestock.claim.workspaceSubtitle'),
                      style:
                          const TextStyle(color: Colors.white70, fontSize: 11),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_ios_rounded,
                  color: Colors.white, size: 14),
            ],
          ),
        ),
      );
    }
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF00838F)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFE0F7FA),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.badge_outlined,
                color: Color(0xFF00838F), size: 20),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  state.tr('livestock.claim.title'),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  state.tr('livestock.claim.subtitle'),
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: _claiming ? null : _claimClinic,
            child: _claiming
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(
                    state.tr('livestock.claim.action'),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF00838F),
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  void _snack(String message, {SnackBarAction? action}) {
    if (!mounted) return;
    ScaffoldMessenger.maybeOf(context)
        ?.showSnackBar(SnackBar(content: Text(message), action: action));
  }

  void _call(String phone) {
    if (phone.isEmpty) return;
    unawaited(
        launchUrl(Uri(scheme: 'tel', path: phone)).catchError((_) => false));
  }

  void _openManureDialog(GaushalaItem g) {
    showDialog(
      context: context,
      builder: (ctx) => ManureOrderDialog(
        state: widget.state,
        gaushala: g,
        onSubmit: (product, quantity) => _orderManure(g, product, quantity),
      ),
    );
  }

  Future<void> _orderManure(
      GaushalaItem g, String product, String quantity) async {
    try {
      await _api.orderManure(g.id, product: product, quantity: quantity);
      _snack(widget.state.tr('livestock.orderPlaced'));
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  void _openVetBookingDialog(VetDoctor doc) async {
    List<Animal> animals = const [];
    try {
      animals = await _api.listAnimals();
    } catch (_) {}
    if (!mounted) return;
    showDialog(
      context: context,
      builder: (ctx) => VetBookingDialog(
        state: widget.state,
        doctor: doc,
        animals: animals,
        onSubmit: (body) => _bookVet(doc, body),
      ),
    );
  }

  Future<void> _bookVet(VetDoctor doc, Map<String, dynamic> body) async {
    try {
      final appt = await _vetApi.createAppointment({
        'vetId': doc.id,
        ...body,
      });
      _snack(
        widget.state
            .tr('livestock.bookingConfirmed')
            .replaceAll('{fee}', '${appt.fee}'),
        action: SnackBarAction(
          label: widget.state.tr('myBookings'),
          onPressed: () => widget.state.navigateTo('myBookings'),
        ),
      );
    } on ApiException catch (e) {
      _snack(e.code == 'SLOT_UNAVAILABLE' || e.code == 'TELE_UNAVAILABLE'
          ? widget.state.tr('livestock.slotUnavailable')
          : (e.message.isNotEmpty ? e.message : e.code));
    }
  }

  void _openDairyBuyDialog(DairyProductItem p) {
    showDialog(
      context: context,
      builder: (ctx) => DairyBuyDialog(
        state: widget.state,
        product: p,
        onSubmit: (quantity) => _orderDairy(p, quantity),
      ),
    );
  }

  Future<void> _orderDairy(DairyProductItem p, int quantity) async {
    try {
      final res = await _api.orderDairy(p.id, quantity: quantity);
      final total = (res['total'] as num?)?.toInt() ?? p.price * quantity;
      _snack('${widget.state.tr('livestock.total')}: ₹$total');
    } on ApiException catch (e) {
      _snack(e.code == 'OUT_OF_STOCK'
          ? widget.state.tr('livestock.outOfStock')
          : (e.message.isNotEmpty ? e.message : e.code));
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Hero Livestock Banner
          LivestockHeroBanner(state: widget.state),
          const SizedBox(height: 12),

          // Farmer self-service: my milk slips & payment batches
          InkWell(
            onTap: () => widget.state.navigateTo('milkSlips'),
            borderRadius: BorderRadius.circular(16),
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              margin: const EdgeInsets.only(bottom: 14),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF43A047), Color(0xFF1B5E20)],
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF43A047).withValues(alpha: 0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Row(
                children: [
                  const Icon(Icons.receipt_long_rounded,
                      color: Colors.white, size: 22),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.state.tr('livestock.farmer.entryTitle'),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          widget.state.tr('livestock.farmer.entrySubtitle'),
                          style: const TextStyle(
                              color: Colors.white70, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.arrow_forward_ios_rounded,
                      color: Colors.white, size: 14),
                ],
              ),
            ),
          ),

          // Enterprise Dairy Manager Studio Entry Banner
          InkWell(
            onTap: () =>
                widget.state.switchProfile(UserProfileType.dairyManager),
            borderRadius: BorderRadius.circular(16),
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0288D1), Color(0xFF01579B)],
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF0288D1).withValues(alpha: 0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: const Row(
                children: [
                  Icon(Icons.admin_panel_settings_rounded,
                      color: Colors.white, size: 24),
                  SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'डेअरी, गोशाळा व पशुवैद्यक व्यवस्थापक',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'दूध संकलन, पशू आधार व क्लिनिक व्यवस्थापन डॅशबोर्ड',
                          style: TextStyle(color: Colors.white70, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.arrow_forward_ios_rounded,
                      color: Colors.white, size: 14),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),

          // 2. 4 Sub-Tabs Pill Navigation
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: [
                LivestockTabPill(
                  selected: _selectedTab == 0,
                  label:
                      "🛕 ${widget.state.tr('livestock.tabGaushala')} (${_gaushalas.length})",
                  onTap: () => setState(() => _selectedTab = 0),
                ),
                LivestockTabPill(
                  selected: _selectedTab == 1,
                  label:
                      "🪴 ${widget.state.tr('livestock.tabNursery')} (${_nurseries.length})",
                  onTap: () => setState(() => _selectedTab = 1),
                ),
                LivestockTabPill(
                  selected: _selectedTab == 2,
                  label:
                      "🩺 ${widget.state.tr('livestock.tabVet')} (${_vets.length})",
                  onTap: () => setState(() => _selectedTab = 2),
                ),
                LivestockTabPill(
                  selected: _selectedTab == 3,
                  label:
                      "🥛 ${widget.state.tr('livestock.tabDairy')} (${_dairy.length})",
                  onTap: () => setState(() => _selectedTab = 3),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // 3. Tab Views
          if (_loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 60),
                child: CircularProgressIndicator(color: Color(0xFF78350F)),
              ),
            )
          else ...[
            if (_selectedTab == 0)
              Column(
                children: _gaushalas
                    .map((g) => GaushalaCard(
                          state: widget.state,
                          gaushala: g,
                          onCall: () => _call(g.phone),
                          onOrderManure: () => _openManureDialog(g),
                        ))
                    .toList(),
              ),
            if (_selectedTab == 1)
              Column(
                children: _nurseries
                    .map((n) => NurseryCard(
                          state: widget.state,
                          nursery: n,
                          onCall: () => _call(n.phone),
                        ))
                    .toList(),
              ),
            if (_selectedTab == 2)
              Column(
                children: [
                  _buildVetWorkspaceCard(),
                  EmergencyVetBar(
                    state: widget.state,
                    active: _emergencyOnly,
                    onToggle: _toggleEmergency,
                  ),
                  ..._vets.map((doc) => VetDoctorCard(
                        doctor: doc,
                        onCall: () => _call(doc.phone),
                        onBook: () => _openVetBookingDialog(doc),
                      )),
                ],
              ),
            if (_selectedTab == 3)
              Column(
                children: _dairy
                    .map((p) => DairyProductCard(
                          state: widget.state,
                          product: p,
                          onBuy: () => _openDairyBuyDialog(p),
                        ))
                    .toList(),
              ),
          ],
        ],
      ),
    );
  }
}
