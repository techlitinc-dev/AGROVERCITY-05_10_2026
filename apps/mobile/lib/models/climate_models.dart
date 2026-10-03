// Climate models — fields match GET /v1/climate/carbon-potential and
// GET /v1/climate/resilient-varieties (Day 14 Task A2).

class CarbonPotential {
  final double co2eTonnes;
  final double annualIncomePotential;
  final List<String> practices;

  const CarbonPotential({
    required this.co2eTonnes,
    required this.annualIncomePotential,
    required this.practices,
  });

  factory CarbonPotential.fromJson(Map<String, dynamic> json) =>
      CarbonPotential(
        co2eTonnes: (json['co2eTonnes'] as num?)?.toDouble() ?? 0,
        annualIncomePotential:
            (json['annualIncomePotential'] as num?)?.toDouble() ?? 0,
        practices: ((json['practices'] as List?) ?? const <dynamic>[])
            .map((e) => "$e")
            .toList(),
      );
}

class ResilientVariety {
  final String variety;
  final String crop;
  final String trait;
  final String source;

  const ResilientVariety({
    required this.variety,
    required this.crop,
    required this.trait,
    required this.source,
  });

  factory ResilientVariety.fromJson(Map<String, dynamic> json) =>
      ResilientVariety(
        variety: json['variety'] as String? ?? '',
        crop: json['crop'] as String? ?? '',
        trait: json['trait'] as String? ?? '',
        source: json['source'] as String? ?? '',
      );
}
