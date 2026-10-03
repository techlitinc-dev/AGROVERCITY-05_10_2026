import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../api/admin_api.dart';

final _inr = NumberFormat('#,##,###', 'en_IN');

const _statusLabels = {
  'placed': 'दर्ज',
  'confirmed': 'पुष्ट',
  'shipped': 'भेजा गया',
  'out_for_delivery': 'डिलीवरी हेतु रवाना',
  'delivered': 'डिलीवर हुए',
  'cancelled': 'रद्द',
  'returned': 'रिटर्न',
};

class EmarketAnalyticsView extends StatefulWidget {
  const EmarketAnalyticsView({super.key});

  @override
  State<EmarketAnalyticsView> createState() => _EmarketAnalyticsViewState();
}

class _EmarketAnalyticsViewState extends State<EmarketAnalyticsView> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<AdminApi>().getEmarketAnalytics();
  }

  int _num(Map<String, dynamic> m, String key) =>
      (m[key] as num?)?.toInt() ?? 0;

  List<Map<String, dynamic>> _list(Map<String, dynamic> d, String key) =>
      ((d[key] as List?) ?? [])
          .map((e) => (e as Map).cast<String, dynamic>())
          .toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ई-मार्केट एनालिटिक्स')),
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
          final coupons = (d['couponUsage'] as Map?)?.cast<String, dynamic>() ??
              const <String, dynamic>{};
          final cards = <(String, String)>[
            ('कुल बिक्री (GMV)', '₹${_inr.format(_num(d, 'gmv'))}'),
            ('कुल ऑर्डर', _inr.format(_num(d, 'totalOrders'))),
            ('ग्राहक', _inr.format(_num(d, 'totalCustomers'))),
            ('विक्रेता', _inr.format(_num(d, 'totalSellers'))),
            ('औसत ऑर्डर मूल्य', '₹${_inr.format(_num(d, 'aov'))}'),
            (
              'रिटर्न दर',
              '${((((d['returnRate'] as num?) ?? 0) * 100)).toStringAsFixed(1)}%'
            ),
            ('कूपन जारी', _inr.format(_num(coupons, 'issued'))),
            ('कूपन उपयोग', _inr.format(_num(coupons, 'used'))),
          ];
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              GridView.count(
                crossAxisCount: 4,
                childAspectRatio: 2.2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
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
                                style:
                                    Theme.of(context).textTheme.titleMedium),
                            const SizedBox(height: 8),
                            Text(c.$2,
                                style: Theme.of(context)
                                    .textTheme
                                    .headlineMedium),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
              _section('मासिक बिक्री (12 माह)', _monthlyGmv(d)),
              _section('ऑर्डर स्थिति', _ordersByStatus(d)),
              _section('श्रेणी हिस्सा', _categoryShare(d)),
              _section('शीर्ष उत्पाद', _table(d, 'topProducts', 'उत्पाद')),
              _section('शीर्ष विक्रेता', _table(d, 'topSellers', 'विक्रेता')),
            ],
          );
        },
      ),
    );
  }

  Widget _section(String title, Widget child) {
    return Card(
      margin: const EdgeInsets.only(top: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            child,
          ],
        ),
      ),
    );
  }

  Widget _empty() => const Center(child: Text('डेटा उपलब्ध नहीं'));

  Widget _monthlyGmv(Map<String, dynamic> d) {
    final rows = _list(d, 'monthlyGmv');
    final max = rows.fold<int>(
        0, (m, r) => _num(r, 'amount') > m ? _num(r, 'amount') : m);
    if (max == 0) return _empty();
    return SizedBox(
      height: 220,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (final r in rows)
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text('₹${_inr.format(_num(r, 'amount'))}',
                      style: Theme.of(context).textTheme.bodySmall),
                  const SizedBox(height: 4),
                  Container(
                    height: 160 * (_num(r, 'amount') / max),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${'${r['month']}'.substring(5)}/${'${r['month']}'.substring(2, 4)}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _barRow(String label, int value, int max, String trailing) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 160,
            child: Text(label, overflow: TextOverflow.ellipsis),
          ),
          Expanded(
            child: Container(
              height: 20,
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              child: FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: max == 0 ? 0 : value / max,
                child: ColoredBox(
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
            ),
          ),
          SizedBox(
            width: 90,
            child: Text(trailing, textAlign: TextAlign.right),
          ),
        ],
      ),
    );
  }

  Widget _ordersByStatus(Map<String, dynamic> d) {
    final m = (d['ordersByStatus'] as Map?)?.cast<String, dynamic>() ??
        const <String, dynamic>{};
    if (m.isEmpty) return _empty();
    final max = m.values.fold<int>(
        0, (a, b) => ((b as num?)?.toInt() ?? 0) > a ? (b as num).toInt() : a);
    return Column(
      children: [
        for (final e in m.entries)
          _barRow(
            _statusLabels[e.key] ?? e.key,
            (e.value as num?)?.toInt() ?? 0,
            max,
            _inr.format((e.value as num?)?.toInt() ?? 0),
          ),
      ],
    );
  }

  Widget _categoryShare(Map<String, dynamic> d) {
    final rows = _list(d, 'categoryShare');
    final total = rows.fold<int>(0, (t, r) => t + _num(r, 'revenue'));
    if (rows.isEmpty || total == 0) return _empty();
    return Column(
      children: [
        for (final r in rows)
          _barRow(
            '${r['category']}',
            _num(r, 'revenue'),
            total,
            '${(_num(r, 'revenue') / total * 100).toStringAsFixed(1)}%',
          ),
      ],
    );
  }

  Widget _table(Map<String, dynamic> d, String key, String nameCol) {
    final rows = _list(d, key);
    if (rows.isEmpty) return _empty();
    return SizedBox(
      width: double.infinity,
      child: DataTable(
        columns: [
          DataColumn(label: Text(nameCol)),
          const DataColumn(label: Text('राजस्व')),
          const DataColumn(label: Text('ऑर्डर')),
        ],
        rows: [
          for (final r in rows)
            DataRow(cells: [
              DataCell(Text('${r['title'] ?? r['name'] ?? ''}')),
              DataCell(Text('₹${_inr.format(_num(r, 'revenue'))}')),
              DataCell(Text(_inr.format(_num(r, 'orders')))),
            ]),
        ],
      ),
    );
  }
}
