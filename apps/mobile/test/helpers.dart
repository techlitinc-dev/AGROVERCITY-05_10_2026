import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:kisan_setu/api/addresses_api.dart';
import 'package:kisan_setu/api/auth_api.dart';
import 'package:kisan_setu/api/contracts_api.dart';
import 'package:kisan_setu/api/lots_api.dart';
import 'package:kisan_setu/api/mandi_api.dart';
import 'package:kisan_setu/api/marketplace_api.dart';
import 'package:kisan_setu/api/my_products_api.dart';
import 'package:kisan_setu/api/orders_api.dart';
import 'package:kisan_setu/api/transport_api.dart';
import 'package:kisan_setu/api/user_api.dart';
import 'package:kisan_setu/core/phone_auth.dart';
import 'package:kisan_setu/core/photo_upload.dart';
import 'package:kisan_setu/models/emarket_models.dart';
import 'package:kisan_setu/models/user_profile_type.dart';
import 'package:kisan_setu/state/app_state.dart';

class TestAppState extends AppState {
  TestAppState({
    this.linked = const [UserProfileType.farmer],
    this.active = UserProfileType.farmer,
    this.user,
    super.initialLanguage = 'hi',
    super.authApi,
    super.userApi,
    super.marketplaceApi,
  });

  final List<UserProfileType> linked;
  final UserProfileType active;
  final Map<String, dynamic>? user;

  @override
  List<UserProfileType> get linkedProfiles => linked;

  @override
  UserProfileType get activeProfile => active;

  @override
  Map<String, dynamic>? get currentUser => user ?? super.currentUser;
}

Future<void> pumpScreen(WidgetTester tester, Widget screen) async {
  tester.view.physicalSize = const Size(800, 1600);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(home: screen));
  await tester.pump(const Duration(seconds: 1));
}

