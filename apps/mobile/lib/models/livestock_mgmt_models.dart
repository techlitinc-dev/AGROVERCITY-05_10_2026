// Dairy + Gaushala + Doctor management models — fields match the backend
// routers livestock_dairy.py, livestock_gaushala.py and livestock_vets.py
// response documents exactly (lib/models/livestock_mgmt.py is the request
// contract; these mirror what the routers persist & return).

Map<String, dynamic> _map(dynamic v) =>
    v is Map ? v.cast<String, dynamic>() : <String, dynamic>{};

List<String> _strList(dynamic v) =>
    ((v as List?) ?? const <dynamic>[]).map((e) => "$e").toList();

double _dbl(dynamic v) => (v as num?)?.toDouble() ?? 0.0;

int _int(dynamic v) => (v as num?)?.toInt() ?? 0;

// -------------------------------------------------------------
// Dairy management
// -------------------------------------------------------------

class DairyMember {
  final String id;
  final String centerId;
  final String farmerUid;
  final String name;
  final String phone;
  final String village;
  final String memberCode;
  final Map<String, dynamic> bankDetails;
  final String defaultSpecies;
  final double deduction;
  final String status;
  final String createdAt;

  const DairyMember({
    required this.id,
    required this.centerId,
    required this.farmerUid,
    required this.name,
    required this.phone,
    required this.village,
    required this.memberCode,
    required this.bankDetails,
    required this.defaultSpecies,
    required this.deduction,
    required this.status,
    required this.createdAt,
  });

