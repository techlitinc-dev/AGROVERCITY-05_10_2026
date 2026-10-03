import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/demands_api.dart';
import 'package:kisan_setu/api/direct_buyer_api.dart';
import 'package:kisan_setu/api/offers_api.dart';
import 'package:kisan_setu/api/purchases_api.dart';
import 'package:kisan_setu/models/direct_buyer_models.dart';
import 'package:kisan_setu/models/user_profile_type.dart';
import 'package:kisan_setu/views/direct/buy_demands_view.dart';
import 'package:kisan_setu/views/direct/demand_detail_view.dart';
import 'package:kisan_setu/views/direct/demands_view.dart';
import 'package:kisan_setu/views/direct/offers_view.dart';
import 'package:kisan_setu/views/direct/purchase_detail_view.dart';
import 'package:kisan_setu/state/app_state.dart';
import 'package:kisan_setu/views/profile_home/direct_buyer_home_view.dart';

import 'helpers.dart';

class FakeDirectBuyerApi extends DirectBuyerApi {
  DirectBuyerAnalytics analytics = const DirectBuyerAnalytics(
    totalSpend: 125000,
    totalVolume: 320,
    activeDemands: 2,
    openOffers: 3,
    purchasesByStatus: {'completed': 4, 'inTransit': 1},
    monthlyProcurement: [],
    cropBreakdown: [],
    topSuppliers: [],
    avgPriceVsMandi: [
      MandiComparison(
          crop: 'Onion', avgPurchasePrice: 1850, mandiModalPrice: 1900),
    ],
    qcRejectionRate: 2.5,
    completionRate: 92,
    pendingBalance: 15000,
  );
  List<SavedFarmer> savedFarmers = const [];
  List<FeedLot> feed = const [];
  Map<String, dynamic> profile = const {
    'roleProfile': {'companyName': 'Shree Traders'}
  };

  final List<String> savedIds = [];
  final List<String> removedIds = [];

  @override
  Future<Map<String, dynamic>> getProfile() async => profile;

  @override
  Future<DirectBuyerAnalytics> getAnalytics() async => analytics;

  @override
  Future<List<SavedFarmer>> getSavedFarmers() async => savedFarmers;

  @override
  Future<void> saveFarmer(String farmerId) async {
    savedIds.add(farmerId);
  }

  @override
  Future<void> removeSavedFarmer(String farmerId) async {
    removedIds.add(farmerId);
  }

  @override
  Future<List<FeedLot>> getFeed({int limit = 20}) async => feed;
}

class FakeDemandsApi extends DemandsApi {
  Map<String, dynamic> listResponse = const {
    'data': <Map<String, dynamic>>[],
    'page': 1,
    'pageSize': 20,
    'total': 0,
  };
  Demand demandToReturn = _sampleDemand();

  final List<Map<String, dynamic>> createCalls = [];
  List<Map<String, dynamic>>? updateCalls;
  String? closedId;
  String? reopenedId;
  String? deletedId;

  @override
  Future<Demand> createDemand(Map<String, dynamic> fields) async {
    createCalls.add(fields);
    return Demand.fromJson({'id': 'dem_new', ...fields});
  }

  @override
  Future<Map<String, dynamic>> listDemands({
    String? crop,
    String? state,
    String status = 'open',
    int page = 1,
    int pageSize = 20,
  }) async =>
      listResponse;

  @override
  Future<Demand> getDemand(String id) async => demandToReturn;

  @override
  Future<Demand> updateDemand(String id, Map<String, dynamic> fields) async {
    updateCalls = [fields];
    return Demand.fromJson({'id': id, ...fields});
  }

  @override
  Future<Demand> closeDemand(String id) async {
    closedId = id;
    return demandToReturn;
  }

  @override
  Future<Demand> reopenDemand(String id) async {
    reopenedId = id;
    return demandToReturn;
  }

  @override
  Future<void> deleteDemand(String id) async {
    deletedId = id;
  }

