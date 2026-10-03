import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../api/admin_api.dart';

final _inr = NumberFormat('#,##,###', 'en_IN');

class DashboardView extends StatefulWidget {
  const DashboardView({super.key});

  @override
  State<DashboardView> createState() => _DashboardViewState();
}

class _DashboardViewState extends State<DashboardView> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<AdminApi>().getAnalytics();
  }

  int _num(Map<String, dynamic> m, String key) =>
      (m[key] as num?)?.toInt() ?? 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('डैशबोर्ड')),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snap) {
          if (snap.hasError) {
            return const Center(child: Text('लोड विफल — पुनः प्रयास करें'));
          }
          if (!snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final d = snap.data!;
          final personas = (d['usersByPersona'] as Map?) ?? {};
          final bookings = (d['bookings'] as Map?) ?? {};
          final orders = (d['orders'] as Map?) ?? {};
          final claims = (d['claimsByStatus'] as Map?) ?? {};
          final totalBookings = _num(bookings.cast(), 'equipment') +
              _num(bookings.cast(), 'vet') +
              _num(bookings.cast(), 'transport');
          final pendingClaims = _num(claims.cast(), 'intimated') +
              _num(claims.cast(), 'surveyorAssigned') +
              _num(claims.cast(), 'fieldAssessed') +
              _num(claims.cast(), 'dbtApproved');
          final cards = <(String, String)>[
            ('कुल उपयोगकर्ता', _inr.format(_num(d, 'totalUsers'))),
            ('किसान', _inr.format(_num(personas.cast(), 'farmer'))),
            ('कुल बुकिंग', _inr.format(totalBookings)),
            ('ऑर्डर GMV', '₹${_inr.format(_num(orders.cast(), 'gmv'))}'),
            ('लंबित दरें', _inr.format(_num(d, 'pendingRates'))),
            ('लंबित दावे', _inr.format(pendingClaims)),
          ];
          return GridView.count(
            crossAxisCount: 3,
            childAspectRatio: 2.2,
            padding: const EdgeInsets.all(16),
            children: [
              for (final c in cards)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(c.$1,
                            style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 8),
                        Text(
                          c.$2,
                          style: Theme.of(context).textTheme.headlineMedium,
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
