import 'package:flutter/material.dart';

import '../core/auth.dart';
import 'broadcast_view.dart';
import 'claims_view.dart';
import 'content_cms_view.dart';
import 'courses_admin_view.dart';
import 'dashboard_view.dart';
import 'emarket_analytics_view.dart';
import 'expert_handoff_view.dart';
import 'finance_loans_view.dart';
import 'kyc_queue_view.dart';
import 'omni_persona_view.dart';
import 'rate_approvals_view.dart';
import 'reports_view.dart';
import 'settlements_view.dart';
import 'users_view.dart';

class AdminShell extends StatefulWidget {
  const AdminShell({super.key, required this.auth, required this.onSignedOut});

  final AdminAuth auth;
  final VoidCallback onSignedOut;

  @override
  State<AdminShell> createState() => _AdminShellState();
}

class _AdminShellState extends State<AdminShell> {
  int _index = 0;

  static const _destinations = [
    (Icons.dashboard, 'डैशबोर्ड'),
    (Icons.storefront, 'ई-मार्केट'),
    (Icons.hub, 'मल्टी-पर्सोना'),
    (Icons.medical_services, 'कृषि विशेषज्ञ'),
    (Icons.check_circle, 'दर अनुमोदन'),
    (Icons.article, 'कंटेंट'),
    (Icons.people, 'उपयोगकर्ता'),
    (Icons.school, 'कोर्स'),
    (Icons.assignment, 'दावे'),
    (Icons.verified_user, 'KYC कतार'),
    (Icons.campaign, 'प्रसारण'),
    (Icons.payments, 'निपटान'),
    (Icons.account_balance, 'ऋण / वित्त'),
    (Icons.flag, 'रिपोर्ट'),
  ];

  static const _views = [
    DashboardView(),
    EmarketAnalyticsView(),
    OmniPersonaView(),
    ExpertHandoffView(),
    RateApprovalsView(),
    ContentCmsView(),
    UsersView(),
    CoursesAdminView(),
    ClaimsView(),
    KycQueueView(),
    BroadcastView(),
    SettlementsView(),
    FinanceLoansView(),
    ReportsView(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            selectedIndex: _index,
            onDestinationSelected: (i) => setState(() => _index = i),
            labelType: NavigationRailLabelType.all,
            destinations: [
              for (final d in _destinations)
                NavigationRailDestination(
                  icon: Icon(d.$1),
                  label: Text(d.$2),
                ),
            ],
            trailing: Expanded(
              child: Align(
                alignment: Alignment.bottomCenter,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: IconButton(
                    icon: const Icon(Icons.logout),
                    tooltip: 'लॉगआउट',
                    onPressed: widget.onSignedOut,
                  ),
                ),
              ),
            ),
          ),
          const VerticalDivider(width: 1),
          Expanded(child: _views[_index]),
        ],
      ),
    );
  }
}
