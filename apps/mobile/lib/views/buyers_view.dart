// Module F: Direct-to-Buyer Marketplace & Logistics Flutter View

import 'package:flutter/material.dart';
import '../api/api_exception.dart';
import '../api/contracts_api.dart';
import '../api/mandi_api.dart';
import '../api/transport_api.dart';
import '../state/app_state.dart';
import '../components/common/glass_card.dart';
import '../components/common/audio_button.dart';
import 'buyers/esign_dialog.dart';
import 'buyers/vehicle_booking_tool.dart';

class BuyersView extends StatefulWidget {
  final AppState state;
  final ContractsApi? contractsApi;
  final TransportApi? transportApi;
  final MandiApi? mandiApi;
  const BuyersView({
    super.key,
    required this.state,
    this.contractsApi,
    this.transportApi,
    this.mandiApi,
  });

  @override
  State<BuyersView> createState() => _BuyersViewState();
}

class _BuyersViewState extends State<BuyersView> {
  late final ContractsApi _contractsApi =
      widget.contractsApi ?? ContractsApi();
  late final TransportApi _transportApi =
      widget.transportApi ?? TransportApi();
  late final MandiApi _mandiApi = widget.mandiApi ?? MandiApi();

  int _selectedTab = 0; // 0: Contracts, 1: Logistics
  bool _loadingContracts = true;
  List<Map<String, dynamic>> _contracts = [];

  @override
  void initState() {
    super.initState();
    _loadContracts();
  }

  Future<void> _loadContracts() async {
    try {
      final res = await _contractsApi.getContracts(status: 'open');
      if (!mounted) return;
      setState(() {
        _contracts = (res['data'] as List).cast<Map<String, dynamic>>();
        _loadingContracts = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _contracts = const [];
        _loadingContracts = false;
      });
    }
  }

  Future<void> _showContractTerms(Map<String, dynamic> c) async {
    String terms = widget.state.tr('trade.loadingTerms');
    try {
      final detail = await _contractsApi.getContract("${c['id']}");
      terms = "${detail['termsText'] ?? terms}";
    } on ApiException catch (e) {
      terms = e.message.isNotEmpty ? e.message : e.code;
    }
    if (!mounted) return;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          "${widget.state.tr('trade.contractTerms')}: ${c['buyerCompany']}",
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
        ),
        content: Text(terms, style: const TextStyle(fontSize: 12.5, height: 1.5)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(widget.state.tr('close')),
          ),
        ],
      ),
    );
  }

  Future<void> _openEsign(Map<String, dynamic> c) async {
    final accepted = await showDialog<bool>(
      context: context,
      builder: (_) => EsignDialog(
        contractId: "${c['id']}",
        buyerCompany: "${c['buyerCompany']}",
        api: _contractsApi,
      ),
    );
    if (accepted == true) {
      widget.state.showToast(widget.state.tr('trade.contractAccepted'));
      await _loadContracts();
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.state.tr('trade.buyersTitle'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  Text(widget.state.tr('trade.buyersSubtitle'), style: const TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
              AudioButton(text: widget.state.tr('trade.buyersAudio')),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: _tabBtn(0, widget.state.tr('trade.tabPriceLock'))),
              const SizedBox(width: 8),
              Expanded(child: _tabBtn(1, widget.state.tr('trade.tabLogistics'))),
            ],
          ),
          const SizedBox(height: 14),
          if (_selectedTab == 0) ...[
            if (_loadingContracts)
              const Center(child: CircularProgressIndicator())
            else if (_contracts.isEmpty)
              Text(widget.state.tr('trade.noOpenContracts'), style: const TextStyle(fontSize: 12, color: Colors.grey))
            else
              ..._contracts.map(_buildContractCard),
          ],
          if (_selectedTab == 1)
            VehicleBookingTool(
              state: widget.state,
              transportApi: _transportApi,
              mandiApi: _mandiApi,
            ),
        ],
      ),
    );
  }

  Widget _tabBtn(int idx, String label) {
    final active = _selectedTab == idx;
    return GestureDetector(
      onTap: () => setState(() => _selectedTab = idx),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF1B4332) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: active ? const Color(0xFF1B4332) : Colors.grey.shade300),
        ),
        child: Text(label, style: TextStyle(fontSize: 12, fontWeight: active ? FontWeight.w800 : FontWeight.w600, color: active ? Colors.white : Colors.black87)),
      ),
    );
  }

  Widget _buildContractCard(Map<String, dynamic> c) {
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("${c['contractDuration']}", style: const TextStyle(fontSize: 10.5, color: Colors.purple, fontWeight: FontWeight.w700)),
                    Text("${c['buyerCompany']}", style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF1B4332))),
                    Text("${c['crop']}", style: const TextStyle(fontSize: 12, color: Colors.black54)),
                    Text("★ ${c['buyerRating']}", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFB45309))),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: const Color(0xFFD8F3DC), borderRadius: BorderRadius.circular(8)),
                child: Text("+₹${c['premiumAboveMSP']}/${widget.state.tr('trade.quintal')}", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF166534))),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.state.tr('trade.guaranteedLockRate'), style: const TextStyle(fontSize: 11, color: Colors.grey)),
                  Text("₹${c['lockedRateQuintal']}/${widget.state.tr('trade.quintal')}", style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF1B4332))),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(widget.state.tr('trade.minQuantity'), style: const TextStyle(fontSize: 11, color: Colors.grey)),
                  Text("${c['minQuantityQuintals']} ${widget.state.tr('trade.quintal')}", style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text("${widget.state.tr('trade.delivery')}: ${c['deliveryLocation']}", style: const TextStyle(fontSize: 11.5, color: Colors.black54)),
          Text("${widget.state.tr('trade.payment')}: ${c['paymentTerms']}", style: const TextStyle(fontSize: 11.5, color: Colors.black54)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _showContractTerms(c),
                  child: Text(widget.state.tr('trade.viewTerms'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => _openEsign(c),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1B4332), foregroundColor: Colors.white),
                  child: Text(widget.state.tr('lockPrice'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
