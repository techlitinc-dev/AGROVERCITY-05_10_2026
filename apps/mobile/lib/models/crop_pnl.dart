class CropPandL {
  final String id;
  final String name;
  final String season;
  final double area;
  final double yieldQuintals;
  final double marketAvgRate;
  final double grossRevenue;
  final double totalExpenses;
  final double netProfit;
  final double roiPercent;
  final List<Map<String, dynamic>> expensesBreakdown;

  const CropPandL({
    required this.id,
    required this.name,
    required this.season,
    required this.area,
    required this.yieldQuintals,
    required this.marketAvgRate,
    required this.grossRevenue,
    required this.totalExpenses,
    required this.netProfit,
    required this.roiPercent,
    required this.expensesBreakdown,
  });

  factory CropPandL.fromJson(Map<String, dynamic> json) => CropPandL(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        season: json['season'] as String? ?? '',
        area: (json['area'] as num?)?.toDouble() ?? 0,
        yieldQuintals: (json['yieldQuintals'] as num?)?.toDouble() ?? 0,
        marketAvgRate: (json['marketAvgRate'] as num?)?.toDouble() ?? 0,
        grossRevenue: (json['grossRevenue'] as num?)?.toDouble() ?? 0,
        totalExpenses: (json['totalExpenses'] as num?)?.toDouble() ?? 0,
        netProfit: (json['netProfit'] as num?)?.toDouble() ?? 0,
        roiPercent: (json['roiPercent'] as num?)?.toDouble() ?? 0,
        expensesBreakdown:
            ((json['expensesBreakdown'] as List?) ?? const <dynamic>[])
                .map((e) => (e as Map).cast<String, dynamic>())
                .toList(),
      );
}
