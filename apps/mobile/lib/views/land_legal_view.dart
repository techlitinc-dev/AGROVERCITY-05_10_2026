// Module K: Land & Legal Toolkit Flutter View (CRD Change 11)

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../models/app_models.dart';
import '../components/common/glass_card.dart';

class LandLegalView extends StatefulWidget {
  final AppState state;
  const LandLegalView({super.key, required this.state});

  @override
  State<LandLegalView> createState() => _LandLegalViewState();
}

class _LandLegalViewState extends State<LandLegalView> {
  final _searchController = TextEditingController();
  String _selectedRecordType = '7/12'; // '7/12' or '8A'
  List<LandRecord712> _filteredRecords = [];

  @override
  void initState() {
    super.initState();
    _filteredRecords = widget.state.landRecords;
  }

  void _onSearchChanged(String query) {
    setState(() {
      _filteredRecords = widget.state.search712Records(query);
    });
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("7/12 Utara & Land Records", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF263238))),
              Text("Maharashtra Land Record Search by Gat Number / Village Name", style: TextStyle(fontSize: 11.5, color: Color(0xFF90A4AE))),
            ],
          ),
          const SizedBox(height: 14),

          // Search Box (CRD Change 11)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF43A047), width: 1.5),
              boxShadow: [
                BoxShadow(color: const Color(0xFF43A047).withValues(alpha: 0.1), blurRadius: 10, offset: const Offset(0, 4)),
              ],
            ),
            child: Row(
              children: [
                const Icon(Icons.search_rounded, color: Color(0xFF43A047), size: 22),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    onChanged: _onSearchChanged,
                    decoration: const InputDecoration(
                      hintText: "Enter Gat Number (e.g. 142/2-A) or Village (e.g. Niphad)...",
                      hintStyle: TextStyle(fontSize: 12, color: Color(0xFF90A4AE)),
                      border: InputBorder.none,
                    ),
                  ),
                ),
                if (_searchController.text.isNotEmpty)
                  IconButton(
                    icon: const Icon(Icons.clear_rounded, size: 18, color: Colors.grey),
                    onPressed: () {
                      _searchController.clear();
                      _onSearchChanged('');
                    },
                  ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // 7/12 vs 8A Record Type Toggle
          Row(
            children: [
              const Text("Record Type:", style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF263238))),
              const SizedBox(width: 10),
              ChoiceChip(
                label: const Text("7/12 Utara (Satbara)"),
                selected: _selectedRecordType == '7/12',
                selectedColor: const Color(0xFFE8F5E9),
                onSelected: (_) => setState(() => _selectedRecordType = '7/12'),
              ),
              const SizedBox(width: 8),
              ChoiceChip(
                label: const Text("8A Khata Patrak"),
                selected: _selectedRecordType == '8A',
                selectedColor: const Color(0xFFE8F5E9),
                onSelected: (_) => setState(() => _selectedRecordType = '8A'),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Records List
          if (_filteredRecords.isEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              width: double.infinity,
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
              child: const Column(
                children: [
                  Icon(Icons.find_in_page_rounded, size: 40, color: Colors.grey),
                  SizedBox(height: 8),
                  Text("No 7/12 land records match your search", style: TextStyle(fontSize: 13, color: Colors.grey)),
                ],
              ),
            )
          else
            ..._filteredRecords.map((r) => _buildLandRecordCard(r)),
        ],
      ),
    );
  }

  Widget _buildLandRecordCard(LandRecord712 r) {
    return GlassCard(
      backgroundColor: Colors.white,
      border: Border.all(color: const Color(0xFFECEFF1)),
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: const Color(0xFFE8F5E9), borderRadius: BorderRadius.circular(8)),
                child: Text("Gat No: ${r.gatNumber}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF2E7D32))),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: const Color(0xFFFFF8E1), borderRadius: BorderRadius.circular(8)),
                child: Text("${r.village}, ${r.district}", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFF57F17))),
              ),
            ],
          ),
          const SizedBox(height: 10),

          if (_selectedRecordType == '7/12') ...[
            Text("Owner Name: ${r.ownerName}", style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF263238))),
            Text("Khata No: ${r.khataNumber} • Ferfar No: ${r.ferfarNumber}", style: const TextStyle(fontSize: 11.5, color: Colors.black54)),
            const SizedBox(height: 4),
            Text("Area: ${r.areaHectares} Hectare (${r.areaAcres} Acres)", style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w900, color: Color(0xFF2E7D32))),
            Text("Land Classification: ${r.soilType} • Irrigation: ${r.irrigationType}", style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ] else ...[
            Text("8A Khata Record: ${r.ownerName}", style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF263238))),
            Text("Total Khata Gat Holdings: 2 Plots • Combined Area: ${r.areaAcres} Acres", style: const TextStyle(fontSize: 12, color: Colors.black87)),
            Text("Revenue Assessment: Paid (Clear Status ✅)", style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF2E7D32))),
          ],
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => widget.state.showToast("Digital PDF for Gat ${r.gatNumber} downloaded!"),
                  icon: const Icon(Icons.picture_as_pdf_rounded, size: 15),
                  label: const Text("Download PDF", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF43A047), foregroundColor: Colors.white),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    widget.state.updateProfileArea(r.areaAcres);
                    widget.state.showToast("Land area (${r.areaAcres} Acres) auto-stored into profile!");
                  },
                  icon: const Icon(Icons.sync_rounded, size: 15),
                  label: const Text("Auto-Store Area", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
                  style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFF2E7D32)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

