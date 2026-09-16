// Module O: Crop Insurance (प्रधानमंत्री फसल बीमा योजना & RWBCIS)
// Luxury Glassmorphic UI with 72-Hour Instant Claim, Premium Calculator & Live Status Tracker

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../models/app_models.dart';
import '../components/common/glass_card.dart';
import '../components/common/audio_button.dart';
import '../components/common/motion_animations.dart';

class CropInsuranceView extends StatefulWidget {
  final AppState state;
  const CropInsuranceView({super.key, required this.state});

  @override
  State<CropInsuranceView> createState() => _CropInsuranceViewState();
}

class _CropInsuranceViewState extends State<CropInsuranceView> with SingleTickerProviderStateMixin {
  int _selectedTab = 0; // 0: Policies, 1: 72h Claim, 2: Calculator, 3: Claim Tracker

  // Claim Form State
  String _selectedPolicyId = "pol-1";
  String _selectedCalamity = "ओलावृष्टि (Hailstorm)";
  String _cropStage = "फूल व फल अवस्था (Flowering/Fruiting)";
  double _damagePercent = 65;
  final String _damageDate = "12 Sep 2026";

  // Premium Calculator State
  String _calcCrop = "Soybean";
  double _calcAcres = 3.5;
  String _calcSeason = "Kharif"; // 'Kharif', 'Rabi', 'Annual'

