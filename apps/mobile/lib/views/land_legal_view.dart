// Module K: Land & Legal Toolkit (API-wired port) — 7/12 / 8A record search
// via /v1/land-records + land-for-rent browse tab (L2, day-09).

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_exception.dart';
import '../api/land_market_api.dart';
import '../api/land_records_api.dart';
import '../models/land_record.dart';
import '../state/app_state.dart';
import 'land_legal_widgets.dart';
import 'land_rental_browse_section.dart';

class LandLegalView extends StatefulWidget {
  final AppState state;
  final LandMarketApi? landMarketApi;
  final LandRecordsApi? landRecordsApi;

  const LandLegalView({
    super.key,
    required this.state,
    this.landMarketApi,
    this.landRecordsApi,
  });

  @override
  State<LandLegalView> createState() => _LandLegalViewState();
}

class _LandLegalViewState extends State<LandLegalView> {
  late final LandRecordsApi _api = widget.landRecordsApi ?? LandRecordsApi();

  final _searchController = TextEditingController();
  String _tab = 'records'; // 'records' or 'rent'
  String _searchMode = 'gat'; // 'gat' or 'village'
  String _recordType = '712'; // '712' or '8A'
  List<LandRecord712>? _results;
  LandRecord712? _selected;
  bool _searching = false;
  String? _inlineError;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String get _district =>
      (widget.state.currentUser?['district'] as String?) ??
      widget.state.profile.district;

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _search() async {
    final query = _searchController.text.trim();
    if (query.isEmpty) {
      setState(
        () => _inlineError = widget.state.tr('landLegal.errEnterGatOrVillage'),
      );
      return;
    }
    if (_searchMode == 'village' && query.length < 3) {
      setState(() => _inlineError = widget.state.tr('landLegal.errMinChars'));
      return;
    }
    setState(() {
      _inlineError = null;
      _searching = true;
      _selected = null;
    });
    try {
      final results = await _api.search(
        gatNumber: _searchMode == 'gat' ? query : null,
        village: _searchMode == 'village' ? query : null,
        district: _district,
        type: _recordType,
      );
      if (!mounted) return;
      setState(() {
        _results = results;
        _searching = false;
        if (results.length == 1) _selected = results.first;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _searching = false;
        _inlineError = (e.statusCode == 400 || e.statusCode == 422)
            ? widget.state.tr('landLegal.errInvalidSearch')
            : (e.message.isNotEmpty
                  ? e.message
                  : widget.state.tr('landLegal.errSearchFailed'));
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _searching = false;
        _inlineError = widget.state.tr('landLegal.errSearchFailed');
      });
    }
  }

  Future<void> _viewPdf(LandRecord712 r) async {
    try {
      final url = await _api.getPdfUrl(r.id);
      if (url.isEmpty) throw const ApiException(code: 'PDF_UNAVAILABLE');
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (_) {
      _snack(widget.state.tr('landLegal.errPdfUnavailable'));
    }
  }

  Future<void> _autoStore(LandRecord712 r) async {
    try {
      await _api.importRecord(r.id);
      _snack(widget.state.tr('landLegal.savedToFieldProfile'));
      try {
        await widget.state.refreshCurrentUser();
      } catch (_) {}
    } on ApiException catch (e) {
      _snack(
        e.message.isNotEmpty
            ? e.message
            : widget.state.tr('landLegal.errSaveFailed'),
      );
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
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.state.tr('landLegal.title'),
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF263238),
                ),
              ),
              Text(
                widget.state.tr('landLegal.subtitle'),
                style: const TextStyle(
                  fontSize: 11.5,
                  color: Color(0xFF90A4AE),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              ChoiceChip(
                label: Text(widget.state.tr('landLegal.tabRecords712')),
                selected: _tab == 'records',
                selectedColor: const Color(0xFFE8F5E9),
                onSelected: (_) => setState(() => _tab = 'records'),
              ),
              const SizedBox(width: 8),
              ChoiceChip(
                label: Text(widget.state.tr('landLegal.tabRent')),
                selected: _tab == 'rent',
                selectedColor: const Color(0xFFEDE9FE),
                onSelected: (_) => setState(() => _tab = 'rent'),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (_tab == 'rent')
            LandRentalBrowseSection(
              state: widget.state,
              landMarketApi: widget.landMarketApi,
            )
          else
            ..._buildRecordsTab(),
        ],
      ),
    );
  }

  List<Widget> _buildRecordsTab() {
    return [
      Row(
        children: [
          ChoiceChip(
            label: Text(widget.state.tr('landLegal.searchModeGat')),
            selected: _searchMode == 'gat',
            selectedColor: const Color(0xFFE8F5E9),
            onSelected: (_) => setState(() {
              _searchMode = 'gat';
              _inlineError = null;
            }),
          ),
          const SizedBox(width: 8),
          ChoiceChip(
            label: Text(widget.state.tr('landLegal.searchModeVillage')),
            selected: _searchMode == 'village',
            selectedColor: const Color(0xFFE8F5E9),
            onSelected: (_) => setState(() {
              _searchMode = 'village';
              _inlineError = null;
            }),
          ),
        ],
      ),
      const SizedBox(height: 10),
      LandSearchBar(
        controller: _searchController,
        state: widget.state,
        hintText: _searchMode == 'gat'
            ? widget.state.tr('landLegal.hintGat')
            : widget.state.tr('landLegal.hintVillage'),
        searching: _searching,
        onSearch: _search,
      ),
      if (_inlineError != null)
        Padding(
          padding: const EdgeInsets.only(top: 6, left: 4),
          child: Text(
            _inlineError!,
            style: const TextStyle(
              fontSize: 11.5,
              color: Color(0xFFDC2626),
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      const SizedBox(height: 12),
      Row(
        children: [
          Text(
            widget.state.tr('landLegal.recordTypeLabel'),
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w800,
              color: Color(0xFF263238),
            ),
          ),
          const SizedBox(width: 10),
          ChoiceChip(
            label: Text(widget.state.tr('landLegal.recordType712')),
            selected: _recordType == '712',
            selectedColor: const Color(0xFFE8F5E9),
            onSelected: (_) => setState(() => _recordType = '712'),
          ),
          const SizedBox(width: 8),
          ChoiceChip(
            label: Text(widget.state.tr('landLegal.recordType8a')),
            selected: _recordType == '8A',
            selectedColor: const Color(0xFFE8F5E9),
            onSelected: (_) => setState(() => _recordType = '8A'),
          ),
        ],
      ),
      const SizedBox(height: 14),
      if (_searching)
        const Center(
          child: Padding(
            padding: EdgeInsets.all(20),
            child: CircularProgressIndicator(color: Color(0xFF43A047)),
          ),
        )
      else if (_selected != null)
        LandRecordCard(
          record: _selected!,
          recordType: _recordType,
          state: widget.state,
          onViewPdf: () => _viewPdf(_selected!),
          onAutoStore: () => _autoStore(_selected!),
        )
      else if (_results != null && _results!.isEmpty)
        Container(
          padding: const EdgeInsets.all(24),
          width: double.infinity,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: [
              const Icon(
                Icons.find_in_page_rounded,
                size: 40,
                color: Colors.grey,
              ),
              const SizedBox(height: 8),
              Text(
                widget.state.tr('landLegal.noRecordsFound'),
                style: const TextStyle(fontSize: 13, color: Colors.grey),
              ),
            ],
          ),
        )
      else if (_results != null)
        ..._results!.map(
          (r) => LandRecordResultTile(
            record: r,
            state: widget.state,
            onTap: () => setState(() => _selected = r),
          ),
        ),
    ];
  }
}
