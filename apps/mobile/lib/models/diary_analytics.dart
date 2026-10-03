// Diary analytics models — mirror GET /diary/analytics/summary exactly.

double _d(dynamic v) => v is num ? v.toDouble() : 0;
int _i(dynamic v) => v is num ? v.toInt() : 0;

class DiaryAnalytics {
  final String? from; // YYYY-MM-DD or null = all time
  final String? to;
  final DiaryTotals totals;
  final List<CategorySummary> byCategory; // sorted amount desc
  final List<CropSummary> byCrop; // sorted net desc
  final List<MonthSummary> byMonth; // sorted ascending
  final List<DaySummary> byDay; // sorted ascending

  const DiaryAnalytics({
    this.from,
    this.to,
    this.totals = const DiaryTotals(),
    this.byCategory = const [],
    this.byCrop = const [],
    this.byMonth = const [],
    this.byDay = const [],
  });

  factory DiaryAnalytics.fromJson(Map<String, dynamic> json) => DiaryAnalytics(
        from: json['from'] as String?,
        to: json['to'] as String?,
        totals: json['totals'] is Map
            ? DiaryTotals.fromJson(
                (json['totals'] as Map).cast<String, dynamic>(),
              )
            : const DiaryTotals(),
        byCategory: _parseList(json['byCategory'], CategorySummary.fromJson),
        byCrop: _parseList(json['byCrop'], CropSummary.fromJson),
        byMonth: _parseList(json['byMonth'], MonthSummary.fromJson),
        byDay: _parseList(json['byDay'], DaySummary.fromJson),
      );

  static List<T> _parseList<T>(
    dynamic raw,
    T Function(Map<String, dynamic>) fromJson,
  ) =>
      (raw is List ? raw : const <dynamic>[])
          .whereType<Map>()
          .map((e) => fromJson(e.cast<String, dynamic>()))
          .toList();
}

class DiaryTotals {
  final double income;
  final double expense;
  final double net;
  final int entryCount;
  final int incomeCount;
  final int expenseCount;
  final int activityCount;

  const DiaryTotals({
    this.income = 0,
    this.expense = 0,
    this.net = 0,
    this.entryCount = 0,
    this.incomeCount = 0,
    this.expenseCount = 0,
    this.activityCount = 0,
  });

  factory DiaryTotals.fromJson(Map<String, dynamic> json) => DiaryTotals(
        income: _d(json['income']),
        expense: _d(json['expense']),
        net: _d(json['net']),
        entryCount: _i(json['entryCount']),
        incomeCount: _i(json['incomeCount']),
        expenseCount: _i(json['expenseCount']),
        activityCount: _i(json['activityCount']),
      );
}

class CategorySummary {
  final String category;
  final String type; // "expense" | "income"
  final double amount;
  final int count;

  const CategorySummary({
    this.category = '',
    this.type = '',
    this.amount = 0,
    this.count = 0,
  });

  factory CategorySummary.fromJson(Map<String, dynamic> json) =>
      CategorySummary(
        category: json['category'] as String? ?? '',
        type: json['type'] as String? ?? '',
        amount: _d(json['amount']),
        count: _i(json['count']),
      );
}

class CropSummary {
  final String cropName; // null crop on the backend arrives as "अन्य"
  final double income;
  final double expense;
  final double net;
  final int count;

  const CropSummary({
    this.cropName = '',
    this.income = 0,
    this.expense = 0,
    this.net = 0,
    this.count = 0,
  });

  factory CropSummary.fromJson(Map<String, dynamic> json) => CropSummary(
        cropName: json['cropName'] as String? ?? '',
        income: _d(json['income']),
        expense: _d(json['expense']),
        net: _d(json['net']),
        count: _i(json['count']),
      );
}

class MonthSummary {
  final String month; // "YYYY-MM"
  final double income;
  final double expense;
  final double net;
  final int count;

  const MonthSummary({
    this.month = '',
    this.income = 0,
    this.expense = 0,
    this.net = 0,
    this.count = 0,
  });

  factory MonthSummary.fromJson(Map<String, dynamic> json) => MonthSummary(
        month: json['month'] as String? ?? '',
        income: _d(json['income']),
        expense: _d(json['expense']),
        net: _d(json['net']),
        count: _i(json['count']),
      );
}

class DaySummary {
  final String date; // "YYYY-MM-DD"
  final double income;
  final double expense;
  final int count;

  const DaySummary({
    this.date = '',
    this.income = 0,
    this.expense = 0,
    this.count = 0,
  });

  factory DaySummary.fromJson(Map<String, dynamic> json) => DaySummary(
        date: json['date'] as String? ?? '',
        income: _d(json['income']),
        expense: _d(json['expense']),
        count: _i(json['count']),
      );
}
