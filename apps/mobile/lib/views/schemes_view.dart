// Module M: Government Scheme Intelligence (API-wired port) + document vault
// sheet + Soil Health Card soil-test booking entry point (F9).

import 'package:flutter/material.dart';

import '../api/api_exception.dart';
import '../api/land_api.dart';
import '../api/schemes_api.dart';
import '../api/soil_tests_api.dart';
import '../api/vault_api.dart';
import '../components/common/motion_animations.dart';
import '../components/soil_test_booking_sheet.dart';
import '../models/govt_scheme.dart';
import '../state/app_state.dart';
import 'schemes_card.dart';
import 'schemes_sheets.dart';
import 'schemes_vault_sheet.dart';

class SchemesView extends StatefulWidget {
  final AppState state;
  final SchemesApi? schemesApi;
  final VaultApi? vaultApi;
  final SoilTestsApi? soilTestsApi;
  final LandApi? landApi;

  const SchemesView({
    super.key,
    required this.state,
    this.schemesApi,
    this.vaultApi,
    this.soilTestsApi,
    this.landApi,
  });

  @override
  State<SchemesView> createState() => _SchemesViewState();
}

class _SchemesViewState extends State<SchemesView> {
  late final SchemesApi _api = widget.schemesApi ?? SchemesApi();
  late final VaultApi _vaultApi = widget.vaultApi ?? VaultApi();
  late final SoilTestsApi _soilApi = widget.soilTestsApi ?? SoilTestsApi();

  List<GovtScheme> _schemes = const [];
  List<PortalEntry> _portals = const [];
  List<Map<String, dynamic>> _soilBookings = const [];
  String? _category;
  bool _eligibleOnly = false;
  bool _loading = true;
  bool _error = false;

  static const Map<String, String> _categoryTrKeys = {
    'income-support': 'schemes.category.incomeSupport',
    'insurance': 'schemes.category.insurance',
    'soil': 'schemes.category.soil',
    'solar': 'schemes.category.solar',
    'market': 'schemes.category.market',
    'irrigation': 'schemes.category.irrigation',
  };

  static const Map<String, String> _soilStatusTrKeys = {
    'booked': 'schemes.soilStatus.booked',
    'sampleCollected': 'schemes.soilStatus.sampleCollected',
    'reportReady': 'schemes.soilStatus.reportReady',
  };

  String _categoryLabel(String? key) {
    if (key == null) return widget.state.tr('schemes.category.all');
    final trKey = _categoryTrKeys[key];
    return trKey != null ? widget.state.tr(trKey) : key;
  }

  @override
  void initState() {
    super.initState();
    _load();
    _loadSoilBookings();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final schemes = await _api.listSchemes(
        category: _category,
        eligibleOnly: _eligibleOnly,
      );
      if (!mounted) return;
      setState(() {
        _schemes = schemes;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _schemes = const [];
        _loading = false;
        _error = true;
      });
    }
  }

  Future<void> _loadSoilBookings() async {
    try {
      final bookings = await _soilApi.listSoilTests();
      if (!mounted) return;
      setState(() => _soilBookings = bookings);
    } catch (_) {}
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _apply(GovtScheme scheme) async {
    final docIds =
        await showSchemeApplySheet(context, _vaultApi, scheme, state: widget.state);
    if (docIds == null || !mounted) return;
    try {
      await _api.applyScheme(scheme.id, docIds);
      _snack(widget.state.tr('schemes.applySubmitted'));
    } on ApiException catch (e) {
      if (e.code == 'ALREADY_APPLIED') {
        _snack(widget.state.tr('schemes.alreadyApplied'));
      } else if (e.code == 'NOT_ELIGIBLE') {
        _snack(widget.state.tr('schemes.notEligible'));
      } else {
        _snack(e.message.isNotEmpty
            ? e.message
            : widget.state.tr('schemes.applyFailed'));
      }
    }
  }

  Future<void> _openPortal(GovtScheme scheme) async {
    try {
      if (_portals.isEmpty) _portals = await _api.getPortals();
    } catch (_) {}
    if (!mounted) return;
    final url = _portals
            .where((p) => p.schemeId == scheme.id)
            .map((p) => p.portalUrl)
            .firstOrNull ??
        'https://pmkisan.gov.in';
    showSchemePortalSheet(context, scheme, url, state: widget.state);
  }

  Future<void> _openSoilBooking() async {
    await showSoilTestBookingSheet(
      context,
      state: widget.state,
      soilTestsApi: _soilApi,
      landApi: widget.landApi,
    );
    _loadSoilBookings();
  }

  String? get _activeSoilStatus {
    for (final b in _soilBookings) {
      final status = b['status'] as String?;
      if (status != null && status != 'reportReady') {
        final trKey = _soilStatusTrKeys[status];
        return trKey != null ? widget.state.tr(trKey) : status;
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF43A047)),
      );
    }
    if (_error) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(widget.state.tr('schemes.loadFailed'),
                style: const TextStyle(fontSize: 13, color: Colors.grey)),
            const SizedBox(height: 10),
            ElevatedButton(
              onPressed: _load,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1B4332),
                foregroundColor: Colors.white,
              ),
              child: Text(widget.state.tr('retry')),
            ),
          ],
        ),
      );
    }
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 140),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SchemesHeader(
              state: widget.state,
              onOpenVault: () =>
                  showVaultSheet(context, _vaultApi, state: widget.state)),
          const SizedBox(height: 12),
          SizedBox(
            height: 38,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _categoryPill(null, _categoryLabel(null)),
                ..._categoryTrKeys.entries
                    .map((e) => _categoryPill(e.key, widget.state.tr(e.value))),
              ],
            ),
          ),
          const SizedBox(height: 8),
          FilterChip(
            label: Text(widget.state.tr('schemes.eligibleOnly'),
                style:
                    const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            selected: _eligibleOnly,
            selectedColor: const Color(0xFFE8F5E9),
            onSelected: (v) {
              setState(() => _eligibleOnly = v);
              _load();
            },
          ),
          const SizedBox(height: 10),
          if (_schemes.isEmpty)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: Text(widget.state.tr('schemes.noSchemesFound'),
                    style: const TextStyle(fontSize: 13, color: Colors.grey)),
              ),
            )
          else
            ...List.generate(_schemes.length, (index) {
              final s = _schemes[index];
              return StaggeredSlideFade(
                delayMs: 100 + (index * 70),
                child: SchemeCard(
                  state: widget.state,
                  scheme: s,
                  categoryLabel: _categoryLabel(s.category),
                  soilBookingStatus:
                      s.category == 'soil' ? _activeSoilStatus : null,
                  onApply: () => _apply(s),
                  onPortal: () => _openPortal(s),
                  onBookSoilTest: _openSoilBooking,
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _categoryPill(String? key, String label) {
    final isSel = _category == key;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: GestureDetector(
        onTap: () {
          setState(() => _category = key);
          _load();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: isSel ? const Color(0xFF43A047) : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
                color: isSel ? const Color(0xFF43A047) : Colors.grey.shade300),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
              color: isSel ? Colors.white : const Color(0xFF374151),
            ),
          ),
        ),
      ),
    );
  }
}