  static Demand _sampleDemand() => Demand.fromJson(const {
        'id': 'dem_1',
        'buyerId': 'b1',
        'buyerName': 'Shree Traders',
        'buyerCompany': 'Shree Traders',
        'state': 'MH',
        'crop': 'Onion',
        'variety': 'Red',
        'quantity': 100,
        'unit': 'quintal',
        'qualityGrade': 'A',
        'maxPrice': 2100,
        'packaging': 'Jute',
        'deliveryLocation': 'Nashik',
        'neededBy': '2026-10-05',
        'frequency': 'oneTime',
        'notes': '',
        'status': 'open',
        'offersCount': 1,
        'createdAt': '2026-09-20T10:00:00Z',
        'updatedAt': '2026-09-20T10:00:00Z',
      });
}

class FakeOffersApi extends OffersApi {
  Map<String, dynamic> sentResponse = const {
    'data': <Map<String, dynamic>>[],
    'page': 1,
    'pageSize': 20,
    'total': 0,
  };
  Map<String, dynamic> receivedResponse = const {
    'data': <Map<String, dynamic>>[],
    'page': 1,
    'pageSize': 20,
    'total': 0,
  };

  Offer offerToReturn = Offer.fromJson(const {
    'id': 'off_1',
    'targetType': 'lot',
    'targetId': 'lot_1',
    'fromId': 'u1',
    'fromName': 'Ram Singh',
    'fromRole': 'farmer',
    'toId': 'u2',
    'toName': 'Shree Traders',
    'pricePerUnit': 1900,
    'quantity': 50,
    'unit': 'quintal',
    'message': '',
    'status': 'pending',
    'counter': null,
    'createdAt': '2026-09-20T10:00:00Z',
    'updatedAt': '2026-09-20T10:00:00Z',
  });

  final List<Map<String, dynamic>> createCalls = [];
  final List<String> acceptedIds = [];
  final List<String> rejectedIds = [];
  final List<String> withdrawnIds = [];
  final List<Map<String, dynamic>> counterCalls = [];

  @override
  Future<Offer> createOffer({
    required String targetType,
    required String targetId,
    required int pricePerUnit,
    required double quantity,
    String message = '',
  }) async {
    createCalls.add({
      'targetType': targetType,
      'targetId': targetId,
      'pricePerUnit': pricePerUnit,
      'quantity': quantity,
      'message': message,
    });
    return offerToReturn;
  }

  @override
  Future<Map<String, dynamic>> listMine({
    String filter = 'sent',
    String? targetType,
    int page = 1,
    int pageSize = 20,
  }) async =>
      filter == 'sent' ? sentResponse : receivedResponse;

  @override
  Future<Offer> getOffer(String id) async => offerToReturn;

  @override
  Future<Offer> accept(String id) async {
    acceptedIds.add(id);
    return offerToReturn;
  }

  @override
  Future<Offer> reject(String id) async {
    rejectedIds.add(id);
    return offerToReturn;
  }

  @override
  Future<Offer> withdraw(String id) async {
    withdrawnIds.add(id);
    return offerToReturn;
  }

  @override
  Future<Offer> counter(String id, int pricePerUnit, String note) async {
    counterCalls.add(
        {'id': id, 'pricePerUnit': pricePerUnit, 'note': note});
    return offerToReturn;
  }
}

class FakePurchasesApi extends PurchasesApi {
  Purchase purchase = _deliveredPurchase();
  Map<String, dynamic> listResponse = const {
    'data': <Map<String, dynamic>>[],
    'page': 1,
    'pageSize': 20,
    'total': 0,
  };
  PurchaseInvoice invoice = const PurchaseInvoice(
    purchaseId: 'pur_1',
    number: 'INV-PUR1ABCD-2609',
    issuedAt: '2026-09-25T10:00:00Z',
  );

  final List<Map<String, dynamic>> qcCalls = [];
  final List<String> resolveCalls = [];
  final List<Map<String, dynamic>> advanceCalls = [];
  final List<Map<String, dynamic>> paymentCalls = [];