  factory DairyMember.fromJson(Map<String, dynamic> json) => DairyMember(
        id: json['id'] as String? ?? '',
        centerId: json['centerId'] as String? ?? '',
        farmerUid: json['farmerUid'] as String? ?? '',
        name: json['name'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        village: json['village'] as String? ?? '',
        memberCode: json['memberCode'] as String? ?? '',
        bankDetails: _map(json['bankDetails']),
        defaultSpecies: json['defaultSpecies'] as String? ?? 'cow',
        deduction: _dbl(json['deduction']),
        status: json['status'] as String? ?? 'active',
        createdAt: json['createdAt'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        'phone': phone,
        'village': village,
        'farmerUid': farmerUid,
        'memberCode': memberCode,
        'bankDetails': bankDetails,
        'defaultSpecies': defaultSpecies,
        'deduction': deduction,
        'status': status,
      };
}

class RateChart {
  final String id;
  final String centerId;
  final String species;
  final String effectiveFrom;
  final double baseRate;
  final double fatBase;
  final double snfBase;
  final double fatStep;
  final double snfStep;
  final double minRate;
  final double minFat;
  final double minSnf;
  final bool active;
  final String createdAt;

  const RateChart({
    required this.id,
    required this.centerId,
    required this.species,
    required this.effectiveFrom,
    required this.baseRate,
    required this.fatBase,
    required this.snfBase,
    required this.fatStep,
    required this.snfStep,
    required this.minRate,
    required this.minFat,
    required this.minSnf,
    required this.active,
    required this.createdAt,
  });

  factory RateChart.fromJson(Map<String, dynamic> json) => RateChart(
        id: json['id'] as String? ?? '',
        centerId: json['centerId'] as String? ?? '',
        species: json['species'] as String? ?? 'cow',
        effectiveFrom: json['effectiveFrom'] as String? ?? '',
        baseRate: _dbl(json['baseRate']),
        fatBase: _dbl(json['fatBase']),
        snfBase: _dbl(json['snfBase']),
        fatStep: _dbl(json['fatStep']),
        snfStep: _dbl(json['snfStep']),
        minRate: _dbl(json['minRate']),
        minFat: _dbl(json['minFat']),
        minSnf: _dbl(json['minSnf']),
        active: json['active'] == true,
        createdAt: json['createdAt'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {
        'species': species,
        'effectiveFrom': effectiveFrom,
        'baseRate': baseRate,
        'fatBase': fatBase,
        'snfBase': snfBase,
        'fatStep': fatStep,
        'snfStep': snfStep,
        'minRate': minRate,
        'minFat': minFat,
        'minSnf': minSnf,
        'active': active,
      };
}

class PaymentEntry {
  final String id;
  final String batchId;
  final String centerId;
  final String memberId;
  final String memberName;
  final double liters;
  final double amount;
  final double deduction;
  final double netAmount;
  final String payoutRef;
  final String status;
  final String createdAt;

  const PaymentEntry({
    required this.id,
    required this.batchId,
    required this.centerId,
    required this.memberId,
    required this.memberName,
    required this.liters,
    required this.amount,
    required this.deduction,
    required this.netAmount,
    required this.payoutRef,
    required this.status,
    required this.createdAt,
  });

  factory PaymentEntry.fromJson(Map<String, dynamic> json) => PaymentEntry(
        id: json['id'] as String? ?? '',
        batchId: json['batchId'] as String? ?? '',
        centerId: json['centerId'] as String? ?? '',
        memberId: json['memberId'] as String? ?? '',
        memberName: json['memberName'] as String? ?? '',
        liters: _dbl(json['liters']),
        amount: _dbl(json['amount']),
        deduction: _dbl(json['deduction']),
        netAmount: _dbl(json['netAmount']),
        payoutRef: json['payoutRef'] as String? ?? '',
        status: json['status'] as String? ?? 'pending',
        createdAt: json['createdAt'] as String? ?? '',
      );
}

class PaymentBatch {
  final String id;
  final String centerId;
  final String periodFrom;
  final String periodTo;
  final String status;
  final double totalLiters;
  final double totalAmount;
  final double totalDeduction;
  final double totalNet;
  final String createdAt;
  final String? paidAt;
  final List<PaymentEntry> entries;

  const PaymentBatch({
    required this.id,
    required this.centerId,
    required this.periodFrom,
    required this.periodTo,
    required this.status,
    required this.totalLiters,
    required this.totalAmount,
    required this.totalDeduction,
    required this.totalNet,
    required this.createdAt,
    this.paidAt,
    this.entries = const [],
  });

  factory PaymentBatch.fromJson(Map<String, dynamic> json) => PaymentBatch(
        id: json['id'] as String? ?? '',
        centerId: json['centerId'] as String? ?? '',
        periodFrom: json['periodFrom'] as String? ?? '',
        periodTo: json['periodTo'] as String? ?? '',
        status: json['status'] as String? ?? 'draft',
        totalLiters: _dbl(json['totalLiters']),
        totalAmount: _dbl(json['totalAmount']),
        totalDeduction: _dbl(json['totalDeduction']),
        totalNet: _dbl(json['totalNet']),
        createdAt: json['createdAt'] as String? ?? '',
        paidAt: json['paidAt'] as String?,
        entries: ((json['entries'] as List?) ?? const <dynamic>[])
            .map((e) => PaymentEntry.fromJson(_map(e)))
            .toList(),
      );
}

class MilkSaleCustomer {
  final String id;
  final String centerId;
  final String name;
  final String phone;
  final String type;
  final String address;
  final String route;
  final double dailyLitersAM;
  final double dailyLitersPM;
  final double ratePerLiter;
  final String status;
  final String createdAt;

  const MilkSaleCustomer({
    required this.id,
    required this.centerId,
    required this.name,
    required this.phone,
    required this.type,
    required this.address,
    required this.route,
    required this.dailyLitersAM,
    required this.dailyLitersPM,
    required this.ratePerLiter,
    required this.status,
    required this.createdAt,
  });

  factory MilkSaleCustomer.fromJson(Map<String, dynamic> json) =>
      MilkSaleCustomer(
        id: json['id'] as String? ?? '',
        centerId: json['centerId'] as String? ?? '',
        name: json['name'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        type: json['type'] as String? ?? 'household',
        address: json['address'] as String? ?? '',
        route: json['route'] as String? ?? '',
        dailyLitersAM: _dbl(json['dailyLitersAM']),
        dailyLitersPM: _dbl(json['dailyLitersPM']),
        ratePerLiter: _dbl(json['ratePerLiter']),
        status: json['status'] as String? ?? 'active',
        createdAt: json['createdAt'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        'phone': phone,
        'type': type,
        'address': address,
        'route': route,
        'dailyLitersAM': dailyLitersAM,
        'dailyLitersPM': dailyLitersPM,
        'ratePerLiter': ratePerLiter,
        'status': status,
      };
}

class MilkSaleOrderItem {
  final String productId;
  final String name;
  final double qty;
  final double unitPrice;

  const MilkSaleOrderItem({
    required this.productId,
    required this.name,
    required this.qty,
    required this.unitPrice,
  });

  factory MilkSaleOrderItem.fromJson(Map<String, dynamic> json) =>
      MilkSaleOrderItem(
        productId: json['productId'] as String? ?? '',
        name: json['name'] as String? ?? '',
        qty: _dbl(json['qty']),
        unitPrice: _dbl(json['unitPrice']),
      );

  Map<String, dynamic> toJson() => {
        'productId': productId,
        'name': name,
        'qty': qty,
        'unitPrice': unitPrice,
      };
}

class MilkSaleOrder {
  final String id;
  final String centerId;
  final String customerId;
  final String customerName;
  final String orderDate;
  final String shift;
  final double liters;
  final List<MilkSaleOrderItem> items;
  final double amount;
  final String status;
  final String createdAt;
  final String? deliveredAt;

  const MilkSaleOrder({
    required this.id,
    required this.centerId,
    required this.customerId,
    required this.customerName,
    required this.orderDate,
    required this.shift,
    required this.liters,
    required this.items,
    required this.amount,
    required this.status,
    required this.createdAt,
    this.deliveredAt,
  });

  factory MilkSaleOrder.fromJson(Map<String, dynamic> json) => MilkSaleOrder(
        id: json['id'] as String? ?? '',
        centerId: json['centerId'] as String? ?? '',
        customerId: json['customerId'] as String? ?? '',
        customerName: json['customerName'] as String? ?? '',
        orderDate: json['orderDate'] as String? ?? '',
        shift: json['shift'] as String? ?? 'am',
        liters: _dbl(json['liters']),
        items: ((json['items'] as List?) ?? const <dynamic>[])
            .map((e) => MilkSaleOrderItem.fromJson(_map(e)))
            .toList(),
        amount: _dbl(json['amount']),
        status: json['status'] as String? ?? 'scheduled',
        createdAt: json['createdAt'] as String? ?? '',
        deliveredAt: json['deliveredAt'] as String?,
      );
}

class MilkSalesSummary {
  final int totalOrders;
  final double totalLiters;
  final double totalAmount;
  final double collectedAmount;
  final Map<String, int> byStatus;

  const MilkSalesSummary({
    required this.totalOrders,
    required this.totalLiters,
    required this.totalAmount,
    required this.collectedAmount,
    required this.byStatus,
  });

  factory MilkSalesSummary.fromJson(Map<String, dynamic> json) =>
      MilkSalesSummary(
        totalOrders: _int(json['totalOrders']),
        totalLiters: _dbl(json['totalLiters']),
        totalAmount: _dbl(json['totalAmount']),
        collectedAmount: _dbl(json['collectedAmount']),
        byStatus: _map(json['byStatus']).map(
          (k, v) => MapEntry(k, (v as num?)?.toInt() ?? 0),
        ),
      );
}

class StockItem {
  final String id;
  final String centerId;
  final String name;
  final String category;
  final String unit;
  final double stockQty;
  final double unitPrice;
  final String expiryDate;
  final String createdAt;
  final Map<String, dynamic> lastAdjustment;

  const StockItem({
    required this.id,
    required this.centerId,
    required this.name,
    required this.category,
    required this.unit,
    required this.stockQty,
    required this.unitPrice,
    required this.expiryDate,
    required this.createdAt,
    this.lastAdjustment = const {},
  });

  factory StockItem.fromJson(Map<String, dynamic> json) => StockItem(
        id: json['id'] as String? ?? '',
        centerId: json['centerId'] as String? ?? '',
        name: json['name'] as String? ?? '',
        category: json['category'] as String? ?? 'other',
        unit: json['unit'] as String? ?? 'liter',
        stockQty: _dbl(json['stockQty']),
        unitPrice: _dbl(json['unitPrice']),
        expiryDate: json['expiryDate'] as String? ?? '',
        createdAt: json['createdAt'] as String? ?? '',
        lastAdjustment: _map(json['lastAdjustment']),
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        'category': category,
        'unit': unit,
        'stockQty': stockQty,
        'unitPrice': unitPrice,
        'expiryDate': expiryDate,
      };
}

/// A milk_collections document (as returned by the farmer slips endpoint and
/// the member statement). Distinct from the legacy MilkCollection model whose
/// field names predate the backend rename.
class MilkCollectionSlip {
  final String id;
  final String dairyId;
  final String dairyName;
  final String farmerId;
  final String farmerName;
  final String farmerCode;
  final String farmerPhone;
  final String date;
  final String shift;
  final String milkType;
  final double liters;
  final double fatPercent;
  final double snfPercent;
  final double clr;
  final double ratePerLiter;
  final double totalAmount;
  final String slipNumber;
  final String status;
  final String recordedAt;
  final String? memberId;
  final Map<String, dynamic> quality;

  const MilkCollectionSlip({
    required this.id,
    required this.dairyId,
    required this.dairyName,
    required this.farmerId,
    required this.farmerName,
    required this.farmerCode,
    required this.farmerPhone,
    required this.date,
    required this.shift,
    required this.milkType,
    required this.liters,
    required this.fatPercent,
    required this.snfPercent,
    required this.clr,
    required this.ratePerLiter,
    required this.totalAmount,
    required this.slipNumber,
    required this.status,
    required this.recordedAt,
    this.memberId,
    this.quality = const {},
  });

  factory MilkCollectionSlip.fromJson(Map<String, dynamic> json) =>
      MilkCollectionSlip(
        id: json['id'] as String? ?? '',
        dairyId: json['dairyId'] as String? ?? '',
        dairyName: json['dairyName'] as String? ?? '',
        farmerId: json['farmerId'] as String? ?? '',
        farmerName: json['farmerName'] as String? ?? '',
        farmerCode: json['farmerCode'] as String? ?? '',
        farmerPhone: json['farmerPhone'] as String? ?? '',
        date: json['date'] as String? ?? '',
        shift: json['shift'] as String? ?? 'morning',
        milkType: json['milkType'] as String? ?? 'cow',
        liters: _dbl(json['liters']),
        fatPercent: _dbl(json['fatPercent']),
        snfPercent: _dbl(json['snfPercent']),
        clr: _dbl(json['clr']),
        ratePerLiter: _dbl(json['ratePerLiter']),
        totalAmount: _dbl(json['totalAmount']),
        slipNumber: json['slipNumber'] as String? ?? '',
        status: json['status'] as String? ?? 'recorded',
        recordedAt: json['recordedAt'] as String? ?? '',
        memberId: json['memberId'] as String?,
        quality: _map(json['quality']),
      );
}

class MemberStatement {
  final DairyMember member;
  final List<MilkCollectionSlip> collections;
  final List<PaymentEntry> payments;
  final double totalLiters;
  final double totalAmount;
  final double totalPaid;

  const MemberStatement({
    required this.member,
    required this.collections,
    required this.payments,
    required this.totalLiters,
    required this.totalAmount,
    required this.totalPaid,
  });

  factory MemberStatement.fromJson(Map<String, dynamic> json) {
    final totals = _map(json['totals']);
    return MemberStatement(
      member: DairyMember.fromJson(_map(json['member'])),
      collections: ((json['collections'] as List?) ?? const <dynamic>[])
          .map((e) => MilkCollectionSlip.fromJson(_map(e)))
          .toList(),
      payments: ((json['payments'] as List?) ?? const <dynamic>[])
          .map((e) => PaymentEntry.fromJson(_map(e)))
          .toList(),
      totalLiters: _dbl(totals['liters']),
      totalAmount: _dbl(totals['amount']),
      totalPaid: _dbl(totals['paid']),
    );
  }
}

// -------------------------------------------------------------
// Gaushala management
// -------------------------------------------------------------

class GaushalaProfile {
  final String id;
  final String managerId;
  final String name;
  final String trustName;
  final String address;
  final String district;
  final String phone;
  final int capacity;
  final Map<String, dynamic> certifications;
  final Map<String, dynamic> bankDetails;
  final int cowCount;
  final double rating;
  final String createdAt;

  const GaushalaProfile({
    required this.id,
    required this.managerId,
    required this.name,
    required this.trustName,
    required this.address,
    required this.district,
    required this.phone,
    required this.capacity,
    required this.certifications,
    required this.bankDetails,
    required this.cowCount,
    required this.rating,
    required this.createdAt,
  });

  factory GaushalaProfile.fromJson(Map<String, dynamic> json) =>
      GaushalaProfile(
        id: json['id'] as String? ?? '',
        managerId: json['managerId'] as String? ?? '',
        name: json['name'] as String? ?? '',
        trustName: json['trustName'] as String? ?? '',
        address: json['address'] as String? ?? '',
        district: json['district'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        capacity: _int(json['capacity']),
        certifications: _map(json['certifications']),
        bankDetails: _map(json['bankDetails']),
        cowCount: _int(json['cowCount']),
        rating: _dbl(json['rating']),
        createdAt: json['createdAt'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        'trustName': trustName,
        'address': address,
        'district': district,
        'phone': phone,
        'capacity': capacity,
        'certifications': certifications,
        'bankDetails': bankDetails,
      };
}

class CattleEvent {
  final String type;
  final String note;
  final String date;
  final String at;

  const CattleEvent({
    required this.type,
    required this.note,
    required this.date,
    required this.at,
  });

  factory CattleEvent.fromJson(Map<String, dynamic> json) => CattleEvent(
        type: json['type'] as String? ?? '',
        note: json['note'] as String? ?? '',
        date: json['date'] as String? ?? '',
        at: json['at'] as String? ?? '',
      );
}

/// A livestock_animals document owned by a gaushala (as returned by
/// /livestock/gaushala/cattle).
class GaushalaCattle {
  final String id;
  final String gaushalaId;
  final String tagId;
  final String name;
  final String species;
  final String breed;
  final String gender;
  final String category;
  final String cattleStatus;
  final String source;
  final List<CattleEvent> events;
  final String createdAt;

  const GaushalaCattle({
    required this.id,
    required this.gaushalaId,
    required this.tagId,
    required this.name,
    required this.species,
    required this.breed,
    required this.gender,
    required this.category,
    required this.cattleStatus,
    required this.source,
    required this.events,
    required this.createdAt,
  });

  factory GaushalaCattle.fromJson(Map<String, dynamic> json) => GaushalaCattle(
        id: json['id'] as String? ?? '',
        gaushalaId: json['gaushalaId'] as String? ?? '',
        tagId: json['tagId'] as String? ?? '',
        name: json['name'] as String? ?? '',
        species: json['species'] as String? ?? 'cow',
        breed: json['breed'] as String? ?? '',
        gender: json['gender'] as String? ?? 'female',
        category: json['category'] as String? ?? 'other',
        cattleStatus: json['cattleStatus'] as String? ?? 'in-shelter',
        source: json['source'] as String? ?? '',
        events: ((json['events'] as List?) ?? const <dynamic>[])
            .map((e) => CattleEvent.fromJson(_map(e)))
            .toList(),
        createdAt: json['createdAt'] as String? ?? '',
      );
}

/// cow_adoptions document as returned by the gaushala management router.
class MgmtAdoption {
  final String id;
  final String gaushalaId;
  final String gaushalaName;
  final String cowTagId;
  final String cowName;
  final String donorId;
  final String donorName;
  final String donorPhone;
  final String donorCity;
  final String tier;
  final int amountInr;
  final String billingCycle;
  final String startDate;
  final String endDate;
  final String status;
  final String certificateNumber;
  final String? receiptId;
  final String createdAt;

  const MgmtAdoption({
    required this.id,
    required this.gaushalaId,
    required this.gaushalaName,
    required this.cowTagId,
    required this.cowName,
    required this.donorId,
    required this.donorName,
    required this.donorPhone,
    required this.donorCity,
    required this.tier,
    required this.amountInr,
    required this.billingCycle,
    required this.startDate,
    required this.endDate,
    required this.status,
    required this.certificateNumber,
    this.receiptId,
    required this.createdAt,
  });

  factory MgmtAdoption.fromJson(Map<String, dynamic> json) => MgmtAdoption(
        id: json['id'] as String? ?? '',
        gaushalaId: json['gaushalaId'] as String? ?? '',
        gaushalaName: json['gaushalaName'] as String? ?? '',
        cowTagId: json['cowTagId'] as String? ?? '',
        cowName: json['cowName'] as String? ?? '',
        donorId: json['donorId'] as String? ?? '',
        donorName: json['donorName'] as String? ?? '',
        donorPhone: json['donorPhone'] as String? ?? '',
        donorCity: json['donorCity'] as String? ?? '',
        tier: json['tier'] as String? ?? 'gau_gras',
        amountInr: _int(json['amountInr']),
        billingCycle: json['billingCycle'] as String? ?? 'monthly',
        startDate: json['startDate'] as String? ?? '',
        endDate: json['endDate'] as String? ?? '',
        status: json['status'] as String? ?? 'active',
        certificateNumber: json['certificateNumber'] as String? ?? '',
        receiptId: json['receiptId'] as String?,
        createdAt: json['createdAt'] as String? ?? '',
      );
}

/// fodder_donations document as returned by the gaushala management router.
class MgmtDonation {
  final String id;
  final String gaushalaId;
  final String donorId;
  final String donorName;
  final String donorPhone;
  final String donationType;
  final String quantityDescription;
  final int amountInr;
  final String receiptNumber;
  final String status;
  final String createdAt;

  const MgmtDonation({
    required this.id,
    required this.gaushalaId,
    required this.donorId,
    required this.donorName,
    required this.donorPhone,
    required this.donationType,
    required this.quantityDescription,
    required this.amountInr,
    required this.receiptNumber,
    required this.status,
    required this.createdAt,
  });

  factory MgmtDonation.fromJson(Map<String, dynamic> json) => MgmtDonation(
        id: json['id'] as String? ?? '',
        gaushalaId: json['gaushalaId'] as String? ?? '',
        donorId: json['donorId'] as String? ?? '',
        donorName: json['donorName'] as String? ?? '',
        donorPhone: json['donorPhone'] as String? ?? '',
        donationType: json['donationType'] as String? ?? 'green_fodder',
        quantityDescription: json['quantityDescription'] as String? ?? '',
        amountInr: _int(json['amountInr']),
        receiptNumber: json['receiptNumber'] as String? ?? '',
        status: json['status'] as String? ?? 'received',
        createdAt: json['createdAt'] as String? ?? '',
      );
}

class GaushalaExpense {
  final String id;
  final String gaushalaId;
  final String category;
  final double amount;
  final String note;
  final String expenseDate;
  final String createdBy;
  final String createdAt;

  const GaushalaExpense({
    required this.id,
    required this.gaushalaId,
    required this.category,
    required this.amount,
    required this.note,
    required this.expenseDate,
    required this.createdBy,
    required this.createdAt,
  });

  factory GaushalaExpense.fromJson(Map<String, dynamic> json) =>
      GaushalaExpense(
        id: json['id'] as String? ?? '',
        gaushalaId: json['gaushalaId'] as String? ?? '',
        category: json['category'] as String? ?? 'other',
        amount: _dbl(json['amount']),
        note: json['note'] as String? ?? '',
        expenseDate: json['expenseDate'] as String? ?? '',
        createdBy: json['createdBy'] as String? ?? '',
        createdAt: json['createdAt'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {
        'category': category,
        'amount': amount,
        'note': note,
        'expenseDate': expenseDate,
      };
}

class ExpenseSummary {
  final String month;
  final double total;
  final int count;
  final Map<String, double> byCategory;

  const ExpenseSummary({
    required this.month,
    required this.total,
    required this.count,
    required this.byCategory,
  });

  factory ExpenseSummary.fromJson(Map<String, dynamic> json) => ExpenseSummary(
        month: json['month'] as String? ?? 'all',
        total: _dbl(json['total']),
        count: _int(json['count']),
        byCategory:
            _map(json['byCategory']).map((k, v) => MapEntry(k, _dbl(v))),
      );
}

class GaushalaDashboard {
  final String gaushalaId;
  final int headcount;
  final Map<String, int> byCategory;
  final int activeAdoptions;
  final double donationsMonthTotal;
  final double expensesMonthTotal;
  final int capacity;
  final int occupancy;
  final double? occupancyPercent;

  const GaushalaDashboard({
    required this.gaushalaId,
    required this.headcount,
    required this.byCategory,
    required this.activeAdoptions,
    required this.donationsMonthTotal,
    required this.expensesMonthTotal,
    required this.capacity,
    required this.occupancy,
    this.occupancyPercent,
  });

  factory GaushalaDashboard.fromJson(Map<String, dynamic> json) =>
      GaushalaDashboard(
        gaushalaId: json['gaushalaId'] as String? ?? '',
        headcount: _int(json['headcount']),
        byCategory:
            _map(json['byCategory']).map((k, v) => MapEntry(k, _int(v))),
        activeAdoptions: _int(json['activeAdoptions']),
        donationsMonthTotal: _dbl(json['donationsMonthTotal']),
        expensesMonthTotal: _dbl(json['expensesMonthTotal']),
        capacity: _int(json['capacity']),
        occupancy: _int(json['occupancy']),
        occupancyPercent: json['occupancyPercent'] == null
            ? null
            : _dbl(json['occupancyPercent']),
      );
}

class Receipt {
  final String id;
  final String kind;
  final String refId;
  final String personName;
  final num amount;
  final String panNumber;
  final bool eightyGEligible;
  final String certificateNumber;
  final String certificateUrl;
  final String issuedBy;
  final String gaushalaId;
  final String gaushalaName;
  final String issuedAt;

  const Receipt({
    required this.id,
    required this.kind,
    required this.refId,
    required this.personName,
    required this.amount,
    required this.panNumber,
    required this.eightyGEligible,
    required this.certificateNumber,
    required this.certificateUrl,
    required this.issuedBy,
    required this.gaushalaId,
    required this.gaushalaName,
    required this.issuedAt,
  });

  factory Receipt.fromJson(Map<String, dynamic> json) => Receipt(
        id: json['id'] as String? ?? '',
        kind: json['kind'] as String? ?? '',
        refId: json['refId'] as String? ?? '',
        personName: json['personName'] as String? ?? '',
        amount: (json['amount'] as num?) ?? 0,
        panNumber: json['panNumber'] as String? ?? '',
        eightyGEligible: json['eightyGEligible'] == true,
        certificateNumber: json['certificateNumber'] as String? ?? '',
        certificateUrl: json['certificateUrl'] as String? ?? '',
        issuedBy: json['issuedBy'] as String? ?? '',
        gaushalaId: json['gaushalaId'] as String? ?? '',
        gaushalaName: json['gaushalaName'] as String? ?? '',
        issuedAt: json['issuedAt'] as String? ?? '',
      );
}

// -------------------------------------------------------------
// Doctor (vet) management
// -------------------------------------------------------------

class ManagedVet {
  final String id;
  final String name;
  final String phone;
  final String qualification;
  final List<String> specializations;
  final String clinicAddress;
  final int experienceYears;
  final int feeClinic;
  final int feeFarm;
  final int feeTele;
  final int consultationFeeRupees;
  final List<String> visitTypes;
  final List<String> serviceDistricts;
  final List<String> languages;
  final String vetCouncilRegNo;
  final bool emergencyAvailable;
  final bool availableForFarmVisit;
  final double distanceKm;
  final double rating;
  final String nextAvailableSlot;
  final String claimedByUid;
  final bool claimed;
  final String status;
  final String onboardedBy;
  final double? ratingAvg;
  final int ratingCount;
  final String createdAt;

  const ManagedVet({
    required this.id,
    required this.name,
    required this.phone,
    required this.qualification,
    required this.specializations,
    required this.clinicAddress,
    required this.experienceYears,
    required this.feeClinic,
    required this.feeFarm,
    required this.feeTele,
    required this.consultationFeeRupees,
    required this.visitTypes,
    required this.serviceDistricts,
    required this.languages,
    required this.vetCouncilRegNo,
    required this.emergencyAvailable,
    required this.availableForFarmVisit,
    required this.distanceKm,
    required this.rating,
    required this.nextAvailableSlot,
    required this.claimedByUid,
    required this.claimed,
    required this.status,
    required this.onboardedBy,
    this.ratingAvg,
    this.ratingCount = 0,
    this.createdAt = '',
  });

  factory ManagedVet.fromJson(Map<String, dynamic> json) => ManagedVet(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        qualification: json['qualification'] as String? ?? '',
        specializations: _strList(json['specializations']),
        clinicAddress: json['clinicAddress'] as String? ?? '',
        experienceYears: _int(json['experienceYears']),
        feeClinic: _int(json['feeClinic']),
        feeFarm: _int(json['feeFarm']),
        feeTele: _int(json['feeTele']),
        consultationFeeRupees: _int(json['consultationFeeRupees']),
        visitTypes: _strList(json['visitTypes']),
        serviceDistricts: _strList(json['serviceDistricts']),
        languages: _strList(json['languages']),
        vetCouncilRegNo: json['vetCouncilRegNo'] as String? ?? '',
        emergencyAvailable: json['emergencyAvailable'] == true,
        availableForFarmVisit: json['availableForFarmVisit'] != false,
        distanceKm: _dbl(json['distanceKm']),
        rating: _dbl(json['rating']),
        nextAvailableSlot: json['nextAvailableSlot'] as String? ?? '',
        claimedByUid: json['claimedByUid'] as String? ?? '',
        claimed: json['claimed'] == true ||
            (json['claimedByUid'] as String? ?? '').isNotEmpty,
        status: json['status'] as String? ?? 'active',
        onboardedBy: json['onboardedBy'] as String? ?? '',
        ratingAvg: (json['ratingAvg'] as num?)?.toDouble(),
        ratingCount: _int(json['ratingCount']),
        createdAt: json['createdAt'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        'phone': phone,
        'qualification': qualification,
        'specializations': specializations,
        'clinicAddress': clinicAddress,
        'experienceYears': experienceYears,
        'feeClinic': feeClinic,
        'feeFarm': feeFarm,
        'feeTele': feeTele,
        'visitTypes': visitTypes,
        'serviceDistricts': serviceDistricts,
        'languages': languages,
        'vetCouncilRegNo': vetCouncilRegNo,
        'emergencyAvailable': emergencyAvailable,
        'availableForFarmVisit': availableForFarmVisit,
      };
}

class Appointment {
  final String id;
  final String vetId;
  final String vetName;
  final String farmerUid;
  final String farmerName;
  final String animalId;
  final String visitType;
  final String slotDate;
  final String slotTime;
  final String symptoms;
  final String address;
  final double fee;
  final String status;
  final String vetNotes;
  final String cancelReason;
  final String? prescriptionId;
  final String? completedAt;
  final String createdAt;
  final String updatedAt;

  const Appointment({
    required this.id,
    required this.vetId,
    required this.vetName,
    required this.farmerUid,
    required this.farmerName,
    required this.animalId,
    required this.visitType,
    required this.slotDate,
    required this.slotTime,
    required this.symptoms,
    required this.address,
    required this.fee,
    required this.status,
    required this.vetNotes,
    required this.cancelReason,
    this.prescriptionId,
    this.completedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Appointment.fromJson(Map<String, dynamic> json) => Appointment(
        id: json['id'] as String? ?? '',
        vetId: json['vetId'] as String? ?? '',
        vetName: json['vetName'] as String? ?? '',
        farmerUid: json['farmerUid'] as String? ?? '',
        farmerName: json['farmerName'] as String? ?? '',
        animalId: json['animalId'] as String? ?? '',
        visitType: json['visitType'] as String? ?? 'clinic',
        slotDate: json['slotDate'] as String? ?? '',
        slotTime: json['slotTime'] as String? ?? '',
        symptoms: json['symptoms'] as String? ?? '',
        address: json['address'] as String? ?? '',
        fee: _dbl(json['fee']),
        status: json['status'] as String? ?? 'requested',
        vetNotes: json['vetNotes'] as String? ?? '',
        cancelReason: json['cancelReason'] as String? ?? '',
        prescriptionId: json['prescriptionId'] as String?,
        completedAt: json['completedAt'] as String?,
        createdAt: json['createdAt'] as String? ?? '',
        updatedAt: json['updatedAt'] as String? ?? '',
      );
}

class Medicine {
  final String name;
  final String dosage;
  final String frequency;
  final int durationDays;
  final String notes;

  const Medicine({
    required this.name,
    required this.dosage,
    required this.frequency,
    required this.durationDays,
    required this.notes,
  });

  factory Medicine.fromJson(Map<String, dynamic> json) => Medicine(
        name: json['name'] as String? ?? '',
        dosage: json['dosage'] as String? ?? '',
        frequency: json['frequency'] as String? ?? '',
        durationDays: _int(json['durationDays']),
        notes: json['notes'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        'dosage': dosage,
        'frequency': frequency,
        'durationDays': durationDays,
        'notes': notes,
      };
}

class Prescription {
  final String id;
  final String appointmentId;
  final String vetId;
  final String animalId;
  final String farmerUid;
  final String diagnosis;
  final List<Medicine> medicines;
  final String advice;
  final int milkWithdrawalDays;
  final String followUpDate;
  final String createdAt;

  const Prescription({
    required this.id,
    required this.appointmentId,
    required this.vetId,
    required this.animalId,
    required this.farmerUid,
    required this.diagnosis,
    required this.medicines,
    required this.advice,
    required this.milkWithdrawalDays,
    required this.followUpDate,
    required this.createdAt,
  });

  factory Prescription.fromJson(Map<String, dynamic> json) => Prescription(
        id: json['id'] as String? ?? '',
        appointmentId: json['appointmentId'] as String? ?? '',
        vetId: json['vetId'] as String? ?? '',
        animalId: json['animalId'] as String? ?? '',
        farmerUid: json['farmerUid'] as String? ?? '',
        diagnosis: json['diagnosis'] as String? ?? '',
        medicines: ((json['medicines'] as List?) ?? const <dynamic>[])
            .map((e) => Medicine.fromJson(_map(e)))
            .toList(),
        advice: json['advice'] as String? ?? '',
        milkWithdrawalDays: _int(json['milkWithdrawalDays']),
        followUpDate: json['followUpDate'] as String? ?? '',
        createdAt: json['createdAt'] as String? ?? '',
      );
}

class ScheduleSlot {
  final String start;
  final String end;

  const ScheduleSlot({required this.start, required this.end});

  factory ScheduleSlot.fromJson(Map<String, dynamic> json) => ScheduleSlot(
        start: json['start'] as String? ?? '',
        end: json['end'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {'start': start, 'end': end};
}

class ScheduleDay {
  final int day;
  final List<ScheduleSlot> slots;

  const ScheduleDay({required this.day, required this.slots});

  factory ScheduleDay.fromJson(Map<String, dynamic> json) => ScheduleDay(
        day: _int(json['day']),
        slots: ((json['slots'] as List?) ?? const <dynamic>[])
            .map((e) => ScheduleSlot.fromJson(_map(e)))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'day': day,
        'slots': slots.map((s) => s.toJson()).toList(),
      };
}

class VetSchedule {
  final String vetId;
  final List<ScheduleDay> weeklySlots;
  final List<String> leaves;
  final bool emergencyAvailable;
  final bool teleAvailable;
  final String updatedAt;

  const VetSchedule({
    required this.vetId,
    required this.weeklySlots,
    required this.leaves,
    required this.emergencyAvailable,
    required this.teleAvailable,
    required this.updatedAt,
  });

  factory VetSchedule.fromJson(Map<String, dynamic> json) => VetSchedule(
        vetId: json['vetId'] as String? ?? '',
        weeklySlots: ((json['weeklySlots'] as List?) ?? const <dynamic>[])
            .map((e) => ScheduleDay.fromJson(_map(e)))
            .toList(),
        leaves: _strList(json['leaves']),
        emergencyAvailable: json['emergencyAvailable'] == true,
        teleAvailable: json['teleAvailable'] == true,
        updatedAt: json['updatedAt'] as String? ?? '',
      );
}

class VetWorkspace {
  final ManagedVet vet;
  final VetSchedule schedule;
  final int totalAppointments;
  final double monthEarnings;
  final double? ratingAvg;
  final int ratingCount;

  const VetWorkspace({
    required this.vet,
    required this.schedule,
    required this.totalAppointments,
    required this.monthEarnings,
    this.ratingAvg,
    this.ratingCount = 0,
  });

  factory VetWorkspace.fromJson(Map<String, dynamic> json) {
    final stats = _map(json['stats']);
    return VetWorkspace(
      vet: ManagedVet.fromJson(_map(json['vet'])),
      schedule: VetSchedule.fromJson(_map(json['schedule'])),
      totalAppointments: _int(stats['totalAppointments']),
      monthEarnings: _dbl(stats['monthEarnings']),
      ratingAvg: (stats['ratingAvg'] as num?)?.toDouble(),
      ratingCount: _int(stats['ratingCount']),
    );
  }
}

class VetEarnings {
  final String month;
  final int completedAppointments;
  final double totalEarnings;
  final double? ratingAvg;
  final int ratingCount;

  const VetEarnings({
    required this.month,
    required this.completedAppointments,
    required this.totalEarnings,
    this.ratingAvg,
    this.ratingCount = 0,
  });

  factory VetEarnings.fromJson(Map<String, dynamic> json) => VetEarnings(
        month: json['month'] as String? ?? '',
        completedAppointments: _int(json['completedAppointments']),
        totalEarnings: _dbl(json['totalEarnings']),
        ratingAvg: (json['ratingAvg'] as num?)?.toDouble(),
        ratingCount: _int(json['ratingCount']),
      );
}

class CampaignEnrollment {
  final String id;
  final String campaignId;
  final String animalId;
  final String farmerUid;
  final String status;
  final String vaccinatedAt;
  final String createdAt;

  const CampaignEnrollment({
    required this.id,
    required this.campaignId,
    required this.animalId,
    required this.farmerUid,
    required this.status,
    required this.vaccinatedAt,
    required this.createdAt,
  });

  factory CampaignEnrollment.fromJson(Map<String, dynamic> json) =>
      CampaignEnrollment(
        id: json['id'] as String? ?? '',
        campaignId: json['campaignId'] as String? ?? '',
        animalId: json['animalId'] as String? ?? '',
        farmerUid: json['farmerUid'] as String? ?? '',
        status: json['status'] as String? ?? 'enrolled',
        vaccinatedAt: json['vaccinatedAt'] as String? ?? '',
        createdAt: json['createdAt'] as String? ?? '',
      );
}

class VaccinationCampaign {
  final String id;
  final String title;
  final String vaccine;
  final String disease;
  final String fromDate;
  final String toDate;
  final List<String> targetDistricts;
  final String organizerId;
  final String status;
  final String createdAt;
  final List<CampaignEnrollment> enrollments;
  final int enrollmentCount;

  const VaccinationCampaign({
    required this.id,
    required this.title,
    required this.vaccine,
    required this.disease,
    required this.fromDate,
    required this.toDate,
    required this.targetDistricts,
    required this.organizerId,
    required this.status,
    required this.createdAt,
    this.enrollments = const [],
    this.enrollmentCount = 0,
  });

  factory VaccinationCampaign.fromJson(Map<String, dynamic> json) =>
      VaccinationCampaign(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        vaccine: json['vaccine'] as String? ?? '',
        disease: json['disease'] as String? ?? '',
        fromDate: json['fromDate'] as String? ?? '',
        toDate: json['toDate'] as String? ?? '',
        targetDistricts: _strList(json['targetDistricts']),
        organizerId: json['organizerId'] as String? ?? '',
        status: json['status'] as String? ?? 'upcoming',
        createdAt: json['createdAt'] as String? ?? '',
        enrollments: ((json['enrollments'] as List?) ?? const <dynamic>[])
            .map((e) => CampaignEnrollment.fromJson(_map(e)))
            .toList(),
        enrollmentCount: _int(json['enrollmentCount']),
      );
}
