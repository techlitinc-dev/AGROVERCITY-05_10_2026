// Direct-buyer models — demands, offers, purchases, analytics, saved
// farmers, feed lots (fields match the /v1 direct-buyer contract).

class Demand {
  final String id;
  final String buyerId;
  final String buyerName;
  final String buyerCompany;
  final String state;
  final String crop;
  final String variety;
  final double quantity;
  final String unit;
  final String qualityGrade;
  final int maxPrice;
  final String packaging;
  final String deliveryLocation;
  final String neededBy;
  final String frequency;
  final String notes;
  final String status;
  final int offersCount;
  final String createdAt;
  final String updatedAt;

  const Demand({
    required this.id,
    required this.buyerId,
    required this.buyerName,
    required this.buyerCompany,
    required this.state,
    required this.crop,
    required this.variety,
    required this.quantity,
    required this.unit,
    required this.qualityGrade,
    required this.maxPrice,
    required this.packaging,
    required this.deliveryLocation,
    required this.neededBy,
    required this.frequency,
    required this.notes,
    required this.status,
    required this.offersCount,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Demand.fromJson(Map<String, dynamic> json) => Demand(
        id: json['id'] as String? ?? '',
        buyerId: json['buyerId'] as String? ?? '',
        buyerName: json['buyerName'] as String? ?? '',
        buyerCompany: json['buyerCompany'] as String? ?? '',
        state: json['state'] as String? ?? '',
        crop: json['crop'] as String? ?? '',
        variety: json['variety'] as String? ?? '',
        quantity: (json['quantity'] as num?)?.toDouble() ?? 0,
        unit: json['unit'] as String? ?? 'quintal',
        qualityGrade: json['qualityGrade'] as String? ?? 'A',
        maxPrice: (json['maxPrice'] as num?)?.toInt() ?? 0,
        packaging: json['packaging'] as String? ?? '',
        deliveryLocation: json['deliveryLocation'] as String? ?? '',
        neededBy: json['neededBy'] as String? ?? '',
        frequency: json['frequency'] as String? ?? 'oneTime',
        notes: json['notes'] as String? ?? '',
        status: json['status'] as String? ?? 'open',
        offersCount: (json['offersCount'] as num?)?.toInt() ?? 0,
        createdAt: json['createdAt'] as String? ?? '',
        updatedAt: json['updatedAt'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {
        'crop': crop,
        'variety': variety,
        'quantity': quantity,
        'unit': unit,
        'qualityGrade': qualityGrade,
        'maxPrice': maxPrice,
        'packaging': packaging,
        'deliveryLocation': deliveryLocation,
        'neededBy': neededBy,
        'frequency': frequency,
        'notes': notes,
      };
}

class OfferCounter {
  final int pricePerUnit;
  final String by;
  final String note;
  final String at;

  const OfferCounter({
    required this.pricePerUnit,
    required this.by,
    required this.note,
    required this.at,
  });

  factory OfferCounter.fromJson(Map<String, dynamic> json) => OfferCounter(
        pricePerUnit: (json['pricePerUnit'] as num?)?.toInt() ?? 0,
        by: json['by'] as String? ?? '',
        note: json['note'] as String? ?? '',
        at: json['at'] as String? ?? '',
      );
}

class Offer {
  final String id;
  final String targetType;
  final String targetId;
  final String fromId;
  final String fromName;
  final String fromRole;
  final String toId;
  final String toName;
  final int pricePerUnit;
  final double quantity;
  final String unit;
  final String message;
  final String status;
  final OfferCounter? counter;
  final String createdAt;
  final String updatedAt;

  const Offer({
    required this.id,
    required this.targetType,
    required this.targetId,
    required this.fromId,
    required this.fromName,
    required this.fromRole,
    required this.toId,
    required this.toName,
    required this.pricePerUnit,
    required this.quantity,
    required this.unit,
    required this.message,
    required this.status,
    required this.counter,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get isLive => status == 'pending' || status == 'countered';

  factory Offer.fromJson(Map<String, dynamic> json) => Offer(
        id: json['id'] as String? ?? '',
        targetType: json['targetType'] as String? ?? 'demand',
        targetId: json['targetId'] as String? ?? '',
        fromId: json['fromId'] as String? ?? '',
        fromName: json['fromName'] as String? ?? '',
        fromRole: json['fromRole'] as String? ?? '',
        toId: json['toId'] as String? ?? '',
        toName: json['toName'] as String? ?? '',
        pricePerUnit: (json['pricePerUnit'] as num?)?.toInt() ?? 0,
        quantity: (json['quantity'] as num?)?.toDouble() ?? 0,
        unit: json['unit'] as String? ?? 'quintal',
        message: json['message'] as String? ?? '',
        status: json['status'] as String? ?? 'pending',
        counter: (json['counter'] as Map?) == null
            ? null
            : OfferCounter.fromJson(
                (json['counter'] as Map).cast<String, dynamic>()),
        createdAt: json['createdAt'] as String? ?? '',
        updatedAt: json['updatedAt'] as String? ?? '',
      );
}

class PurchasePayment {
  final String id;
  final String kind;
  final int amount;
  final String method;
  final String reference;
  final String at;

  const PurchasePayment({
    required this.id,
    required this.kind,
    required this.amount,
    required this.method,
    required this.reference,
    required this.at,
  });

  factory PurchasePayment.fromJson(Map<String, dynamic> json) =>
      PurchasePayment(
        id: json['id'] as String? ?? '',
        kind: json['kind'] as String? ?? '',
        amount: (json['amount'] as num?)?.toInt() ?? 0,
        method: json['method'] as String? ?? '',
        reference: json['reference'] as String? ?? '',
        at: json['at'] as String? ?? '',
      );
}

class PurchaseEvent {
  final String status;
  final String at;
  final String note;

  const PurchaseEvent({
    required this.status,
    required this.at,
    required this.note,
  });

  factory PurchaseEvent.fromJson(Map<String, dynamic> json) => PurchaseEvent(
        status: json['status'] as String? ?? '',
        at: json['at'] as String? ?? '',
        note: json['note'] as String? ?? '',
      );
}

class Purchase {
  final String id;
  final String buyerId;
  final String buyerName;
  final String farmerId;
  final String farmerName;
  final String sourceType;
  final String sourceRefId;
  final String crop;
  final String variety;
  final double quantity;
  final String unit;
  final int agreedPricePerUnit;
  final int totalAmount;
  final int advancePaid;
  final String status;
  final Map<String, dynamic> pickup;
  final List<PurchasePayment> payments;
  final Map<String, dynamic> qc;
  final int? finalAmount;
  final Map<String, dynamic>? invoice;
  final List<PurchaseEvent> events;
  final Map<String, dynamic> rating;
  final String createdAt;
  final String updatedAt;

  const Purchase({
    required this.id,
    required this.buyerId,
    required this.buyerName,
    required this.farmerId,
    required this.farmerName,
    required this.sourceType,
    required this.sourceRefId,
    required this.crop,
    required this.variety,
    required this.quantity,
    required this.unit,
    required this.agreedPricePerUnit,
    required this.totalAmount,
    required this.advancePaid,
    required this.status,
    required this.pickup,
    required this.payments,
    required this.qc,
    required this.finalAmount,
    required this.invoice,
    required this.events,
    required this.rating,
    required this.createdAt,
    required this.updatedAt,
  });

  int get paidTotal =>
      payments.fold(0, (sum, p) => sum + p.amount);

  int get amountDue =>
      (finalAmount ?? totalAmount) - paidTotal;

  factory Purchase.fromJson(Map<String, dynamic> json) {
    final source = (json['source'] as Map?) ?? const {};
    return Purchase(
      id: json['id'] as String? ?? '',
      buyerId: json['buyerId'] as String? ?? '',
      buyerName: json['buyerName'] as String? ?? '',
      farmerId: json['farmerId'] as String? ?? '',
      farmerName: json['farmerName'] as String? ?? '',
      sourceType: source['type'] as String? ?? '',
      sourceRefId: source['refId'] as String? ?? '',
      crop: json['crop'] as String? ?? '',
      variety: json['variety'] as String? ?? '',
      quantity: (json['quantity'] as num?)?.toDouble() ?? 0,
      unit: json['unit'] as String? ?? 'quintal',
      agreedPricePerUnit: (json['agreedPricePerUnit'] as num?)?.toInt() ?? 0,
      totalAmount: (json['totalAmount'] as num?)?.toInt() ?? 0,
      advancePaid: (json['advancePaid'] as num?)?.toInt() ?? 0,
      status: json['status'] as String? ?? 'confirmed',
      pickup: ((json['pickup'] as Map?) ?? const {}).cast<String, dynamic>(),
      payments: ((json['payments'] as List?) ?? const <dynamic>[])
          .map((e) =>
              PurchasePayment.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
      qc: ((json['qc'] as Map?) ?? const {}).cast<String, dynamic>(),
      finalAmount: (json['finalAmount'] as num?)?.toInt(),
      invoice: (json['invoice'] as Map?) == null
          ? null
          : (json['invoice'] as Map).cast<String, dynamic>(),
      events: ((json['events'] as List?) ?? const <dynamic>[])
          .map((e) => PurchaseEvent.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
      rating:
          ((json['rating'] as Map?) ?? const {}).cast<String, dynamic>(),
      createdAt: json['createdAt'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
    );
  }
}

class PurchaseInvoice {
  final String purchaseId;
  final String number;
  final String issuedAt;

  const PurchaseInvoice({
    required this.purchaseId,
    required this.number,
    required this.issuedAt,
  });

  factory PurchaseInvoice.fromJson(Map<String, dynamic> json) =>
      PurchaseInvoice(
        purchaseId: json['purchaseId'] as String? ?? '',
        number: json['number'] as String? ?? '',
        issuedAt: json['issuedAt'] as String? ?? '',
      );
}

class SavedFarmer {
  final String farmerId;
  final String farmerName;
  final String village;
  final String district;
  final double rating;

  const SavedFarmer({
    required this.farmerId,
    required this.farmerName,
    required this.village,
    required this.district,
    required this.rating,
  });

  factory SavedFarmer.fromJson(Map<String, dynamic> json) => SavedFarmer(
        farmerId: json['farmerId'] as String? ?? '',
        farmerName: json['farmerName'] as String? ?? '',
        village: json['village'] as String? ?? '',
        district: json['district'] as String? ?? '',
        rating: (json['rating'] as num?)?.toDouble() ?? 0,
      );
}

class FeedLot {
  final String id;
  final String farmerId;
  final String farmerName;
  final String farmerVillage;
  final String crop;
  final String variety;
  final double quantityQuintals;
  final int expectedRate;
  final String harvestDate;
  final String status;

  const FeedLot({
    required this.id,
    required this.farmerId,
    required this.farmerName,
    required this.farmerVillage,
    required this.crop,
    required this.variety,
    required this.quantityQuintals,
    required this.expectedRate,
    required this.harvestDate,
    required this.status,
  });

  factory FeedLot.fromJson(Map<String, dynamic> json) => FeedLot(
        id: json['id'] as String? ?? '',
        farmerId: json['farmerId'] as String? ?? '',
        farmerName: json['farmerName'] as String? ?? '',
        farmerVillage: json['farmerVillage'] as String? ?? '',
        crop: json['crop'] as String? ?? '',
        variety: json['variety'] as String? ?? '',
        quantityQuintals: (json['quantityQuintals'] as num?)?.toDouble() ?? 0,
        expectedRate: (json['expectedRate'] as num?)?.toInt() ?? 0,
        harvestDate: json['harvestDate'] as String? ?? '',
        status: json['status'] as String? ?? 'open',
      );
}

class CropBreakdownItem {
  final String crop;
  final double spend;
  final double volume;
  final double avgPrice;

  const CropBreakdownItem({
    required this.crop,
    required this.spend,
    required this.volume,
    required this.avgPrice,
  });

  factory CropBreakdownItem.fromJson(Map<String, dynamic> json) =>
      CropBreakdownItem(
        crop: json['crop'] as String? ?? '',
        spend: (json['spend'] as num?)?.toDouble() ?? 0,
        volume: (json['volume'] as num?)?.toDouble() ?? 0,
        avgPrice: (json['avgPrice'] as num?)?.toDouble() ?? 0,
      );
}

class ProcurementMonth {
  final String month;
  final double spend;
  final double volume;

  const ProcurementMonth({
    required this.month,
    required this.spend,
    required this.volume,
  });

  factory ProcurementMonth.fromJson(Map<String, dynamic> json) =>
      ProcurementMonth(
        month: json['month'] as String? ?? '',
        spend: (json['spend'] as num?)?.toDouble() ?? 0,
        volume: (json['volume'] as num?)?.toDouble() ?? 0,
      );
}

class TopSupplier {
  final String farmerId;
  final String farmerName;
  final double spend;
  final int purchases;

  const TopSupplier({
    required this.farmerId,
    required this.farmerName,
    required this.spend,
    required this.purchases,
  });

  factory TopSupplier.fromJson(Map<String, dynamic> json) => TopSupplier(
        farmerId: json['farmerId'] as String? ?? '',
        farmerName: json['farmerName'] as String? ?? '',
        spend: (json['spend'] as num?)?.toDouble() ?? 0,
        purchases: (json['purchases'] as num?)?.toInt() ?? 0,
      );
}

class MandiComparison {
  final String crop;
  final double avgPurchasePrice;
  final double? mandiModalPrice;

  const MandiComparison({
    required this.crop,
    required this.avgPurchasePrice,
    required this.mandiModalPrice,
  });

  factory MandiComparison.fromJson(Map<String, dynamic> json) =>
      MandiComparison(
        crop: json['crop'] as String? ?? '',
        avgPurchasePrice:
            (json['avgPurchasePrice'] as num?)?.toDouble() ?? 0,
        mandiModalPrice: (json['mandiModalPrice'] as num?)?.toDouble(),
      );
}

class DirectBuyerAnalytics {
  final double totalSpend;
  final double totalVolume;
  final int activeDemands;
  final int openOffers;
  final Map<String, int> purchasesByStatus;
  final List<ProcurementMonth> monthlyProcurement;
  final List<CropBreakdownItem> cropBreakdown;
  final List<TopSupplier> topSuppliers;
  final List<MandiComparison> avgPriceVsMandi;
  final double qcRejectionRate;
  final double completionRate;
  final double pendingBalance;

  const DirectBuyerAnalytics({
    required this.totalSpend,
    required this.totalVolume,
    required this.activeDemands,
    required this.openOffers,
    required this.purchasesByStatus,
    required this.monthlyProcurement,
    required this.cropBreakdown,
    required this.topSuppliers,
    required this.avgPriceVsMandi,
    required this.qcRejectionRate,
    required this.completionRate,
    required this.pendingBalance,
  });

  factory DirectBuyerAnalytics.fromJson(Map<String, dynamic> json) {
    final byStatus = (json['purchasesByStatus'] as Map?) ?? const {};
    return DirectBuyerAnalytics(
      totalSpend: (json['totalSpend'] as num?)?.toDouble() ?? 0,
      totalVolume: (json['totalVolume'] as num?)?.toDouble() ?? 0,
      activeDemands: (json['activeDemands'] as num?)?.toInt() ?? 0,
      openOffers: (json['openOffers'] as num?)?.toInt() ?? 0,
      purchasesByStatus: byStatus
          .map((k, v) => MapEntry("$k", (v as num?)?.toInt() ?? 0)),
      monthlyProcurement:
          ((json['monthlyProcurement'] as List?) ?? const <dynamic>[])
              .map((e) =>
                  ProcurementMonth.fromJson((e as Map).cast<String, dynamic>()))
              .toList(),
      cropBreakdown: ((json['cropBreakdown'] as List?) ?? const <dynamic>[])
          .map((e) =>
              CropBreakdownItem.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
      topSuppliers: ((json['topSuppliers'] as List?) ?? const <dynamic>[])
          .map((e) =>
              TopSupplier.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
      avgPriceVsMandi:
          ((json['avgPriceVsMandi'] as List?) ?? const <dynamic>[])
              .map((e) =>
                  MandiComparison.fromJson((e as Map).cast<String, dynamic>()))
              .toList(),
      qcRejectionRate: (json['qcRejectionRate'] as num?)?.toDouble() ?? 0,
      completionRate: (json['completionRate'] as num?)?.toDouble() ?? 0,
      pendingBalance: (json['pendingBalance'] as num?)?.toDouble() ?? 0,
    );
  }
}
