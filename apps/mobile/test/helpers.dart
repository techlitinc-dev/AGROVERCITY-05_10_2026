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
import 'package:kisan_setu/api/orders_api.dart';
import 'package:kisan_setu/api/transport_api.dart';
import 'package:kisan_setu/api/user_api.dart';
import 'package:kisan_setu/core/phone_auth.dart';
import 'package:kisan_setu/core/photo_upload.dart';
import 'package:kisan_setu/models/user_profile_type.dart';
import 'package:kisan_setu/state/app_state.dart';

class TestAppState extends AppState {
  TestAppState({
    this.linked = const [UserProfileType.farmer],
    this.user,
    super.authApi,
    super.userApi,
    super.marketplaceApi,
  });

  final List<UserProfileType> linked;
  final Map<String, dynamic>? user;

  @override
  List<UserProfileType> get linkedProfiles => linked;

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

  String? lastCategory;
  String? lastQuery;
  final List<Map<String, dynamic>> addedItems = [];

  @override
  Future<Map<String, dynamic>> getProducts({String? category, String? query, int page = 1}) async {
    lastCategory = category;
    lastQuery = query;
    final error = productsError;
    if (error != null) throw error;
    return productsResponse;
  }

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
  String? lastAddressId;
  int _orderSeq = 0;

  @override
  Future<Map<String, dynamic>> placeOrder({
    required List<Map<String, dynamic>> items,
    required String paymentMethod,
    required String deliveryAddress,
    required String idempotencyKey,
    String? addressId,
  }) async {
    idempotencyKeys.add(idempotencyKey);
    lastAddressId = addressId;
    placeOrderCalls.add({
      'items': items,
      'paymentMethod': paymentMethod,
      'deliveryAddress': deliveryAddress,
      'addressId': addressId,
      'idempotencyKey': idempotencyKey,
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
  Future<Map<String, dynamic>> getVehicleTypes() async => vehicleTypesResponse;

  @override
  Future<Map<String, dynamic>> fareEstimate(String vehicleType, double distanceKm) async =>
      fareResponse;

  @override
  Future<Map<String, dynamic>> createBooking({
    required String vehicleType,
    required double distanceKm,
    required String pickup,
    required String drop,
    required String date,
    String? lotId,
  }) async {
    createBookingCalls.add({
      'vehicleType': vehicleType,
      'distanceKm': distanceKm,
      'pickup': pickup,
      'drop': drop,
      'date': date,
      'lotId': lotId,
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
  }) async {
    updateBookingCalls.add({
      'id': id,
      'status': status,
      'vehicleId': vehicleId,
      'vehicleNo': vehicleNo,
      'podPhotos': podPhotos,
      'receiverName': receiverName,
    });
    return {'id': id, 'status': status};
  }

  @override
  Future<Map<String, dynamic>> acceptBooking(
    String id, {
    String? vehicleId,
    String? vehicleNo,
  }) async {
    acceptBookingCalls.add({'id': id, 'vehicleId': vehicleId, 'vehicleNo': vehicleNo});
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