  @override
  Future<Purchase> getPurchase(String id) async {
    if (resolveCalls.isNotEmpty) {
      return Purchase.fromJson(_completedJson());
    }
    if (qcCalls.isNotEmpty) {
      return Purchase.fromJson(_qcDisputedJson());
    }
    return purchase;
  }

  @override
  Future<Map<String, dynamic>> listPurchases({
    String? role,
    int page = 1,
    int pageSize = 20,
  }) async =>
      listResponse;

  @override
  Future<Purchase> payAdvance(String id,
      {required int amount, String method = '', String reference = ''}) async {
    advanceCalls
        .add({'id': id, 'amount': amount, 'method': method, 'reference': reference});
    return purchase;
  }

  @override
  Future<Purchase> recordQc(String id,
      {required String grade,
      required double acceptedQty,
      required double rejectedQty,
      String note = ''}) async {
    qcCalls.add({
      'id': id,
      'grade': grade,
      'acceptedQty': acceptedQty,
      'rejectedQty': rejectedQty,
      'note': note,
    });
    return purchase;
  }

  @override
  Future<Purchase> resolveDispute(String id, String resolution) async {
    resolveCalls.add(id);
    return purchase;
  }

  @override
  Future<Purchase> recordPayment(String id,
      {required int amount,
      String method = '',
      String reference = '',
      required String kind}) async {
    paymentCalls
        .add({'id': id, 'amount': amount, 'method': method, 'reference': reference, 'kind': kind});
    return purchase;
  }

  @override
  Future<PurchaseInvoice> getInvoice(String id) async => invoice;

  static Purchase _deliveredPurchase() => Purchase.fromJson(const {
        'id': 'pur_1',
        'buyerId': 'b1',
        'buyerName': 'Shree Traders',
        'farmerId': 'f1',
        'farmerName': 'Ram Singh',
        'source': {'type': 'lot', 'refId': 'lot_1'},
        'crop': 'Onion',
        'variety': 'Red',
        'quantity': 100,
        'unit': 'quintal',
        'agreedPricePerUnit': 1900,
        'totalAmount': 190000,
        'advancePaid': 0,
        'status': 'delivered',
        'pickup': {},
        'payments': [],
        'qc': {},
        'finalAmount': null,
        'invoice': null,
        'events': [
          {'status': 'confirmed', 'at': '2026-09-20T10:00:00Z', 'note': ''},
          {'status': 'delivered', 'at': '2026-09-24T10:00:00Z', 'note': ''},
        ],
        'rating': {'buyerToFarmer': null, 'farmerToBuyer': null},
        'createdAt': '2026-09-20T10:00:00Z',
        'updatedAt': '2026-09-24T10:00:00Z',
      });
}

const _feedLot = FeedLot(
  id: 'lot_1',
  farmerId: 'f1',
  farmerName: 'Ram Singh',
  farmerVillage: 'Niphad',
  crop: 'Onion',
  variety: 'Red',
  quantityQuintals: 40,
  expectedRate: 1850,
  harvestDate: '2026-09-28',
  status: 'open',
);

