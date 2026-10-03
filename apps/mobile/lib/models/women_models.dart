// Women Farmer hub models — fields match GET /v1/women/shg and
// GET /v1/women/home-enterprise (Day 14 Task A1).

class ShgProfile {
  final int memberCount;
  final double corpus;
  final double loanFund;
  final double monthlyDeposit;

  const ShgProfile({
    required this.memberCount,
    required this.corpus,
    required this.loanFund,
    required this.monthlyDeposit,
  });

  ShgProfile copyWith({double? corpus}) => ShgProfile(
        memberCount: memberCount,
        corpus: corpus ?? this.corpus,
        loanFund: loanFund,
        monthlyDeposit: monthlyDeposit,
      );

  factory ShgProfile.fromJson(Map<String, dynamic> json) => ShgProfile(
        memberCount: (json['memberCount'] as num?)?.toInt() ?? 0,
        corpus: (json['corpus'] as num?)?.toDouble() ?? 0,
        loanFund: (json['loanFund'] as num?)?.toDouble() ?? 0,
        monthlyDeposit: (json['monthlyDeposit'] as num?)?.toDouble() ?? 0,
      );
}

class EnterpriseLine {
  final String product;
  final double monthlyProfit;

  const EnterpriseLine({required this.product, required this.monthlyProfit});

  factory EnterpriseLine.fromJson(Map<String, dynamic> json) => EnterpriseLine(
        product: json['product'] as String? ?? '',
        monthlyProfit: (json['monthlyProfit'] as num?)?.toDouble() ?? 0,
      );
}

class HomeEnterpriseSummary {
  final List<EnterpriseLine> lines;
  final double totalMonthlyProfit;

  const HomeEnterpriseSummary({
    required this.lines,
    required this.totalMonthlyProfit,
  });

  factory HomeEnterpriseSummary.fromJson(Map<String, dynamic> json) =>
      HomeEnterpriseSummary(
        lines: ((json['lines'] as List?) ?? const <dynamic>[])
            .map(
                (e) => EnterpriseLine.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
        totalMonthlyProfit:
            (json['totalMonthlyProfit'] as num?)?.toDouble() ?? 0,
      );
}

// Kitchen-garden & backyard-livestock models — fields match
// GET /v1/women/garden-plans and GET /v1/women/backyard-livestock.

class GardenPlanItem {
  final String name;
  final String vernacularName;
  final String nutrition;
  final String companion;
  final int daysToHarvest;

  const GardenPlanItem({
    required this.name,
    required this.vernacularName,
    required this.nutrition,
    required this.companion,
    required this.daysToHarvest,
  });

  factory GardenPlanItem.fromJson(Map<String, dynamic> json) => GardenPlanItem(
        name: json['name'] as String? ?? '',
        vernacularName: json['vernacularName'] as String? ?? '',
        nutrition: json['nutrition'] as String? ?? '',
        companion: json['companion'] as String? ?? '',
        daysToHarvest: (json['daysToHarvest'] as num?)?.toInt() ?? 0,
      );
}

class GardenPlan {
  final String id;
  final String category;
  final List<GardenPlanItem> items;

  const GardenPlan({
    required this.id,
    required this.category,
    required this.items,
  });

  factory GardenPlan.fromJson(Map<String, dynamic> json) => GardenPlan(
        id: json['id'] as String? ?? '',
        category: json['category'] as String? ?? '',
        items: ((json['items'] as List?) ?? const <dynamic>[])
            .map((e) =>
                GardenPlanItem.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
      );
}

class BackyardLivestock {
  final String id;
  final String animal;
  final String vernacularName;
  final int count;
  final String yieldLabel;
  final String vaccine;
  final String vaccineDue;

  const BackyardLivestock({
    required this.id,
    required this.animal,
    required this.vernacularName,
    required this.count,
    required this.yieldLabel,
    required this.vaccine,
    required this.vaccineDue,
  });

  factory BackyardLivestock.fromJson(Map<String, dynamic> json) =>
      BackyardLivestock(
        id: json['id'] as String? ?? '',
        animal: json['animal'] as String? ?? '',
        vernacularName: json['vernacularName'] as String? ?? '',
        count: (json['count'] as num?)?.toInt() ?? 0,
        yieldLabel: json['yieldLabel'] as String? ?? '',
        vaccine: json['vaccine'] as String? ?? '',
        vaccineDue: json['vaccineDue'] as String? ?? '',
      );
}