  final List<Map<String, dynamic>> _calamityOptions = const [
    {
      'name': 'ओलावृष्टि (Hailstorm)',
      'icon': Icons.ac_unit_rounded,
      'color': Color(0xFF0284C7),
      'desc': 'बर्फ व ओले गिरने से फसल क्षति',
    },
    {
      'name': 'बेमौसम बारिश (Unseasonal Rain)',
      'icon': Icons.thunderstorm_rounded,
      'color': Color(0xFF0D9488),
      'desc': 'कटाई पूर्व या बाद अतिवृष्टि',
    },
    {
      'name': 'जलभराव / बाढ़ (Inundation)',
      'icon': Icons.flood_rounded,
      'color': Color(0xFF2563EB),
      'desc': 'खेत में पानी भरने से सड़न',
    },
    {
      'name': 'सूखा (Drought)',
      'icon': Icons.wb_sunny_rounded,
      'color': Color(0xFFD97706),
      'desc': 'वर्षा की कमी से फसल सूखना',
    },
    {
      'name': 'कीट व रोग प्रकोप (Pest Attack)',
      'icon': Icons.pest_control_rounded,
      'color': Color(0xFFDC2626),
      'desc': 'व्यापक इल्ली व फफूंद नुकसान',
    },
    {
      'name': 'तूफान / चक्रवात (Cyclone)',
      'icon': Icons.air_rounded,
      'color': Color(0xFF7C3AED),
      'desc': 'तेज हवा से फसल का गिरना',
    },
  ];

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 140),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. 🛡️ Header & Audio Explainer
          StaggeredSlideFade(
            delayMs: 0,
            duration: const Duration(milliseconds: 400),
            child: _buildHeader(context),
          ),
          const SizedBox(height: 14),

          // 2. ⚡ Urgent 72-Hour Warning & Helpline Capsule
          StaggeredSlideFade(
            delayMs: 60,
            duration: const Duration(milliseconds: 400),
            child: _buildEmergencyBanner(context),
          ),
          const SizedBox(height: 14),

          // 3. 📑 Segmented Tab Switcher
          StaggeredSlideFade(
            delayMs: 120,
            duration: const Duration(milliseconds: 400),
            child: _buildSegmentedTabs(context),
          ),
          const SizedBox(height: 16),

          // 4. 🌟 Active Tab View Container
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 350),
            switchInCurve: Curves.easeOutCubic,
            switchOutCurve: Curves.easeInCubic,
            transitionBuilder: (child, animation) => FadeTransition(
              opacity: animation,
              child: SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(0, 0.04),
                  end: Offset.zero,
                ).animate(animation),
                child: child,
              ),
            ),
            child: KeyedSubtree(
              key: ValueKey<int>(_selectedTab),
              child: _buildActiveTabContent(context),
            ),
          ),
        ],
      ),
    );
  }

  // 1. Header with Audio Guide and PMFBY Seal
  Widget _buildHeader(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF064E3B), Color(0xFF047857), Color(0xFF059669)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF047857).withValues(alpha: 0.35),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.18),
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0xFFFBBF24), width: 1.5),
                    ),
                    child: const Icon(Icons.shield_rounded, color: Color(0xFFFBBF24), size: 24),
                  ),
                  const SizedBox(width: 12),
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "प्रधानमंत्री फसल बीमा",
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 18,
                          letterSpacing: 0.2,
                        ),
                      ),
                      Text(
                        "PMFBY & पुनर्रचित मौसम बीमा (RWBCIS)",
                        style: TextStyle(
                          color: Color(0xFFD1FAE5),
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const AudioButton(
                text: "प्रधानमंत्री फसल बीमा योजना के तहत प्राकृतिक आपदा से फसल क्षति होने पर 72 घंटे के भीतर ऐप द्वारा क्लेम सूचना दर्ज करें। खरीफ फसलों के लिए मात्र 2 प्रतिशत और रबी फसलों के लिए केवल डेढ़ प्रतिशत प्रीमियम देना होता है।",
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Total Coverage & Subsidy Stats Strip
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.25),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildHeaderStat("कुल बीमित रकबा", "5.5 एकड़", Icons.landscape_rounded),
                Container(height: 24, width: 1, color: Colors.white24),
                _buildHeaderStat("कुल सुरक्षा कवर", "₹2,41,500", Icons.currency_rupee_rounded),
                Container(height: 24, width: 1, color: Colors.white24),
                _buildHeaderStat("सरकारी सब्सिडी", "₹29,767", Icons.savings_rounded),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderStat(String title, String value, IconData icon) {
    return Column(
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: const Color(0xFFFDE68A), size: 12),
            const SizedBox(width: 4),
            Text(title, style: const TextStyle(color: Color(0xFFE2E8F0), fontSize: 10, fontWeight: FontWeight.w600)),
          ],
        ),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w900)),
      ],
    );
  }

  // 2. Emergency 72-Hour Warning & Helpline Capsule
  Widget _buildEmergencyBanner(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFDE68A), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFD97706).withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: const BoxDecoration(
              color: Color(0xFFFEF3C7),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.timer_outlined, color: Color(0xFFD97706), size: 20),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      "72 घंटे की आपातकालीन समयसीमा",
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 12.5,
                        color: Color(0xFF92400E),
                      ),
                    ),
                    SizedBox(width: 6),
                    DecoratedBox(
                      decoration: BoxDecoration(
                        color: Color(0xFFDC2626),
                        borderRadius: BorderRadius.all(Radius.circular(6)),
                      ),
                      child: Padding(
                        padding: EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        child: Text("जरूरी", style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900)),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 2),
                Text(
                  "नुकसान होने पर 72 घंटे में सूचना दें। राष्ट्रीय हेल्पलाइन: 14447",
                  style: TextStyle(
                    fontSize: 11,
                    color: Color(0xFF78350F),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          BouncyPressable(
            onTap: () => widget.state.showToast("📞 राष्ट्रीय फसल बीमा टोल-फ्री हेल्पलाइन 14447 पर कॉल कनेक्ट की जा रही है..."),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFF92400E),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.call_rounded, color: Colors.white, size: 14),
                  SizedBox(width: 4),
                  Text("14447", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 11.5)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // 3. Segmented Navigation Tabs
  Widget _buildSegmentedTabs(BuildContext context) {
    final tabs = [
      {'title': 'मेरी पॉलिसी', 'subtitle': 'Passbook', 'icon': Icons.description_rounded, 'badge': '${widget.state.insurancePolicies.length}'},
      {'title': 'दावा सूचना', 'subtitle': '72h Claim', 'icon': Icons.report_problem_rounded, 'badge': '72h'},
      {'title': 'कैलकुलेटर', 'subtitle': 'Premium', 'icon': Icons.calculate_rounded, 'badge': null},
      {'title': 'दावा स्थिति', 'subtitle': 'Track', 'icon': Icons.track_changes_rounded, 'badge': '${widget.state.insuranceClaims.length}'},
    ];

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: List.generate(tabs.length, (index) {
          final isSelected = _selectedTab == index;
          final tab = tabs[index];

          return Expanded(
            child: BouncyPressable(
              onTap: () => setState(() => _selectedTab = index),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  gradient: isSelected
                      ? const LinearGradient(
                          colors: [Color(0xFF047857), Color(0xFF065F46)],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        )
                      : null,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Icon(
                          tab['icon'] as IconData,
                          size: 18,
                          color: isSelected ? const Color(0xFFFBBF24) : Colors.grey.shade600,
                        ),
                        if (tab['badge'] != null)
                          Positioned(
                            right: -10,
                            top: -4,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                              decoration: BoxDecoration(
                                color: isSelected ? const Color(0xFFDC2626) : const Color(0xFF047857),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                tab['badge'] as String,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 8,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      tab['title'] as String,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                        color: isSelected ? Colors.white : Colors.grey.shade700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  // 4. Tab Content Selector
  Widget _buildActiveTabContent(BuildContext context) {
    switch (_selectedTab) {
      case 0:
        return _buildPoliciesTab(context);
      case 1:
        return _buildClaimIntimationTab(context);
      case 2:
        return _buildPremiumCalculatorTab(context);
      case 3:
      default:
        return _buildClaimTrackerTab(context);
    }
  }

  // ==========================================
  // TAB 1: Digital Policy Passbook & Certificates
  // ==========================================
  Widget _buildPoliciesTab(BuildContext context) {
    final policies = widget.state.insurancePolicies;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              "सक्रिय ई-पॉलिसी डिजिटल पासबुक",
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
            ),
            TextButton.icon(
              onPressed: () => _openOfficialPmfbyModal(context),
              icon: const Icon(Icons.open_in_new_rounded, size: 14, color: Color(0xFF047857)),
              label: const Text("PMFBY पोर्टल", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF047857))),
            ),
          ],
        ),
        const SizedBox(height: 8),

        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: policies.length,
          separatorBuilder: (ctx, i) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final pol = policies[index];
            return StaggeredSlideFade(
              delayMs: index * 60,
              duration: const Duration(milliseconds: 350),
              child: _buildPolicyCard(context, pol),
            );
          },
        ),
        const SizedBox(height: 16),

        // Quick Apply New Crop Coverage Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFFF0FDF4), Color(0xFFDCFCE7)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFF86EFAC)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: const BoxDecoration(
                  color: Color(0xFF047857),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.add_moderator_rounded, color: Colors.white, size: 22),
              ),
              const SizedBox(width: 14),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "नई फसल बीमा पॉलिसी जोड़ें",
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: Color(0xFF064E3B)),
                    ),
                    SizedBox(height: 2),
                    Text(
                      "KCC खाता अथवा गैर-ऋणी किसान PMFBY पोर्टल से सीधी पॉलिसी जारी करें",
                      style: TextStyle(fontSize: 11, color: Color(0xFF047857)),
                    ),
                  ],
                ),
              ),
              ElevatedButton(
                onPressed: () => _openOfficialPmfbyModal(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF047857),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text("आवेदन", style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5)),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPolicyCard(BuildContext context, CropInsurancePolicy pol) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          // Header Bar with Policy No & Security Seal
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
              ),
              borderRadius: BorderRadius.vertical(top: Radius.circular(19)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.verified_user_rounded, color: Color(0xFFFBBF24), size: 16),
                    const SizedBox(width: 6),
                    Text(
                      pol.policyNumber,
                      style: const TextStyle(
                        color: Color(0xFFFDE68A),
                        fontWeight: FontWeight.w800,
                        fontSize: 12,
                        fontFamily: 'monospace',
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFF047857),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    pol.status,
                    style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800),
                  ),
                ),
              ],
            ),
          ),

          // Main Policy Body
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          pol.vernacularCropName,
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          "${pol.vernacularSchemeName} • ${pol.landAreaAcres} एकड़",
                          style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text("कुल बीमित राशि", style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
                        Text(
                          "₹${pol.sumInsured.toInt()}",
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF047857)),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const Divider(height: 1, color: Color(0xFFF1F5F9)),
                const SizedBox(height: 12),

                // Financial Breakdown Row
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text("किसान प्रीमियम अंश", style: TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                            const SizedBox(height: 2),
                            Text("₹${pol.farmerPremium.toInt()}", style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0FDF4),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFBBF7D0)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text("सरकारी अनुदान (Subsidy)", style: TextStyle(fontSize: 10, color: Color(0xFF166534))),
                            const SizedBox(height: 2),
                            Text("₹${pol.govtSubsidy.toInt()}", style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF166534))),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Insurance Company & Validity
                Row(
                  children: [
                    const Icon(Icons.account_balance_rounded, size: 14, color: Color(0xFF64748B)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        "${pol.insuranceCompany} • ${pol.bankName}",
                        style: const TextStyle(fontSize: 11, color: Color(0xFF475569), fontWeight: FontWeight.w600),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(Icons.event_available_rounded, size: 14, color: Color(0xFF047857)),
                    const SizedBox(width: 6),
                    Text(
                      "कवर अवधि: ${pol.coverageStartDate} से ${pol.coverageEndDate}",
                      style: const TextStyle(fontSize: 11, color: Color(0xFF047857), fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Action Buttons: File Claim & Download e-Policy
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => widget.state.downloadPolicyCertificate(pol.policyNumber),
                        icon: const Icon(Icons.download_rounded, size: 15),
                        label: const Text("ई-प्रमाणपत्र PDF", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF047857),
                          side: const BorderSide(color: Color(0xFF047857)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () {
                          setState(() {
                            _selectedPolicyId = pol.id;
                            _selectedTab = 1; // jump to claim tab
                          });
                        },
                        icon: const Icon(Icons.report_gmailerrorred_rounded, size: 15),
                        label: const Text("नुकसान क्लेम करें", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFDC2626),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ==========================================
  // TAB 2: 72-Hour Instant Claim Intimation
  // ==========================================
  Widget _buildClaimIntimationTab(BuildContext context) {
    final policies = widget.state.insurancePolicies;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Urgent 72h Compliance Card
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF7F1D1D), Color(0xFF991B1B)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF991B1B).withValues(alpha: 0.3),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.warning_amber_rounded, color: Color(0xFFFDE68A), size: 20),
                  SizedBox(width: 8),
                  Text(
                    "72 घंटे के भीतर दावा सूचना (PMFBY Guidelines)",
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13),
                  ),
                ],
              ),
              SizedBox(height: 6),
              Text(
                "ओलावृष्टि, जलभराव, बादल फटना या बेमौसम वर्षा से फसल नुकसान होने के 72 घंटे के भीतर सूचना देना अनिवार्य है। आपके द्वारा दर्ज विवरण सीधे बीमा कंपनी व कृषि विभाग को भेजा जाएगा।",
                style: TextStyle(color: Color(0xFFFEE2E2), fontSize: 11, height: 1.35),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Policy & Crop Selection
              const Text("1. प्रभावित बीमित फसल चुनें (Select Insured Crop)", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _selectedPolicyId,
                    isExpanded: true,
                    items: policies.map((p) {
                      return DropdownMenuItem(
                        value: p.id,
                        child: Text(
                          "${p.vernacularCropName} • ${p.policyNumber}",
                          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                        ),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _selectedPolicyId = val);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // 2. Calamity Reason Grid
              const Text("2. आपदा / नुकसान का कारण चुनें (Calamity Type)", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
              const SizedBox(height: 8),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 8,
                  mainAxisSpacing: 8,
                  childAspectRatio: 2.2,
                ),
                itemCount: _calamityOptions.length,
                itemBuilder: (context, idx) {
                  final opt = _calamityOptions[idx];
                  final isSelected = _selectedCalamity == opt['name'];

                  return BouncyPressable(
                    onTap: () => setState(() => _selectedCalamity = opt['name'] as String),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFFFEF2F2) : Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected ? const Color(0xFFDC2626) : const Color(0xFFE2E8F0),
                          width: isSelected ? 1.8 : 1.0,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(opt['icon'] as IconData, size: 20, color: isSelected ? const Color(0xFFDC2626) : opt['color'] as Color),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              opt['name'] as String,
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                color: isSelected ? const Color(0xFF991B1B) : const Color(0xFF1E293B),
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 16),

              // 3. Date & Crop Stage
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text("आपदा तिथि (Date of Loss)", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade50,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: Colors.grey.shade300),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(_damageDate, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                              const Icon(Icons.calendar_today_rounded, size: 14, color: Color(0xFF047857)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text("फसल की अवस्था (Crop Stage)", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade50,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: Colors.grey.shade300),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              value: _cropStage,
                              isExpanded: true,
                              items: const [
                                DropdownMenuItem(value: "बुवाई / अंकुरण (Sowing)", child: Text("बुवाई/अंकुरण", style: TextStyle(fontSize: 11))),
                                DropdownMenuItem(value: "खड़ी फसल (Standing Crop)", child: Text("खड़ी फसल", style: TextStyle(fontSize: 11))),
                                DropdownMenuItem(value: "फूल व फल अवस्था (Flowering/Fruiting)", child: Text("फूल व फल", style: TextStyle(fontSize: 11))),
                                DropdownMenuItem(value: "कटाई पश्चात सुखाई (Post-Harvest Drying)", child: Text("कटाई पश्चात", style: TextStyle(fontSize: 11))),
                              ],
                              onChanged: (v) {
                                if (v != null) setState(() => _cropStage = v);
                              },
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // 4. Estimated Loss % Slider
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text("अनुमानित फसल क्षति (Estimated Loss)", style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(
                      color: _damagePercent > 70
                          ? const Color(0xFFDC2626)
                          : _damagePercent > 30
                              ? const Color(0xFFD97706)
                              : const Color(0xFF047857),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      "${_damagePercent.toInt()}% क्षति",
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 12),
                    ),
                  ),
                ],
              ),
              Slider(
                min: 10,
                max: 100,
                divisions: 18,
                value: _damagePercent,
                activeColor: _damagePercent > 70 ? const Color(0xFFDC2626) : const Color(0xFF047857),
                onChanged: (v) => setState(() => _damagePercent = v),
              ),
              const SizedBox(height: 10),

              // 5. Geo-Tagged Damage Photo Simulation
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFCBD5E1), style: BorderStyle.solid),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.camera_alt_rounded, color: Color(0xFF047857), size: 18),
                            SizedBox(width: 6),
                            Text("खेत की जियो-टैग्ड फोटो (GPS Photo)", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                          ],
                        ),
                        Text("2 फोटो संलग्न", style: TextStyle(color: Color(0xFF047857), fontSize: 10.5, fontWeight: FontWeight.w700)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.location_on_rounded, color: Color(0xFFDC2626), size: 16),
                          SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              "GPS: 19.8762° N, 75.3433° E • Survey No. 142/2-A (पिंपलगांव)",
                              style: TextStyle(fontSize: 10.5, color: Color(0xFF475569), fontWeight: FontWeight.w600),
                            ),
                          ),
                          Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 16),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Submit Claim Button
              ElevatedButton.icon(
                onPressed: () => _handleSubmitClaim(context),
                icon: const Icon(Icons.send_rounded, size: 16),
                label: const Text("दावा सूचना दर्ज करें (Submit Claim Intimation)", style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFDC2626),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 46),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 2,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _handleSubmitClaim(BuildContext context) {
    final selectedPol = widget.state.insurancePolicies.firstWhere(
      (p) => p.id == _selectedPolicyId,
      orElse: () => widget.state.insurancePolicies.first,
    );

    final estimatedClaimAmount = (selectedPol.sumInsured * (_damagePercent / 100));

    widget.state.submitCropClaim(
      policyId: selectedPol.id,
      cropName: selectedPol.cropName,
      vernacularCropName: selectedPol.vernacularCropName,
      calamityType: _selectedCalamity,
      dateOfDamage: _damageDate,
      estimatedLossPercent: _damagePercent.toInt(),
      requestedAmount: estimatedClaimAmount,
      gpsCoordinates: "19.8762° N, 75.3433° E",
      village: "${widget.state.profile.village}, ${widget.state.profile.district}",
      damagePhotos: const ["assets/loss_1.jpg", "assets/loss_2.jpg"],
    );

    setState(() {
      _selectedTab = 3; // jump to tracker tab to show live progress
    });
  }

  // ==========================================
  // TAB 3: Premium & Subsidy Calculator
  // ==========================================
  Widget _buildPremiumCalculatorTab(BuildContext context) {
    final rates = widget.state.cropInsuranceRates;
    final currentRate = rates.firstWhere(
      (r) => r.cropName.toLowerCase() == _calcCrop.toLowerCase(),
      orElse: () => rates.first,
    );

    final totalSumInsured = currentRate.sumInsuredPerAcre * _calcAcres;
    final farmerPremium = totalSumInsured * (currentRate.farmerSharePercent / 100);
    final totalActuarialPremium = totalSumInsured * (currentRate.totalActuarialRatePercent / 100);
    final govtSubsidy = totalActuarialPremium - farmerPremium;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          "PMFBY फसल बीमा प्रीमियम कैलकुलेटर",
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
        ),
        const SizedBox(height: 4),
        const Text(
          "खरीफ खाद्यान्न: 2% • रबी: 1.5% • बागवानी/वाणिज्यिक: 5% (शेष सब्सिडी सरकार द्वारा)",
          style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
        ),
        const SizedBox(height: 12),

        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Season Switcher
              Row(
                children: [
                  _buildSeasonChip("Kharif", "खरीफ (2%)"),
                  const SizedBox(width: 8),
                  _buildSeasonChip("Rabi", "रबी (1.5%)"),
                  const SizedBox(width: 8),
                  _buildSeasonChip("Annual", "बागवानी (5%)"),
                ],
              ),
              const SizedBox(height: 16),

              // Crop Dropdown
              const Text("फसल चुनें (Choose Crop)", style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _calcCrop,
                    isExpanded: true,
                    items: rates.map((r) {
                      return DropdownMenuItem(
                        value: r.cropName,
                        child: Text(
                          "${r.vernacularCropName} (${r.category})",
                          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                        ),
                      );
                    }).toList(),
                    onChanged: (v) {
                      if (v != null) {
                        setState(() {
                          _calcCrop = v;
                          final match = rates.firstWhere((r) => r.cropName == v);
                          _calcSeason = match.season;
                        });
                      }
                    },
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Acreage Slider
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text("जमीन रकबा (Land Area in Acres)", style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF047857),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      "${_calcAcres.toStringAsFixed(1)} एकड़",
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 12),
                    ),
                  ),
                ],
              ),
              Slider(
                min: 0.5,
                max: 20.0,
                divisions: 39,
                value: _calcAcres,
                activeColor: const Color(0xFF047857),
                onChanged: (v) => setState(() => _calcAcres = v),
              ),
              const SizedBox(height: 12),

              // Live Calculation Output Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF064E3B), Color(0xFF022C22)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text("कुल बीमित सुरक्षा राशि (Sum Insured):", style: TextStyle(color: Color(0xFFE2E8F0), fontSize: 12)),
                        Text(
                          "₹${totalSumInsured.toInt()}",
                          style: const TextStyle(color: Color(0xFFFDE68A), fontWeight: FontWeight.w900, fontSize: 18),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    const Divider(height: 1, color: Colors.white24),
                    const SizedBox(height: 10),

                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "किसान की देय प्रीमियम (${currentRate.farmerSharePercent}%)",
                              style: const TextStyle(color: Colors.white70, fontSize: 11),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              "₹${farmerPremium.toInt()}",
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18),
                            ),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            const Text("सरकारी सब्सिडी (Govt Share)", style: TextStyle(color: Color(0xFF86EFAC), fontSize: 11)),
                            const SizedBox(height: 2),
                            Text(
                              "₹${govtSubsidy.toInt()}",
                              style: const TextStyle(color: Color(0xFF86EFAC), fontWeight: FontWeight.w900, fontSize: 18),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text("आवेदन की अंतिम तिथि (Cutoff Date):", style: TextStyle(color: Color(0xFFE2E8F0), fontSize: 10.5)),
                          Text(currentRate.cutoffDate, style: const TextStyle(color: Color(0xFFFDE68A), fontWeight: FontWeight.w800, fontSize: 11)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              ElevatedButton.icon(
                onPressed: () => _openOfficialPmfbyModal(context),
                icon: const Icon(Icons.bolt_rounded, size: 16),
                label: const Text("PMFBY पोर्टल पर सीधे पॉलिसी जारी करें", style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF047857),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 44),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSeasonChip(String seasonKey, String label) {
    final isSelected = _calcSeason.toLowerCase() == seasonKey.toLowerCase();
    return Expanded(
      child: BouncyPressable(
        onTap: () => setState(() => _calcSeason = seasonKey),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF047857) : Colors.grey.shade100,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: isSelected ? const Color(0xFF047857) : Colors.grey.shade300),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: isSelected ? Colors.white : Colors.black87,
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ==========================================
  // TAB 4: Multi-Stage Claim Status Tracker
  // ==========================================
  Widget _buildClaimTrackerTab(BuildContext context) {
    final claims = widget.state.insuranceClaims;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          "दावा स्थिति व लाइव क्षति सत्यापन ट्रैकर",
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
        ),
        const SizedBox(height: 4),
        const Text(
          "सूचना दर्ज → सर्वेक्षक निरीक्षण → राज्य अनुमोदन → DBT बैंक अंतरण",
          style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
        ),
        const SizedBox(height: 12),

        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: claims.length,
          separatorBuilder: (ctx, i) => const SizedBox(height: 14),
          itemBuilder: (context, idx) {
            final clm = claims[idx];
            return StaggeredSlideFade(
              delayMs: idx * 60,
              duration: const Duration(milliseconds: 350),
              child: _buildClaimTrackerCard(context, clm),
            );
          },
        ),
      ],
    );
  }

  Widget _buildClaimTrackerCard(BuildContext context, InsuranceClaimRecord clm) {
    final isDisbursed = clm.status == ClaimStatus.disbursed;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: isDisbursed ? const Color(0xFF86EFAC) : const Color(0xFFE2E8F0), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Claim Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFBFDBFE)),
                        ),
                        child: Text(
                          clm.claimNumber,
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5, color: Color(0xFF1E40AF), fontFamily: 'monospace'),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(clm.submittedAt, style: const TextStyle(fontSize: 10, color: Colors.grey)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    clm.vernacularCropName,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    isDisbursed ? "स्वीकृत मुआवजा राशि" : "अनुमानित दावा",
                    style: const TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.w600),
                  ),
                  Text(
                    "₹${(clm.approvedAmount ?? clm.requestedAmount).toInt()}",
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                      color: isDisbursed ? const Color(0xFF047857) : const Color(0xFFDC2626),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Calamity pill & Damage percentage
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.thunderstorm_rounded, size: 14, color: Color(0xFFDC2626)),
                    const SizedBox(width: 6),
                    Text(
                      clm.calamityType,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF991B1B)),
                    ),
                  ],
                ),
                Text(
                  "${clm.estimatedLossPercent}% फसल क्षति",
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFDC2626)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // 4-Stage Step Timeline Indicator
          _buildStepTimeline(clm),
          const SizedBox(height: 14),

          // Surveyor / Loss Assessor Contact Box
          if (clm.surveyorName.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                children: [
                  const CircleAvatar(
                    radius: 18,
                    backgroundColor: Color(0xFF047857),
                    child: Icon(Icons.person_pin_rounded, color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(clm.surveyorName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                        Text(
                          clm.surveyorVisitDate ?? "खेत दौरा शीघ्र",
                          style: const TextStyle(fontSize: 10.5, color: Color(0xFF047857), fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                  BouncyPressable(
                    onTap: () => widget.state.showToast("📞 सर्वेक्षक ${clm.surveyorName} को कॉल मिलाई जा रही है..."),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: const BoxDecoration(
                        color: Color(0xFF047857),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.call_rounded, color: Colors.white, size: 16),
                    ),
                  ),
                ],
              ),
            ),

          if (isDisbursed && clm.dbtTransactionId != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF86EFAC)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.verified_rounded, color: Color(0xFF16A34A), size: 16),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      "DBT ट्रांसफर पूर्ण: A/C ending **${clm.bankAccountLast4} | Txn: ${clm.dbtTransactionId}",
                      style: const TextStyle(fontSize: 10.5, color: Color(0xFF166534), fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStepTimeline(InsuranceClaimRecord clm) {
    int currentStep = 1;
    if (clm.status == ClaimStatus.intimated) currentStep = 1;
    if (clm.status == ClaimStatus.surveyorAssigned) currentStep = 2;
    if (clm.status == ClaimStatus.fieldAssessed) currentStep = 3;
    if (clm.status == ClaimStatus.disbursed) currentStep = 4;

    final steps = [
      'सूचना दर्ज',
      'सर्वेक्षक',
      'सत्यापन',
      'DBT भुगतान',
    ];

    return Row(
      children: List.generate(steps.length, (idx) {
        final stepNum = idx + 1;
        final isDone = stepNum <= currentStep;
        final isCurrent = stepNum == currentStep;

        return Expanded(
          child: Row(
            children: [
              Expanded(
                child: Column(
                  children: [
                    Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        color: isDone ? const Color(0xFF047857) : Colors.grey.shade200,
                        shape: BoxShape.circle,
                        border: isCurrent ? Border.all(color: const Color(0xFFFBBF24), width: 2) : null,
                      ),
                      child: Center(
                        child: isDone
                            ? const Icon(Icons.check_rounded, color: Colors.white, size: 14)
                            : Text("$stepNum", style: const TextStyle(fontSize: 10, color: Colors.black54, fontWeight: FontWeight.w700)),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      steps[idx],
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: isDone ? FontWeight.w800 : FontWeight.w500,
                        color: isDone ? const Color(0xFF047857) : Colors.grey.shade500,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
              if (idx < steps.length - 1)
                Container(
                  height: 2,
                  width: 14,
                  color: (idx + 1 < currentStep) ? const Color(0xFF047857) : Colors.grey.shade300,
                ),
            ],
          ),
        );
      }),
    );
  }

  // Official PMFBY Portal Launcher Modal with Security Banner
  void _openOfficialPmfbyModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Container(
        height: MediaQuery.of(context).size.height * 0.75,
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFE8F5E9),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFA5D6A7)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.security_rounded, color: Color(0xFF2E7D32), size: 22),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      "🛡️ सुरक्षा सूचना: आप भारत सरकार के आधिकारिक PMFBY पोर्टल (pmfby.gov.in) पर रीडायरेक्ट हो रहे हैं।",
                      style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF1B4332)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              "आधिकारिक पोर्टल सेवाएं (Official PMFBY Services)",
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 12),
            _buildOfficialActionTile(
              "किसान कॉर्नर (Farmer Corner)",
              "सीधा ऑनलाइन आवेदन, KCC लिंकेज व प्रीमियम भुगतान",
              Icons.person_add_alt_1_rounded,
              () {
                Navigator.pop(ctx);
                widget.state.showToast("🌐 PMFBY Farmer Corner पोर्टल लोड हो रहा है...");
              },
            ),
            _buildOfficialActionTile(
              "पॉलिसी स्टेटस ट्रैक करें (Track Policy)",
              "आवेदन क्रमांक अथवा बैंक खाता नंबर द्वारा खोजें",
              Icons.search_rounded,
              () {
                Navigator.pop(ctx);
                widget.state.showToast("🔍 राष्ट्रीय फसल बीमा पोर्टल पर स्टेटस ट्रैक किया जा रहा है...");
              },
            ),
            _buildOfficialActionTile(
              "बीमा शिकायत निवारण (Grievance Redressal)",
              "दावे में देरी अथवा विवाद हेतु शिकायत दर्ज करें",
              Icons.support_agent_rounded,
              () {
                Navigator.pop(ctx);
                widget.state.showToast("📝 राज्य स्तरीय फसल बीमा लोकपाल पोर्टल खुला...");
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOfficialActionTile(String title, String subtitle, IconData icon, VoidCallback onTap) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: const Color(0xFF047857),
          child: Icon(icon, color: Colors.white, size: 20),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
        subtitle: Text(subtitle, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
        trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: Color(0xFF047857)),
        onTap: onTap,
      ),
    );
  }
}