Future<void> enterByHint(
    WidgetTester tester, AppState state, String hintKey, String text) async {
  final hint = state.tr(hintKey);
  final field = find.byWidgetPredicate(
      (w) => w is TextField && w.decoration?.hintText == hint);
  expect(field, findsOneWidget, reason: 'field with hint $hint');
  await tester.enterText(field, text);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('direct buyer home renders analytics, feed and quick actions',
      (tester) async {
    final state = TestAppState(
      linked: const [UserProfileType.directBuyer],
      active: UserProfileType.directBuyer,
    );
    final directApi = FakeDirectBuyerApi()
      ..feed = const [_feedLot]
      ..analytics = const DirectBuyerAnalytics(
        totalSpend: 125000,
        totalVolume: 320,
        activeDemands: 2,
        openOffers: 3,
        purchasesByStatus: {'completed': 4, 'inTransit': 1},
        monthlyProcurement: [],
        cropBreakdown: [
          CropBreakdownItem(crop: 'Onion', spend: 90000, volume: 50, avgPrice: 1800),
        ],
        topSuppliers: [],
        avgPriceVsMandi: [
          MandiComparison(
              crop: 'Onion', avgPurchasePrice: 1850, mandiModalPrice: 1900),
        ],
        qcRejectionRate: 2.5,
        completionRate: 92,
        pendingBalance: 15000,
      );
    await pumpScreen(
      tester,
      DirectBuyerHomeView(
        state: state,
        directBuyerApi: directApi,
        purchasesApi: FakePurchasesApi(),
      ),
    );
    expect(find.text(state.tr('direct.totalSpendLabel')), findsOneWidget);
    expect(find.text('₹125000'), findsOneWidget);
    expect(find.text('Onion'), findsWidgets);
    expect(find.text(state.tr('direct.quickActionsTitle')), findsOneWidget);
    expect(find.text(state.tr('direct.priceVsMandiTitle')), findsOneWidget);
    expect(find.text('Shree Traders'), findsWidgets);
  });

  testWidgets('demand create form posts full payload', (tester) async {
    final state = TestAppState(
      linked: const [UserProfileType.directBuyer],
      active: UserProfileType.directBuyer,
    );
    final demandsApi = FakeDemandsApi();
    await pumpScreen(tester, DemandsView(state: state, demandsApi: demandsApi));
    await tester.tap(find.text(state.tr('direct.newDemand')));
    await tester.pumpAndSettle();

    await enterByHint(tester, state, 'direct.cropHint', 'Onion');
    await enterByHint(tester, state, 'direct.quantityHint', '50');
    await enterByHint(tester, state, 'direct.maxPriceHint', '2100');
    await enterByHint(tester, state, 'direct.packagingHint', 'Jute bags');
    await enterByHint(tester, state, 'direct.deliveryLocationHint', 'Nashik APMC');
    await tester.pump();

    await tester.tap(find.widgetWithText(
        ElevatedButton, state.tr('direct.newDemand')));
    await tester.pump(const Duration(seconds: 1));

    expect(demandsApi.createCalls, hasLength(1));
    final payload = demandsApi.createCalls.single;
    expect(payload['crop'], 'Onion');
    expect(payload['quantity'], 50.0);
    expect(payload['unit'], 'quintal');
    expect(payload['qualityGrade'], 'A');
    expect(payload['maxPrice'], 2100);
    expect(payload['packaging'], 'Jute bags');
    expect(payload['deliveryLocation'], 'Nashik APMC');
    expect(payload['frequency'], 'oneTime');
    expect(payload['neededBy'], isNotEmpty);
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('demand detail accept offer calls accept with offer id',
      (tester) async {
    final state = TestAppState(
      linked: const [UserProfileType.directBuyer],
      active: UserProfileType.directBuyer,
    );
    state.openDemandDetail('dem_1');
    final offersApi = FakeOffersApi()
      ..receivedResponse = {
        'data': [
          {
            'id': 'off_9',
            'targetType': 'demand',
            'targetId': 'dem_1',
            'fromId': 'f1',
            'fromName': 'Ram Singh',
            'fromRole': 'farmer',
            'toId': 'b1',
            'toName': 'Shree Traders',
            'pricePerUnit': 2000,
            'quantity': 100,
            'unit': 'quintal',
            'message': 'Ready to supply',
            'status': 'pending',
            'counter': null,
            'createdAt': '2026-09-21T10:00:00Z',
            'updatedAt': '2026-09-21T10:00:00Z',
          }
        ],
        'page': 1,
        'pageSize': 20,
        'total': 1,
      };
    await pumpScreen(
      tester,
      Scaffold(
        body: DemandDetailView(
            state: state, demandsApi: FakeDemandsApi(), offersApi: offersApi),
      ),
    );
    expect(find.text('Ram Singh'), findsOneWidget);
    await tester.tap(find.text(state.tr('direct.accept')));
    await tester.pump(const Duration(seconds: 1));
    expect(offersApi.acceptedIds, ['off_9']);
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('counter then accept flow on sent offers calls accept',
      (tester) async {
    final state = TestAppState(
      linked: const [UserProfileType.directBuyer],
      active: UserProfileType.directBuyer,
    );
    final offersApi = FakeOffersApi()
      ..sentResponse = {
        'data': [
          {
            'id': 'off_2',
            'targetType': 'lot',
            'targetId': 'lot_1',
            'fromId': 'b1',
            'fromName': 'Shree Traders',
            'fromRole': 'directBuyer',
            'toId': 'f1',
            'toName': 'Ram Singh',
            'pricePerUnit': 1900,
            'quantity': 50,
            'unit': 'quintal',
            'message': '',
            'status': 'countered',
            'counter': {
              'pricePerUnit': 2000,
              'by': 'f1',
              'note': '',
              'at': '2026-09-21T10:00:00Z'
            },
            'createdAt': '2026-09-20T10:00:00Z',
            'updatedAt': '2026-09-21T10:00:00Z',
          }
        ],
        'page': 1,
        'pageSize': 20,
        'total': 1,
      };
    await pumpScreen(tester, OffersView(state: state, offersApi: offersApi));
    expect(find.text('Ram Singh'), findsOneWidget);
    expect(find.text(state.tr('direct.acceptCounter')), findsOneWidget);
    await tester.tap(find.text(state.tr('direct.acceptCounter')));
    await tester.pump(const Duration(seconds: 1));
    expect(offersApi.acceptedIds, ['off_2']);
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('offers view renders sent and received tabs', (tester) async {
    final state = TestAppState(
      linked: const [UserProfileType.directBuyer],
      active: UserProfileType.directBuyer,
    );
    final offersApi = FakeOffersApi()
      ..sentResponse = {
        'data': [
          {
            'id': 'off_3',
            'targetType': 'demand',
            'targetId': 'dem_1',
            'fromId': 'b1',
            'fromName': 'Shree Traders',
            'fromRole': 'directBuyer',
            'toId': 'f2',
            'toName': 'Kiran Pawar',
            'pricePerUnit': 2200,
            'quantity': 20,
            'unit': 'quintal',
            'message': '',
            'status': 'pending',
            'counter': null,
            'createdAt': '2026-09-20T10:00:00Z',
            'updatedAt': '2026-09-20T10:00:00Z',
          }
        ],
        'page': 1,
        'pageSize': 20,
        'total': 1,
      }
      ..receivedResponse = {
        'data': [
          {
            'id': 'off_4',
            'targetType': 'lot',
            'targetId': 'lot_9',
            'fromId': 'f1',
            'fromName': 'Ram Singh',
            'fromRole': 'farmer',
            'toId': 'b1',
            'toName': 'Shree Traders',
            'pricePerUnit': 1800,
            'quantity': 30,
            'unit': 'quintal',
            'message': '',
            'status': 'pending',
            'counter': null,
            'createdAt': '2026-09-22T10:00:00Z',
            'updatedAt': '2026-09-22T10:00:00Z',
          }
        ],
        'page': 1,
        'pageSize': 20,
        'total': 1,
      };
    await pumpScreen(tester, OffersView(state: state, offersApi: offersApi));
    expect(find.text('Kiran Pawar'), findsOneWidget);
    await tester.tap(find.text(state.tr('direct.receivedTab')));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('Ram Singh'), findsOneWidget);
    expect(find.text(state.tr('direct.accept')), findsOneWidget);
  });

  testWidgets(
      'purchase detail shows timeline and QC action for delivered status',
      (tester) async {
    final state = TestAppState();
    state.openPurchaseDetail('pur_1');
    final purchasesApi = FakePurchasesApi();
    await pumpScreen(
      tester,
      Scaffold(
          body:
              PurchaseDetailView(state: state, purchasesApi: purchasesApi)),
    );
    expect(find.text(state.tr('direct.st_confirmed')), findsWidgets);
    expect(find.text(state.tr('direct.st_delivered')), findsWidgets);
    expect(find.text(state.tr('direct.qcFormTitle')), findsOneWidget);
    expect(find.text(state.tr('direct.cancelPurchaseBtn')), findsNothing);
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('partial QC opens dispute and resolve completes it',
      (tester) async {
    final state = TestAppState();
    state.openPurchaseDetail('pur_1');
    final purchasesApi = FakePurchasesApi();
    await pumpScreen(
      tester,
      Scaffold(
          body:
              PurchaseDetailView(state: state, purchasesApi: purchasesApi)),
    );

    await tester.tap(find.text(state.tr('direct.qcFormTitle')));
    await tester.pumpAndSettle();

    final acceptedField = find.widgetWithText(
        Container, state.tr('direct.qcAcceptedQtyHint'));
    await tester.enterText(
        find.descendant(of: acceptedField, matching: find.byType(TextField)),
        '80');
    await tester.pump();
    await tester.tap(find.widgetWithText(
        ElevatedButton, state.tr('direct.qcSubmitBtn')));
    await tester.pump(const Duration(seconds: 1));

    expect(purchasesApi.qcCalls, hasLength(1));
    expect(purchasesApi.qcCalls.single['acceptedQty'], 80.0);
    expect(purchasesApi.qcCalls.single['rejectedQty'], 20.0);

    await tester.tap(find.text(state.tr('direct.resolveDisputeBtn')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, 'Adjusted 20q rejection');
    await tester.pump();
    await tester.tap(find
        .widgetWithText(ElevatedButton, state.tr('direct.resolveDisputeBtn'))
        .last);
    await tester.pump(const Duration(seconds: 1));
    expect(purchasesApi.resolveCalls, ['pur_1']);
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('invoice sheet renders from fake invoice', (tester) async {
    final state = TestAppState();
    state.openPurchaseDetail('pur_1');
    final purchasesApi = FakePurchasesApi()
      ..purchase = Purchase.fromJson(const {
        'id': 'pur_1',
        'buyerId': 'b1',
        'buyerName': 'Shree Traders',
        'farmerId': 'f1',
        'farmerName': 'Ram Singh',
        'source': {'type': 'lot', 'refId': 'lot_1'},
        'crop': 'Onion',
        'variety': 'Red',
        'quantity': 100,
        'unit': 'quintal',
        'agreedPricePerUnit': 1900,
        'totalAmount': 190000,
        'advancePaid': 50000,
        'status': 'completed',
        'pickup': {},
        'payments': [
          {
            'id': 'pay_1',
            'kind': 'advance',
            'amount': 50000,
            'method': 'UPI',
            'reference': 'upi123',
            'at': '2026-09-21T10:00:00Z',
          }
        ],
        'qc': {'grade': 'A', 'acceptedQty': 100, 'rejectedQty': 0, 'note': ''},
        'finalAmount': 190000,
        'invoice': {
          'number': 'INV-PUR1ABCD-2609',
          'issuedAt': '2026-09-25T10:00:00Z'
        },
        'events': [
          {'status': 'confirmed', 'at': '2026-09-20T10:00:00Z', 'note': ''},
          {'status': 'completed', 'at': '2026-09-25T10:00:00Z', 'note': ''},
        ],
        'rating': {'buyerToFarmer': null, 'farmerToBuyer': null},
        'createdAt': '2026-09-20T10:00:00Z',
        'updatedAt': '2026-09-25T10:00:00Z',
      });
    await pumpScreen(
      tester,
      Scaffold(
          body:
              PurchaseDetailView(state: state, purchasesApi: purchasesApi)),
    );
    await tester.tap(find.text(state.tr('direct.invoiceBtn')));
    await tester.pumpAndSettle();
    expect(find.text('INV-PUR1ABCD-2609'), findsOneWidget);
    expect(
        find.textContaining(state.tr('direct.invoiceIssuedLabel')),
        findsOneWidget);
    expect(find.text(state.tr('direct.balanceDueLabel')), findsWidgets);
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('farmer buy-demands offer submits demand-targeted offer',
      (tester) async {
    final state = TestAppState();
    final demandsApi = FakeDemandsApi()
      ..listResponse = {
        'data': [
          {
            'id': 'dem_7',
            'buyerId': 'b1',
            'buyerName': 'Shree Traders',
            'buyerCompany': 'Shree Traders',
            'state': 'MH',
            'crop': 'Onion',
            'variety': 'Red',
            'quantity': 100,
            'unit': 'quintal',
            'qualityGrade': 'A',
            'maxPrice': 2100,
            'packaging': '',
            'deliveryLocation': 'Nashik',
            'neededBy': '2026-10-05',
            'frequency': 'oneTime',
            'notes': '',
            'status': 'open',
            'offersCount': 0,
            'createdAt': '2026-09-20T10:00:00Z',
            'updatedAt': '2026-09-20T10:00:00Z',
          }
        ],
        'page': 1,
        'pageSize': 20,
        'total': 1,
      };
    final offersApi = FakeOffersApi();
    await pumpScreen(
      tester,
      BuyDemandsView(
          state: state, demandsApi: demandsApi, offersApi: offersApi),
    );
    expect(find.textContaining('Shree Traders'), findsOneWidget);
    await tester.tap(find.text(state.tr('direct.makeOfferBtn')));
    await tester.pumpAndSettle();

    await enterByHint(tester, state, 'direct.offerPriceHint', '2000');
    await tester.pump();
    await tester.tap(find.widgetWithText(
        ElevatedButton, state.tr('direct.submitOfferBtn')));
    await tester.pump(const Duration(seconds: 1));

    expect(offersApi.createCalls, hasLength(1));
    final call = offersApi.createCalls.single;
    expect(call['targetType'], 'demand');
    expect(call['targetId'], 'dem_7');
    expect(call['pricePerUnit'], 2000);
    expect(call['quantity'], 100.0);
    await tester.pump(const Duration(seconds: 5));
  });
}

Map<String, dynamic> _completedJson() => {
      ..._qcDisputedJson(),
      'status': 'completed',
      'invoice': {
        'number': 'INV-PUR1ABCD-2609',
        'issuedAt': '2026-09-25T10:00:00Z'
      },
      'events': [
        {'status': 'confirmed', 'at': '2026-09-20T10:00:00Z', 'note': ''},
        {'status': 'delivered', 'at': '2026-09-24T10:00:00Z', 'note': ''},
        {'status': 'qcDisputed', 'at': '2026-09-24T12:00:00Z', 'note': ''},
        {'status': 'resolved', 'at': '2026-09-24T13:00:00Z', 'note': 'ok'},
        {'status': 'completed', 'at': '2026-09-25T10:00:00Z', 'note': ''},
      ],
    };

Map<String, dynamic> _qcDisputedJson() => {
      'id': 'pur_1',
      'buyerId': 'b1',
      'buyerName': 'Shree Traders',
      'farmerId': 'f1',
      'farmerName': 'Ram Singh',
      'source': {'type': 'lot', 'refId': 'lot_1'},
      'crop': 'Onion',
      'variety': 'Red',
      'quantity': 100,
      'unit': 'quintal',
      'agreedPricePerUnit': 1900,
      'totalAmount': 190000,
      'advancePaid': 0,
      'status': 'qcDisputed',
      'pickup': {},
      'payments': [],
      'qc': {
        'grade': 'A',
        'acceptedQty': 80,
        'rejectedQty': 20,
        'note': '',
        'at': '2026-09-24T12:00:00Z'
      },
      'finalAmount': 152000,
      'invoice': null,
      'events': [
        {'status': 'confirmed', 'at': '2026-09-20T10:00:00Z', 'note': ''},
        {'status': 'delivered', 'at': '2026-09-24T10:00:00Z', 'note': ''},
        {'status': 'qcDisputed', 'at': '2026-09-24T12:00:00Z', 'note': ''},
      ],
      'rating': {'buyerToFarmer': null, 'farmerToBuyer': null},
      'createdAt': '2026-09-20T10:00:00Z',
      'updatedAt': '2026-09-24T12:00:00Z',
    };