Future<void> openCheckoutSheet(
  WidgetTester tester,
  TestAppState state, {
  required Widget Function() buildSheet,
}) async {
  await pumpScreen(
    tester,
    Builder(
      builder: (context) => Scaffold(
        body: Center(
          child: ElevatedButton(
            onPressed: () => showModalBottomSheet(
              context: context,
              isScrollControlled: true,
              backgroundColor: Colors.white,
              shape: const RoundedRectangleBorder(
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              builder: (_) => buildSheet(),
            ),
            child: const Text('open'),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('open'));
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
}

class RecordedRequest {
  RecordedRequest(this.method, this.path, this.headers, this.body);

  final String method;
  final String path;
  final Map<String, dynamic> headers;
  final dynamic body;
}

// Routes requests by exact path in registration order; handlers may mutate
// adapter state between calls (e.g. 401 first, 200 after refresh).
class FakeHttpAdapter implements HttpClientAdapter {
  final Map<String, List<ResponseBody Function()>> _routes = {};
  final List<RecordedRequest> requests = [];

  void on(String method, String path, ResponseBody Function() respond) {
    _routes.putIfAbsent('$method $path', () => []).add(respond);
  }

  void onGet(String path, ResponseBody Function() respond) =>
      on('GET', path, respond);
  void onPost(String path, ResponseBody Function() respond) =>
      on('POST', path, respond);
  void onPut(String path, ResponseBody Function() respond) =>
      on('PUT', path, respond);

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    dynamic body;
    if (requestStream != null) {
      final bytes = await requestStream.fold<List<int>>(
        [],
        (acc, chunk) => acc..addAll(chunk),
      );
      if (bytes.isNotEmpty) body = jsonDecode(utf8.decode(bytes));
    }
    requests.add(RecordedRequest(
      options.method,
      options.path,
      options.headers,
      body,
    ));
    final queue = _routes['${options.method} ${options.path}'];
    if (queue == null || queue.isEmpty) {
      return jsonResponse({'error': 'no fake route for ${options.path}'}, 404);
    }
    final respond = queue.length > 1 ? queue.removeAt(0) : queue.first;
    return respond();
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody jsonResponse(Object data, int statusCode) {
  return ResponseBody.fromString(
    jsonEncode(data),
    statusCode,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}

ResponseBody errorEnvelope(String code, int statusCode,
        {String message = '', Map<String, dynamic> fieldErrors = const {}}) =>
    jsonResponse({
      'error': {'code': code, 'message': message, 'fieldErrors': fieldErrors},
    }, statusCode);

class FakeAuthApi extends AuthApi {
  Map<String, dynamic>? lastRegisterBody;
  Object? registerError;

  @override
  Future<Map<String, dynamic>> register({
    required String idToken,
    required String name,
    required String phone,
    required String state,
    required String district,
    required String tehsil,
    required String village,
    required double landAreaAcres,
    required String soilType,
    required String irrigationType,
    required List<String> crops,
    required String mpin,
    required List<String> profiles,
    required String primaryProfile,
    String? referralCode,
    Map<String, Map<String, dynamic>>? roleProfiles,
    String? language,
    String? preferredLanguage,
  }) async {
    lastRegisterBody = {
      'idToken': idToken,
      'name': name,
      'phone': phone,
      'state': state,
      'district': district,
      'tehsil': tehsil,
      'village': village,
      'landAreaAcres': landAreaAcres,
      'soilType': soilType,
      'irrigationType': irrigationType,
      'crops': crops,
      'mpin': mpin,
      'profiles': profiles,
      'primaryProfile': primaryProfile,
      'referralCode': ?referralCode,
      'roleProfiles': ?roleProfiles,
      'language': language,
      'preferredLanguage': preferredLanguage,
    };
    final error = registerError;
    if (error != null) throw error;
    return {
      'accessToken': 'a',
      'refreshToken': 'r',
      'isNewUser': false,
      'user': <String, dynamic>{},
    };
  }
}

class FakeUserApi extends UserApi {
  FakeUserApi([this.userToReturn = const {}]);

  Map<String, dynamic>? lastUpdateFields;
  final Map<String, dynamic> userToReturn;

  String? lastActivated;
  String? lastLinked;
  String? lastUnlinked;
  Map<String, dynamic>? activateResponse;
  Object? unlinkError;

  @override
  Future<Map<String, dynamic>> updateMe(Map<String, dynamic> fields) async {
    lastUpdateFields = fields;
    return userToReturn;
  }

  @override
  Future<Map<String, dynamic>> activateProfile(String profileType) async {
    lastActivated = profileType;
    return activateResponse ?? {'user': userToReturn};
  }

  @override
  Future<Map<String, dynamic>> linkProfile(String profileType) async {
    lastLinked = profileType;
    return userToReturn;
  }

  @override
  Future<Map<String, dynamic>> unlinkProfile(String profileType) async {
    lastUnlinked = profileType;
    final error = unlinkError;
    if (error != null) throw error;
    return userToReturn;
  }
}

class FakeMandiApi extends MandiApi {
  Map<String, dynamic> pricesResponse = const {'data': <Map<String, dynamic>>[], 'page': 1, 'pageSize': 20, 'total': 0};
  Map<String, dynamic> vyapariResponse = const {'data': <Map<String, dynamic>>[], 'cachedAt': ''};
  Map<String, dynamic> compareResponse = const {'data': <Map<String, dynamic>>[]};
  Map<String, dynamic> historyResponse = const {'data': <Map<String, dynamic>>[]};
  Object? pricesError;
  Object? vyapariError;

  String? lastPricesCrop;
  String? lastVyapariCrops;
  String? lastHistoryCrop;
  String? lastHistoryMandi;
  int? lastHistoryMonths;

  @override
  Future<Map<String, dynamic>> getPrices({String? crop, int page = 1}) async {
    lastPricesCrop = crop;
    final error = pricesError;
    if (error != null) throw error;
    return pricesResponse;
  }

  @override
  Future<Map<String, dynamic>> getVyapariRates({List<String>? crops}) async {
    lastVyapariCrops = crops?.join(',');
    final error = vyapariError;
    if (error != null) throw error;
    return vyapariResponse;
  }

  @override
  Future<Map<String, dynamic>> compare(
    String crop,
    double quantityQuintals,
    double lat,
    double lng,
  ) async =>
      compareResponse;

  @override
  Future<Map<String, dynamic>> getPriceHistory(
    String crop,
    String mandi, {
    int months = 3,
  }) async {
    lastHistoryCrop = crop;
    lastHistoryMandi = mandi;
    lastHistoryMonths = months;
    return historyResponse;
  }
}

class FakeLotsApi extends LotsApi {
  Map<String, dynamic> lotsResponse = const {'data': <Map<String, dynamic>>[], 'page': 1, 'pageSize': 20, 'total': 0};

  Map<String, dynamic>? lastCreateFields;
  String? lastUpdatedId;
  Map<String, dynamic>? lastUpdateFields;
  String? lastWithdrawnId;

  @override
  Future<Map<String, dynamic>> createLot(Map<String, dynamic> fields) async {
    lastCreateFields = fields;
    return {'id': 'lot_new', 'status': 'open', ...fields};
  }

  @override
  Future<Map<String, dynamic>> getMyLots({String? status, int page = 1}) async =>
      lotsResponse;

  @override
  Future<Map<String, dynamic>> updateLot(
    String id,
    Map<String, dynamic> fields,
  ) async {
    lastUpdatedId = id;
    lastUpdateFields = fields;
    return {'id': id, ...fields};
  }

  @override
  Future<Map<String, dynamic>> withdrawLot(String id) async {
    lastWithdrawnId = id;
    return {'ok': true, 'status': 'withdrawn'};
  }
}

class FakeMarketplaceApi extends MarketplaceApi {
  Map<String, dynamic> productsResponse = const {'data': <Map<String, dynamic>>[], 'page': 1, 'pageSize': 20, 'total': 0};
  Map<String, dynamic> certificateResponse = const {};
  Map<String, dynamic> cartResponse = const {'data': <Map<String, dynamic>>[], 'cartTotal': 0};
  Object? productsError;

  Map<String, dynamic> productResponse = const {};
  Map<String, dynamic> reviewsResponse = const {'data': <Map<String, dynamic>>[], 'page': 1, 'pageSize': 20, 'total': 0};

  String? lastCategory;
  String? lastQuery;
  final List<Map<String, dynamic>> addedItems = [];
  final List<Map<String, dynamic>> postReviewCalls = [];

  @override
  Future<Map<String, dynamic>> getProducts({String? category, String? query, int page = 1}) async {
    lastCategory = category;
    lastQuery = query;
    final error = productsError;
    if (error != null) throw error;
    return productsResponse;
  }

  @override
  Future<Map<String, dynamic>> getProduct(String id) async => productResponse;

  @override
  Future<Map<String, dynamic>> postReview(
    String productId,
    int rating,
    String comment,
  ) async {
    postReviewCalls.add({
      'productId': productId,
      'rating': rating,
      'comment': comment,
    });
    return {
      'id': 'rev_fake_${postReviewCalls.length}',
      'productId': productId,
      'userId': 'u1',
      'userName': 'मी',
      'rating': rating,
      'comment': comment,
      'createdAt': '2026-09-17T10:00:00.000Z',
      'updatedAt': '2026-09-17T10:00:00.000Z',
    };
  }

  @override
  Future<Map<String, dynamic>> listReviews(String productId) async =>
      reviewsResponse;

  @override
  Future<Map<String, dynamic>> getCertificate(String id) async =>
      certificateResponse;

  @override
  Future<Map<String, dynamic>> getCart() async => cartResponse;

  @override
  Future<Map<String, dynamic>> addToCart(String productId, int quantity) async {
    addedItems.add({'productId': productId, 'quantity': quantity});
    return cartResponse;
  }
}

class FakeOrdersApi extends OrdersApi {
  Map<String, dynamic> ordersResponse = const {'data': <Map<String, dynamic>>[], 'page': 1, 'pageSize': 20, 'total': 0};
  Object? placeOrderError;

  final List<String> idempotencyKeys = [];
  final List<Map<String, dynamic>> placeOrderCalls = [];
  final List<String> cancelledIds = [];
  final List<String> razorpayOrderIds = [];
  final List<Map<String, dynamic>> returnCalls = [];
  List<Map<String, dynamic>> timelineResponse = const [];
  String? lastAddressId;
  int _orderSeq = 0;

  @override
  Future<Map<String, dynamic>> placeOrder({
    required List<Map<String, dynamic>> items,
    required String paymentMethod,
    required String deliveryAddress,
    required String idempotencyKey,
    String? addressId,
    String? couponCode,
  }) async {
    idempotencyKeys.add(idempotencyKey);
    lastAddressId = addressId;
    placeOrderCalls.add({
      'items': items,
      'paymentMethod': paymentMethod,
      'deliveryAddress': deliveryAddress,
      'addressId': addressId,
      'idempotencyKey': idempotencyKey,
      'couponCode': couponCode,
    });
    final error = placeOrderError;
    if (error != null) throw error;
    _orderSeq += 1;
    return {'orderId': 'ord_fake_$_orderSeq', 'total': 1230};
  }

  @override
  Future<Map<String, dynamic>> getOrders({int page = 1}) async => ordersResponse;

  @override
  Future<Map<String, dynamic>> cancelOrder(String id) async {
    cancelledIds.add(id);
    return {'id': id, 'status': 'cancelled', 'refundStatus': 'none'};
  }

  @override
  Future<List<OrderTimelineEvent>> getTimeline(String id) async =>
      timelineResponse.map(OrderTimelineEvent.fromJson).toList();

  @override
  Future<Map<String, dynamic>> requestReturn(String id, String reason) async {
    returnCalls.add({'id': id, 'reason': reason});
    return {'id': id, 'returnStatus': 'requested'};
  }

  @override
  Future<Map<String, dynamic>> createRazorpayOrder(String orderId) async {
    razorpayOrderIds.add(orderId);
    return {'razorpayOrderId': 'order_dev_$orderId', 'amount': 123000, 'currency': 'INR', 'keyId': 'rzp_test_dev'};
  }

  @override
  Future<Map<String, dynamic>> verifyRazorpayPayment({
    required String orderId,
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async =>
      {'ok': true, 'status': 'paid'};
}

class FakeAddressesApi extends AddressesApi {
  Map<String, dynamic> addressesResponse = const {'data': <Map<String, dynamic>>[]};

  Map<String, dynamic>? lastCreateFields;
  String? lastUpdatedId;
  Map<String, dynamic>? lastUpdateFields;
  String? lastDeletedId;

  @override
  Future<Map<String, dynamic>> getAddresses() async => addressesResponse;

  @override
  Future<Map<String, dynamic>> createAddress(Map<String, dynamic> fields) async {
    lastCreateFields = fields;
    return {'id': 'addr_new', ...fields};
  }

  @override
  Future<Map<String, dynamic>> updateAddress(String id, Map<String, dynamic> fields) async {
    lastUpdatedId = id;
    lastUpdateFields = fields;
    return {'id': id, ...fields};
  }

  @override
  Future<void> deleteAddress(String id) async {
    lastDeletedId = id;
  }
}

class FakePhoneAuth extends PhoneAuth {
  String? lastPhone;

  @override
  Future<void> sendOtp({
    required String phone,
    required void Function(String verificationId) onCodeSent,
    required void Function(String message) onFailed,
    void Function(String idToken)? onAutoVerified,
  }) async {
    lastPhone = phone;
    onCodeSent('fake-vid');
  }

  @override
  Future<String?> verifyOtp({
    required String verificationId,
    required String otp,
  }) async =>
      'fake-id-token';
}

class FakeContractsApi extends ContractsApi {
  Map<String, dynamic> contractsResponse = const {
    'data': <Map<String, dynamic>>[],
    'page': 1,
    'pageSize': 20,
    'total': 0,
  };
  Map<String, dynamic> detailResponse = const {'termsText': ''};
  Object? acceptError;

  String? lastAcceptedId;
  String? lastMpin;
  String? lastSignatureData;

  @override
  Future<Map<String, dynamic>> getContracts({String? status, int page = 1}) async =>
      contractsResponse;

  @override
  Future<Map<String, dynamic>> getContract(String id) async => detailResponse;

  @override
  Future<Map<String, dynamic>> acceptContract(
    String id, {
    required String signatureData,
    required String consentTimestamp,
    required String mpin,
  }) async {
    lastAcceptedId = id;
    lastMpin = mpin;
    lastSignatureData = signatureData;
    final error = acceptError;
    if (error != null) throw error;
    return {'ok': true, 'status': 'accepted', 'contractId': id};
  }
}

class FakeTransportApi extends TransportApi {
  Map<String, dynamic> vehicleTypesResponse = const {
    'data': [
      {'type': 'Tata Ace', 'baseFare': 500, 'perKmRate': 35, 'capacityTonnes': 0.75},
      {'type': 'Bolero Maxi', 'baseFare': 800, 'perKmRate': 45, 'capacityTonnes': 1.5},
      {'type': 'Tractor Trolley', 'baseFare': 1000, 'perKmRate': 30, 'capacityTonnes': 3.0},
    ],
  };
  Map<String, dynamic> fareResponse = const {
    'baseFare': 500,
    'distanceFare': 700,
    'totalFare': 1200,
  };
  Map<String, dynamic> bookingsResponse = const {
    'data': <Map<String, dynamic>>[],
    'page': 1,
    'pageSize': 20,
    'total': 0,
  };
  Map<String, dynamic> myVehiclesResponse = const {
    'data': <Map<String, dynamic>>[],
  };
  Map<String, dynamic> calendarResponse = const {'vehicleId': '', 'bookings': <Map<String, dynamic>>[]};

  bool? lastVerifiedOnly;
  final List<Map<String, dynamic>> createBookingCalls = [];
  final List<Map<String, dynamic>> updateBookingCalls = [];
  final List<Map<String, dynamic>> acceptBookingCalls = [];
  final List<Map<String, dynamic>> rejectBookingCalls = [];
  final List<Map<String, dynamic>> createVehicleCalls = [];
  final List<List<String>> availabilityCalls = [];

  @override
  Future<Map<String, dynamic>> getVehicleTypes({bool extended = false}) async =>
      vehicleTypesResponse;

  @override
  Future<Map<String, dynamic>> fareEstimate(
          String vehicleType, double distanceKm) async =>
      fareResponse;

  @override
  Future<Map<String, dynamic>> createBooking({
    required String vehicleType,
    required double distanceKm,
    required String pickup,
    required String drop,
    required String date,
    String? lotId,
    String? commodity,
    double? weightQuintals,
    String? packaging,
    String? notes,
  }) async {
    createBookingCalls.add({
      'vehicleType': vehicleType,
      'distanceKm': distanceKm,
      'pickup': pickup,
      'drop': drop,
      'date': date,
      'lotId': lotId,
      'commodity': commodity,
      'weightQuintals': weightQuintals,
      'packaging': packaging,
      'notes': notes,
    });
    return {'id': 'bk_new', 'status': 'requested'};
  }

  @override
  Future<Map<String, dynamic>> getBookings({String? status, int page = 1}) async =>
      bookingsResponse;

  @override
  Future<Map<String, dynamic>> updateBooking(
    String id,
    String status, {
    String? vehicleId,
    String? vehicleNo,
    List<String>? podPhotos,
    String? receiverName,
    String? receiverPhone,
    String? damageNotes,
  }) async {
    updateBookingCalls.add({
      'id': id,
      'status': status,
      'vehicleId': vehicleId,
      'vehicleNo': vehicleNo,
      'podPhotos': podPhotos,
      'receiverName': receiverName,
      'receiverPhone': receiverPhone,
      'damageNotes': damageNotes,
    });
    return {'id': id, 'status': status};
  }

  @override
  Future<Map<String, dynamic>> acceptBooking(
    String id, {
    String? vehicleId,
    String? vehicleNo,
    String? driverName,
    String? driverPhone,
  }) async {
    acceptBookingCalls.add({
      'id': id,
      'vehicleId': vehicleId,
      'vehicleNo': vehicleNo,
      'driverName': driverName,
      'driverPhone': driverPhone,
    });
    return {'id': id, 'status': 'accepted'};
  }

  @override
  Future<Map<String, dynamic>> rejectBooking(String id, String reason) async {
    rejectBookingCalls.add({'id': id, 'reason': reason});
    return {'id': id, 'status': 'cancelled'};
  }

  @override
  Future<Map<String, dynamic>> getMyVehicles({bool verifiedOnly = false}) async {
    lastVerifiedOnly = verifiedOnly;
    return myVehiclesResponse;
  }

  @override
  Future<Map<String, dynamic>> createVehicle({
    required String vehicleType,
    required String registrationNo,
    required double capacityTonnes,
    String? rcDocUrl,
    String? insuranceDocUrl,
    String? pucExpiry,
    String? fitnessExpiry,
    String? insuranceExpiry,
    String? permitType,
    String? driverName,
    String? driverPhone,
    String? driverLicense,
  }) async {
    createVehicleCalls.add({
      'vehicleType': vehicleType,
      'registrationNo': registrationNo,
      'capacityTonnes': capacityTonnes,
      'rcDocUrl': rcDocUrl,
      'insuranceDocUrl': insuranceDocUrl,
    });
    return {'id': 'veh_new', 'docStatus': 'pending', 'active': true};
  }

  @override
  Future<Map<String, dynamic>> getVehicleCalendar(String id) async => calendarResponse;

  @override
  Future<Map<String, dynamic>> setAvailability(String id, List<String> dates) async {
    availabilityCalls.add(dates);
    return {'id': id, 'availableDates': dates};
  }

  @override
  Future<Map<String, dynamic>> getTransporterProfile() async => {
        'profile': {
          'businessName': 'जय किसान लॉजिस्टिक्स',
          'transporterType': 'owner_driver',
          'vehicleType': 'Tata Ace',
          'rcNumber': 'MH-15-AB-1234',
          'contactPhone': '+91 98220 12345',
          'operatingRoutes': ['पिंपलगाव ➔ नासिक', 'निफाड ➔ मुंबई'],
          'operatingStates': ['महाराष्ट्र'],
          'specializations': ['ताजी सब्जियां'],
          'fleetSize': 2,
          'experienceYears': 5,
        },
        'stats': {
          'totalVehicles': 2,
          'totalTrips': 48,
          'activeTrips': 2,
          'lifetimeEarnings': 185000,
          'rating': 4.8,
          'onTimeRate': 98.0,
          'verified': true,
        },
      };

  @override
  Future<Map<String, dynamic>> updateTransporterProfile(
          Map<String, dynamic> data) async =>
      data;

  @override
  Future<Map<String, dynamic>> getOpenLoads(
          {String? crop, String? pickup, String? drop}) async =>
      {
        'data': [
          {
            'id': 'load_test_1',
            'farmerName': 'राजाराम पाटिल',
            'pickupLocation': 'पिंपलगाव, नासिक',
            'dropLocation': 'आज़ादपुर मंडी, दिल्ली',
            'crop': 'टमाटर (Tomato)',
            'quantityQuintals': 35.0,
            'packaging': 'Plastic Crates',
            'perishable': true,
            'preferredVehicleType': 'Tata Ace',
            'pickupDate': '2026-09-28',
            'targetFare': 38000,
            'bidsCount': 1,
            'status': 'open',
          }
        ],
        'total': 1,
      };

  @override
  Future<Map<String, dynamic>> submitLoadBid(
    String loadId, {
    required double quotedFare,
    String? vehicleId,
    String? vehicleNo,
    String? estimatedPickupTime,
    String? notes,
  }) async =>
      {
        'id': 'bid_test_1',
        'loadId': loadId,
        'quotedFare': quotedFare,
        'status': 'pending',
      };

  @override
  Future<Map<String, dynamic>> getDigitalBilty(String bookingId) async => {
        'lrNumber': 'LR-2026-TEST',
        'bookingId': bookingId,
        'consignor': {'name': 'किसान', 'location': 'पिंपलगाव'},
        'consignee': {'name': 'मंडी आढ़ती', 'destination': 'नासिक APMC'},
        'vehicleDetails': {'vehicleNo': 'MH-15-AB-1234'},
        'goods': {'commodity': 'टमाटर', 'weightQuintals': 25.0},
        'freightCharges': {
          'grossFare': 1200,
          'advancePaid': 500,
          'balancePayable': 700
        },
      };

  @override
  Future<Map<String, dynamic>> getTripLocation(String bookingId) async => {
        'bookingId': bookingId,
        'status': 'enRoute',
        'route': 'पिंपलगाव ➔ नासिक',
        'currentLocation': {
          'lat': 19.9975,
          'lng': 73.7898,
          'speedKmH': 45.0,
          'waypoint': 'in_transit',
        },
        'waypoints': [],
      };

  @override
  Future<Map<String, dynamic>> getTripExpenses(String bookingId) async => {
        'bookingId': bookingId,
        'grossFare': 1200,
        'totalExpenses': 450,
        'netProfit': 690,
        'expenses': [
          {'id': 'e1', 'category': 'diesel', 'amount': 450.0}
        ],
      };

  @override
  Future<Map<String, dynamic>> updateTripLocation(
    String bookingId, {
    required double lat,
    required double lng,
    double speedKmH = 0.0,
    double heading = 0.0,
    String? waypoint,
    String? waypointLabel,
    String? notes,
  }) async =>
      {
        'bookingId': bookingId,
        'status': 'enRoute',
        'currentLocation': {
          'lat': lat,
          'lng': lng,
          'speedKmH': speedKmH,
          'waypoint': waypoint ?? 'in_transit',
          'waypointLabel': waypointLabel,
        },
      };

  @override
  Future<Map<String, dynamic>> recordWeighbridge(
    String bookingId, {
    required String slipNo,
    required double tareWeightKg,
    required double grossWeightKg,
    double? netWeightKg,
    String weighbridgeName = 'धर्मकांटा',
    String? slipPhotoUrl,
    String? notes,
  }) async =>
      {
        'bookingId': bookingId,
        'weighbridgeSlip': {
          'slipNo': slipNo,
          'tareWeightKg': tareWeightKg,
          'grossWeightKg': grossWeightKg,
          'netWeightKg': netWeightKg ?? (grossWeightKg - tareWeightKg),
          'weighbridgeName': weighbridgeName,
        },
      };

  @override
  Future<Map<String, dynamic>> addTripExpense(
    String bookingId, {
    required String category,
    required double amount,
    String? notes,
    String? receiptPhotoUrl,
  }) async =>
      {
        'bookingId': bookingId,
        'id': 'exp_new',
        'category': category,
        'amount': amount,
        'notes': notes,
      };

  @override
  Future<Map<String, dynamic>> postOpenLoad({
    required String pickupLocation,
    required String dropLocation,
    required String crop,
    required double quantityQuintals,
    String packaging = 'Gunny Bags',
    bool perishable = false,
    String preferredVehicleType = 'Tata Ace',
    required String pickupDate,
    required double targetFare,
    String? notes,
  }) async =>
      {
        'id': 'load_created',
        'status': 'open',
      };

  @override
  Future<Map<String, dynamic>> getLoadBids(String loadId) async => {
        'data': <Map<String, dynamic>>[],
        'total': 0,
      };

  @override
  Future<Map<String, dynamic>> acceptLoadBid(String loadId, String bidId) async => {
        'id': loadId,
        'acceptedBidId': bidId,
        'status': 'booked',
      };

  @override
  Future<Map<String, dynamic>> getTransportAnalytics() async => {
        'totalVehicles': 2,
        'totalTripsCompleted': 35,
        'activeTripsCount': 2,
        'totalGrossRevenue': 142000,
        'estimatedNetProfit': 98000,
        'averageRating': 4.9,
      };
}

class FakePhotoUploader extends PhotoUploader {
  final List<String> requestedPaths = [];
  String urlToReturn = 'https://fake.example/photo.jpg';
  String? errorToThrow;

  @override
  Future<String?> pickAndUpload(
    String storagePath, {
    ImageSource source = ImageSource.camera,
  }) async {
    requestedPaths.add(storagePath);
    final error = errorToThrow;
    if (error != null) throw Exception(error);
    return urlToReturn;
  }
}

class FakeMyProductsApi extends MyProductsApi {
  FakeMyProductsApi([List<UserProduct>? items])
      : products = items ?? List.of(_defaultProducts);

  static final _defaultProducts = <UserProduct>[
    const UserProduct(
      id: 'up-1',
      title: 'Hybrid Tomato Seeds',
      category: 'Seeds',
      brand: 'Mahyco',
      vernacularTitle: 'हाइब्रिड टमाटर बीज',
      description: 'High yield hybrid seeds',
      mrp: 450,
      discountedPrice: 380,
      stock: 25,
      unit: 'kg',
      imageUrl: '',
      batchNo: 'USR-ABC123',
      sellerId: 'u1',
      sellerName: 'Sunita',
      dealerName: '',
      rating: 0,
      reviewsCount: 0,
      bnplAvailable: false,
      distanceKm: 0,
      createdAt: '2026-09-20T10:00:00Z',
      updatedAt: '2026-09-20T10:00:00Z',
    ),
    const UserProduct(
      id: 'up-2',
      title: 'Organic Compost',
      category: 'Fertilizer',
      brand: 'AgroGold',
      vernacularTitle: '',
      description: '',
      mrp: 900,
      discountedPrice: 750,
      stock: 4,
      unit: 'kg',
      imageUrl: '',
      batchNo: 'USR-DEF456',
      sellerId: 'u1',
      sellerName: 'Sunita',
      dealerName: '',
      rating: 0,
      reviewsCount: 0,
      bnplAvailable: false,
      distanceKm: 0,
      createdAt: '2026-09-21T10:00:00Z',
      updatedAt: '2026-09-21T10:00:00Z',
    ),
    const UserProduct(
      id: 'up-3',
      title: 'Old Pesticide Stock',
      category: 'Pesticide',
      brand: 'KillSafe',
      vernacularTitle: '',
      description: '',
      mrp: 300,
      discountedPrice: 250,
      stock: 0,
      unit: 'litre',
      imageUrl: '',
      batchNo: 'USR-GHI789',
      sellerId: 'u1',
      sellerName: 'Sunita',
      dealerName: '',
      rating: 0,
      reviewsCount: 0,
      bnplAvailable: false,
      distanceKm: 0,
      createdAt: '2026-09-22T10:00:00Z',
      updatedAt: '2026-09-22T10:00:00Z',
    ),
  ];

  List<UserProduct> products;
  final List<UserProductInput> createCalls = [];
  final List<Map<String, dynamic>> updateCalls = [];
  final List<String> deleteCalls = [];
  Object? deleteError;

  @override
  Future<List<UserProduct>> list() async => List.of(products);

  @override
  Future<UserProduct> create(UserProductInput input) async {
    createCalls.add(input);
    final p = UserProduct(
      id: 'up_new_${products.length}',
      title: input.title,
      category: input.category,
      brand: input.brand,
      vernacularTitle: input.vernacularTitle,
      description: input.description,
      mrp: input.mrp,
      discountedPrice: input.discountedPrice,
      stock: input.stock,
      unit: input.unit,
      imageUrl: input.imageUrl,
      batchNo: input.batchNo.isEmpty ? 'USR-FAKE01' : input.batchNo,
      sellerId: 'u1',
      sellerName: 'Sunita',
      dealerName: '',
      rating: 0,
      reviewsCount: 0,
      bnplAvailable: false,
      distanceKm: 0,
      createdAt: '2026-09-26T10:00:00Z',
      updatedAt: '2026-09-26T10:00:00Z',
    );
    products = [...products, p];
    return p;
  }

  @override
  Future<UserProduct> update(String id, Map<String, dynamic> fields) async {
    updateCalls.add({'id': id, ...fields});
    products = [
      for (final e in products)
        e.id == id
            ? e.copyWith(stock: (fields['stock'] as num?)?.toInt() ?? e.stock)
            : e,
    ];
    return products.firstWhere((e) => e.id == id);
  }

  @override
  Future<void> delete(String id) async {
    deleteCalls.add(id);
    final error = deleteError;
    if (error != null) throw error;
    products.removeWhere((e) => e.id == id);
  }
}
