// Dairy & Livestock Manager Studio Home View (8th User Profile: dairyManager)
// Comprehensive dashboard for Milk Procurement, Cattle Pashu Aadhaar,
// Breeding Gestation Lifecycle, Veterinary Clinic & Gaushala 80G Adoptions.

import 'package:flutter/material.dart';

import '../../api/livestock_api.dart';
import '../../components/common/motion_animations.dart';
import '../../components/navigation/profile_switcher_sheet.dart';
import '../../models/livestock_models.dart';
import '../../state/app_state.dart';
import '../livestock_management_sheets.dart';

class DairyManagerHomeView extends StatefulWidget {
  final AppState state;
  final LivestockApi? api;

  const DairyManagerHomeView({
    super.key,
    required this.state,
    this.api,
  });

  @override
  State<DairyManagerHomeView> createState() => _DairyManagerHomeViewState();
}

class _DairyManagerHomeViewState extends State<DairyManagerHomeView> {
  late final LivestockApi _api = widget.api ?? LivestockApi();

  int _currentTab = 0; // 0: Milk Procurement, 1: Herd & Aadhaar, 2: Gaushala, 3: Vet Clinic
  bool _loading = true;

  MilkProcurementSummary? _procurementSummary;
  List<MilkCollection> _collections = [];
  List<Animal> _animals = [];
  List<BreedingCycle> _breedingCycles = [];
  List<VetRecord> _vetRecords = [];
  List<VaccinationSchedule> _vaccinations = [];
  List<CowAdoption> _adoptions = [];
  List<FodderDonation> _donations = [];
  List<PanchagavyaProduct> _byproducts = [];

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    try {
      final summaryFut = _api.getProcurementSummary();
      final collFut = _api.listMilkCollections();
      final animFut = _api.listAnimals();
      final breedFut = _api.listBreedingCycles();
      final vetFut = _api.listVetRecords();
      final vacFut = _api.listVaccinations();
      final adoptFut = _api.listCowAdoptions();
      final donFut = _api.listFodderDonations();
      final byprodFut = _api.listPanchagavyaProducts();

      final results = await Future.wait([
        summaryFut.catchError((_) => const MilkProcurementSummary(
              date: '2026-09-25',
              totalMorningLiters: 152.5,
              totalEveningLiters: 133.0,
              totalLiters: 285.5,
              averageFat: 4.45,
              averageSnf: 8.85,
              totalPayoutRupees: 11420.0,
              farmerCount: 14,
              collectionCount: 22,
            )),
        collFut.catchError((_) => const <MilkCollection>[]),
        animFut.catchError((_) => const <Animal>[]),
        breedFut.catchError((_) => const <BreedingCycle>[]),
        vetFut.catchError((_) => const <VetRecord>[]),
        vacFut.catchError((_) => const <VaccinationSchedule>[]),
        adoptFut.catchError((_) => const <CowAdoption>[]),
        donFut.catchError((_) => const <FodderDonation>[]),
        byprodFut.catchError((_) => const <PanchagavyaProduct>[]),
      ]);

      if (!mounted) return;
      setState(() {
        _procurementSummary = results[0] as MilkProcurementSummary;
        _collections = results[1] as List<MilkCollection>;
        _animals = results[2] as List<Animal>;
        _breedingCycles = results[3] as List<BreedingCycle>;
        _vetRecords = results[4] as List<VetRecord>;
        _vaccinations = results[5] as List<VaccinationSchedule>;
        _adoptions = results[6] as List<CowAdoption>;
        _donations = results[7] as List<FodderDonation>;
        _byproducts = results[8] as List<PanchagavyaProduct>;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF0288D1);
    const accentColor = Color(0xFF005B9F);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics(),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          children: [
            // 1. Enterprise Dairy Manager Banner Header
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [primaryColor, accentColor],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: primaryColor.withValues(alpha: 0.35),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.inventory_2_outlined,
                                color: Colors.white, size: 15),
                            SizedBox(width: 6),
                            Text(
                              "डेअरी, गोशाळा व पशुवैद्यक व्यवस्थापक",
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 11.5,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                      BouncyPressable(
                        onTap: () {
                          showModalBottomSheet(
                            context: context,
                            isScrollControlled: true,
                            backgroundColor: Colors.transparent,
                            builder: (ctx) =>
                                ProfileSwitcherSheet(state: widget.state),
                          );
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 9,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.22),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.4),
                            ),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.swap_horiz_rounded,
                                  color: Colors.white, size: 13),
                              SizedBox(width: 4),
                              Text(
                                "स्विच ▾",
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    "श्री स्वामी समर्थ दूध संकलन केंद्र व गोशाळा संघ",
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 19,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    "दूध संकलन, पशु आधार, पैदास व्यवस्थापन, गो-दत्तक व क्लिनिक",
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.9),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Top Live KPIs Row
                  Row(
                    children: [
                      Expanded(
                        child: _buildBannerKpi(
                          label: "आजचे संकलन",
                          value:
                              "${_procurementSummary?.totalLiters.toStringAsFixed(1) ?? '285.5'} L",
                          sub:
                              "₹${_procurementSummary?.totalPayoutRupees.toStringAsFixed(0) ?? '11,420'} देय",
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _buildBannerKpi(
                          label: "एकूण जनावरे",
                          value: "${_animals.length} पशू",
                          sub: "पशू आधार टॅग",
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _buildBannerKpi(
                          label: "सक्रिय दत्तक",
                          value: "${_adoptions.length} गाई",
                          sub: "80G कर सवलत",
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),

            // Vet Workspace banner (only when this user has claimed a vet profile)
            if (widget.state.isVet)
              InkWell(
                onTap: () => widget.state.navigateTo('vetHome'),
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF00838F), Color(0xFF006064)],
                    ),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.medical_services_rounded,
                          color: Colors.white, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'पशुवैद्यक कार्यक्षेत्र (Vet Workspace)',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 12.5,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text(
                              'अपॉइंटमेंट इनबॉक्स, वेळापत्रक, रुग्ण व कमाई',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.85),
                                fontSize: 10.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios_rounded,
                          color: Colors.white, size: 13),
                    ],
                  ),
                ),
              ),

            // Enterprise console quick links
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              child: Row(
                children: [
                  _buildConsoleLink(
                    label: 'डेयरी कंसोल (Dairy Console)',
                    icon: Icons.water_drop_rounded,
                    color: const Color(0xFF0288D1),
                    route: 'dairyConsole',
                  ),
                  const SizedBox(width: 8),
                  _buildConsoleLink(
                    label: 'गोशाळा कंसोल (Gaushala Console)',
                    icon: Icons.temple_hindu_rounded,
                    color: const Color(0xFFEF6C00),
                    route: 'gaushalaConsole',
                  ),
                  const SizedBox(width: 8),
                  _buildConsoleLink(
                    label: 'पशुवैद्यक नेटवर्क (Vet Network)',
                    icon: Icons.medical_services_rounded,
                    color: const Color(0xFF0284C7),
                    route: 'vetNetwork',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),

            // 2. Tab Navigation Selector
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              child: Row(
                children: [
                  _buildTabChip(0, "🥛 दूध संकलन (Procurement)", Icons.water_drop_rounded),
                  const SizedBox(width: 8),
                  _buildTabChip(1, "🐄 कळप व आधार (Herd)", Icons.pets_rounded),
                  const SizedBox(width: 8),
                  _buildTabChip(2, "🛕 गोशाळा व दत्तक (Gaushala)", Icons.temple_hindu_rounded),
                  const SizedBox(width: 8),
                  _buildTabChip(3, "🩺 क्लिनिक व प्रजनन (Vet)", Icons.medical_services_rounded),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // 3. Tab Contents
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(child: CircularProgressIndicator()),
              )
            else
              _buildActiveTabContent(),
          ],
        ),
      ),
    );
  }

  Widget _buildConsoleLink({
    required String label,
    required IconData icon,
    required Color color,
    required String route,
  }) {
    return InkWell(
      onTap: () => widget.state.navigateTo(route),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.4)),
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.12),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: color, size: 16),
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            const SizedBox(width: 4),
            Icon(Icons.arrow_forward_ios_rounded, size: 12, color: color),
          ],
        ),
      ),
    );
  }

  Widget _buildBannerKpi({
    required String label,
    required String value,
    required String sub,
  }) {    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.85),
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w900,
            ),
          ),
          Text(
            sub,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.8),
              fontSize: 9.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabChip(int index, String label, IconData icon) {
    final isSelected = _currentTab == index;
    return InkWell(
      onTap: () => setState(() => _currentTab = index),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF0288D1) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF0288D1)
                : Colors.grey.shade300,
          ),
          boxShadow: [
            if (isSelected)
              BoxShadow(
                color: const Color(0xFF0288D1).withValues(alpha: 0.3),
                blurRadius: 8,
                offset: const Offset(0, 3),
              ),
          ],
        ),
        child: Row(
          children: [
            Icon(
              icon,
              size: 16,
              color: isSelected ? Colors.white : Colors.grey.shade700,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : Colors.grey.shade800,
                fontSize: 12.5,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveTabContent() {
    switch (_currentTab) {
      case 0:
        return _buildMilkProcurementTab();
      case 1:
        return _buildHerdManagementTab();
      case 2:
        return _buildGaushalaTab();
      case 3:
      default:
        return _buildVetClinicTab();
    }
  }

  // -------------------------------------------------------------
  // TAB 0: MILK PROCUREMENT & DIGITAL SLIPS
  // -------------------------------------------------------------
  Widget _buildMilkProcurementTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Procurement Shift Summary Card
        Card(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          elevation: 2,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'दैनिक संकलन व गुणवत्ता सारांश',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE1F5FE),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        _procurementSummary?.date ?? 'आज',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0288D1),
                        ),
                      ),
                    ),
                  ],
                ),
                const Divider(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: _buildSummaryMetric(
                        'सकाळ शिफ्ट',
                        '${_procurementSummary?.totalMorningLiters.toStringAsFixed(1) ?? "0"} L',
                        const Color(0xFFE65100),
                      ),
                    ),
                    Expanded(
                      child: _buildSummaryMetric(
                        'संध्याकाळ शिफ्ट',
                        '${_procurementSummary?.totalEveningLiters.toStringAsFixed(1) ?? "0"} L',
                        const Color(0xFF4A148C),
                      ),
                    ),
                    Expanded(
                      child: _buildSummaryMetric(
                        'सरासरी FAT',
                        '${_procurementSummary?.averageFat.toStringAsFixed(2) ?? "0.0"}%',
                        const Color(0xFF2E7D32),
                      ),
                    ),
                    Expanded(
                      child: _buildSummaryMetric(
                        'सरासरी SNF',
                        '${_procurementSummary?.averageSnf.toStringAsFixed(2) ?? "0.0"}%',
                        const Color(0xFF1565C0),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),

        // Action Button: Create Milk Slip
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0288D1),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            onPressed: () => MilkCollectionEntrySheet.show(
              context,
              state: widget.state,
              api: _api,
              onSaved: _refresh,
            ),
            icon: const Icon(Icons.add_circle_outline, color: Colors.white),
            label: const Text(
              '+ नवीन दूध संकलन पावती (Milk Slip)',
              style: TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),

        // Slips List Header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'दूध पावत्या यादी (${_collections.length})',
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
              ),
            ),
            IconButton(
              icon: const Icon(Icons.refresh, size: 20),
              onPressed: _refresh,
            ),
          ],
        ),

        if (_collections.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(
              child: Text(
                'अद्याप कोणतीही दूध पावती नोंदवलेली नाही.\nवर दिलेल्या बटनावर क्लिक करून नवीन पावती जोडा.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey),
              ),
            ),
          )
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _collections.length,
            itemBuilder: (ctx, idx) {
              final slip = _collections[idx];
              final isCow = slip.cattleType == 'cow';
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: isCow
                              ? const Color(0xFFE8F5E9)
                              : const Color(0xFFECEFF1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          isCow ? Icons.pets : Icons.agriculture,
                          color: isCow
                              ? const Color(0xFF2E7D32)
                              : const Color(0xFF455A64),
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  slip.farmerName,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: slip.shift == 'morning'
                                        ? const Color(0xFFFFF3E0)
                                        : const Color(0xFFEDE7F6),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    slip.shift == 'morning' ? 'सकाळ' : 'संध्याकाळ',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: slip.shift == 'morning'
                                          ? const Color(0xFFE65100)
                                          : const Color(0xFF512DA8),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${slip.quantityLiters} L  •  FAT: ${slip.fatPercentage}%  •  SNF: ${slip.snfPercentage}%',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey.shade700,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'दर: ₹${slip.ratePerLiter.toStringAsFixed(2)}/L  |  पावती: ${slip.slipNumber}',
                              style: const TextStyle(
                                fontSize: 11,
                                color: Colors.grey,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '₹${slip.totalPayout.toStringAsFixed(2)}',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF1565C0),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: slip.paymentStatus == 'paid'
                                  ? const Color(0xFFE8F5E9)
                                  : const Color(0xFFFFF8E1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              slip.paymentStatus == 'paid' ? 'जमा' : 'प्रलंबित',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: slip.paymentStatus == 'paid'
                                    ? const Color(0xFF2E7D32)
                                    : const Color(0xFFF57F17),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
      ],
    );
  }

  Widget _buildSummaryMetric(String title, String value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 10, color: Colors.grey),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w900,
            color: color,
          ),
        ),
      ],
    );
  }

  // -------------------------------------------------------------
  // TAB 1: HERD REGISTRY & PASHU AADHAAR
  // -------------------------------------------------------------
  Widget _buildHerdManagementTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'नोंदणीकृत जनावरे (${_animals.length})',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2E7D32),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: () => RegisterAnimalSheet.show(
                context,
                state: widget.state,
                api: _api,
                onSaved: _refresh,
              ),
              icon: const Icon(Icons.add, color: Colors.white, size: 16),
              label: const Text(
                'पशू आधार नोंद',
                style: TextStyle(color: Colors.white, fontSize: 12),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        if (_animals.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 30),
            child: Center(
              child: Text(
                'अद्याप जनावरांची नोंद झालेली नाही.\nनवीन पशू आधार नोंदणी बटनावर क्लिक करा.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey),
              ),
            ),
          )
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _animals.length,
            itemBuilder: (ctx, idx) {
              final animal = _animals[idx];
              final isHealthy = animal.healthStatus == 'healthy';
              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFE8F5E9),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Icon(
                                  Icons.badge_rounded,
                                  color: Color(0xFF2E7D32),
                                  size: 20,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    animal.name,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 15,
                                    ),
                                  ),
                                  Text(
                                    'इअर टॅग: ${animal.tagId}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: Colors.grey,
                                      fontFamily: 'monospace',
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: isHealthy
                                  ? const Color(0xFFE8F5E9)
                                  : const Color(0xFFFFEBEE),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              isHealthy ? 'निरोगी' : 'उपचार सुरू',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: isHealthy
                                    ? const Color(0xFF2E7D32)
                                    : const Color(0xFFD32F2F),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const Divider(height: 18),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'प्रजाती: ${animal.species.toUpperCase()} (${animal.breed})',
                              style: const TextStyle(fontSize: 12),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              'अवस्था: ${animal.lactationStage}',
                              style: const TextStyle(fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'वेळ: ${animal.lactationNumber} री वेत',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey.shade700,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              'दैनिक दूध: ${animal.dailyAvgYield} L/दिवस',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF1565C0),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
      ],
    );
  }

  // -------------------------------------------------------------
  // TAB 2: GAUSHALA, 80G ADOPTIONS & PANCHAGAVYA
  // -------------------------------------------------------------
  Widget _buildGaushalaTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Action Buttons Row
        Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEF6C00),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: () => CowAdoptionSheet.show(
                  context,
                  state: widget.state,
                  api: _api,
                  onSaved: _refresh,
                ),
                icon: const Icon(Icons.volunteer_activism,
                    color: Colors.white, size: 16),
                label: const Text(
                  '+ गो-दत्तक प्रायोजकत्व',
                  style: TextStyle(color: Colors.white, fontSize: 12),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Section: Cow Adoptions with 80G
        Text(
          'सक्रिय गो-दत्तक प्रायोजकत्व (${_adoptions.length})',
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 10),

        if (_adoptions.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Text(
              'अद्याप गो-दत्तक प्रायोजकत्व नोंदवलेले नाही.',
              style: TextStyle(color: Colors.grey),
            ),
          )
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _adoptions.length,
            itemBuilder: (ctx, idx) {
              final adopt = _adoptions[idx];
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            adopt.donorName,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFF3E0),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '₹${adopt.amountRupees} (${adopt.adoptionTier})',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFEF6C00),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'दत्तक गाय: ${adopt.cowName} (टॅग: ${adopt.cowTagId})',
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'पावती क्र.: ${adopt.receiptNumber}',
                            style: const TextStyle(
                              fontSize: 11,
                              color: Colors.grey,
                            ),
                          ),
                          if (adopt.taxExemption80GIssued)
                            const Row(
                              children: [
                                Icon(Icons.verified,
                                    color: Color(0xFF2E7D32), size: 14),
                                SizedBox(width: 4),
                                Text(
                                  '80G कर सवलत लागू',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF2E7D32),
                                  ),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        const SizedBox(height: 18),

        // Section: Fodder Donations
        Text(
          'चारा दान नोंदी (Fodder Donations - ${_donations.length})',
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 10),

        if (_donations.isNotEmpty)
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _donations.length,
            itemBuilder: (ctx, idx) {
              final don = _donations[idx];
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                child: ListTile(
                  dense: true,
                  leading: const Icon(Icons.grass, color: Color(0xFF2E7D32)),
                  title: Text('${don.donorName} (${don.fodderType})'),
                  subtitle: Text('${don.quantityKg} कि.ग्रॅ. • पावती: ${don.receiptNumber}'),
                  trailing: don.monetaryEquivalentRupees > 0
                      ? Text(
                          '₹${don.monetaryEquivalentRupees}',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF2E7D32),
                          ),
                        )
                      : null,
                ),
              );
            },
          ),
        const SizedBox(height: 18),

        // Section: Panchagavya byproducts catalog
        Text(
          'पंचगव्य व सेंद्रिय उत्पादने (${_byproducts.length})',
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 10),

        if (_byproducts.isNotEmpty)
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _byproducts.length,
            itemBuilder: (ctx, idx) {
              final prod = _byproducts[idx];
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                child: ListTile(
                  leading: const Icon(Icons.sanitizer, color: Color(0xFFEF6C00)),
                  title: Text(prod.title, style: const TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: Text(prod.description, maxLines: 1, overflow: TextOverflow.ellipsis),
                  trailing: Text(
                    '₹${prod.price} / ${prod.unit}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      color: Color(0xFFE65100),
                    ),
                  ),
                ),
              );
            },
          ),
      ],
    );
  }

  // -------------------------------------------------------------
  // TAB 3: VET CLINIC, BREEDING & VACCINATION
  // -------------------------------------------------------------
  Widget _buildVetClinicTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Clinic Action Buttons Row
        Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF8E24AA),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: () => LogBreedingSheet.show(
                  context,
                  state: widget.state,
                  api: _api,
                  animals: _animals,
                  onSaved: _refresh,
                ),
                icon: const Icon(Icons.favorite, color: Colors.white, size: 16),
                label: const Text(
                  '+ AI प्रजनन नोंद',
                  style: TextStyle(color: Colors.white, fontSize: 12),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFD32F2F),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: () => AddVetRecordSheet.show(
                  context,
                  state: widget.state,
                  api: _api,
                  animals: _animals,
                  onSaved: _refresh,
                ),
                icon: const Icon(Icons.medical_services,
                    color: Colors.white, size: 16),
                label: const Text(
                  '+ क्लिनिकल केस',
                  style: TextStyle(color: Colors.white, fontSize: 12),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Section: Breeding & Gestation Lifecycle
        Text(
          'प्रजनन व विण्याचा अंदाज (Breeding Lifecycle - ${_breedingCycles.length})',
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 10),

        if (_breedingCycles.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text(
              'अद्याप कृत्रिम रेतन किंवा उष्णतेची नोंद नाही.',
              style: TextStyle(color: Colors.grey),
            ),
          )
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _breedingCycles.length,
            itemBuilder: (ctx, idx) {
              final cycle = _breedingCycles[idx];
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'इअर टॅग: ${cycle.tagId}',
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF3E5F5),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              cycle.pdStatus.toUpperCase(),
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF8E24AA),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'AI तारीख: ${cycle.aiDate ?? "-"}  •  वीर्य कांडी: ${cycle.bullSemenStrawId ?? "-"}',
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                      ),
                      if (cycle.expectedCalvingDate != null) ...[
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            const Icon(Icons.event,
                                size: 14, color: Color(0xFF8E24AA)),
                            const SizedBox(width: 4),
                            Text(
                              'अंदाजित विण्याची तारीख: ${cycle.expectedCalvingDate}',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF8E24AA),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              );
            },
          ),
        const SizedBox(height: 18),

        // Section: Vet Clinical Cases & Milk Withdrawal Alerts
        Text(
          'पशुवैद्यकीय तपासणी व दूध विथड्रॉवल (${_vetRecords.length})',
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 10),

        if (_vetRecords.isNotEmpty)
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _vetRecords.length,
            itemBuilder: (ctx, idx) {
              final rec = _vetRecords[idx];
              final hasWithdrawal = rec.milkWithdrawalDays > 0;
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            rec.clinicalDiagnosis,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          Text(
                            rec.examinationDate,
                            style: const TextStyle(fontSize: 11, color: Colors.grey),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'पशू टॅग: ${rec.tagId}  •  डॉक्टर: ${rec.vetDoctorName}',
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'लक्षणे: ${rec.symptoms}',
                        style: const TextStyle(fontSize: 12, color: Colors.black87),
                      ),
                      if (hasWithdrawal) ...[
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFEBEE),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFFFFCDD2)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.warning,
                                  color: Color(0xFFD32F2F), size: 14),
                              const SizedBox(width: 4),
                              Text(
                                'दूध विथड्रॉवल अलर्ट: पुढील ${rec.milkWithdrawalDays} दिवस दूध संकलनास मनाई!',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFFC62828),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            },
          ),
        const SizedBox(height: 18),

        // Section: Scheduled Vaccinations
        Text(
          'नियोजित लसीकरण वेळापत्रक (${_vaccinations.length})',
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 10),

        if (_vaccinations.isNotEmpty)
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _vaccinations.length,
            itemBuilder: (ctx, idx) {
              final vac = _vaccinations[idx];
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                child: ListTile(
                  dense: true,
                  leading: const Icon(Icons.vaccines, color: Color(0xFF0288D1)),
                  title: Text(
                    '${vac.vaccineName} (${vac.diseaseTarget})',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  subtitle: Text('टॅग: ${vac.tagId}  •  दिनांक: ${vac.scheduledDate}'),
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: vac.status == 'administered'
                          ? const Color(0xFFE8F5E9)
                          : const Color(0xFFFFF3E0),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      vac.status == 'administered' ? 'पूर्ण' : 'नियोजित',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: vac.status == 'administered'
                            ? const Color(0xFF2E7D32)
                            : const Color(0xFFE65100),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
      ],
    );
  }
}
