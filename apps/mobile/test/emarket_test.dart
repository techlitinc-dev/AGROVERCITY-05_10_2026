// E-Market feature tests — customer dashboard, wishlist, coupons in checkout,
// order timeline & return flow, seller product management, my products.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/analytics_api.dart';
import 'package:kisan_setu/api/api_exception.dart';
import 'package:kisan_setu/api/coupons_api.dart';
import 'package:kisan_setu/api/seller_products_api.dart';
import 'package:kisan_setu/api/wishlist_api.dart';
import 'package:kisan_setu/models/emarket_models.dart';
import 'package:kisan_setu/models/user_profile_type.dart';
import 'package:kisan_setu/views/account/my_products_view.dart';
import 'package:kisan_setu/views/account/wishlist_view.dart';
import 'package:kisan_setu/views/checkout_sheet.dart';
import 'package:kisan_setu/views/marketplace_view.dart';
import 'package:kisan_setu/views/order_tracking_view.dart';
import 'package:kisan_setu/views/profile_home/customer_home_view.dart';
import 'package:kisan_setu/views/seller/seller_products_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class FakeAnalyticsApi extends AnalyticsApi {
  CustomerAnalytics customer = CustomerAnalytics(
    totalSpent: 45200,
    totalOrders: 12,
    ordersByStatus: const {'delivered': 9, 'shipped': 2, 'placed': 1},
    monthlySpend: [
      for (var i = 0; i < 12; i++) SpendMonth(month: 'M$i', amount: 1000.0 * i),
    ],
    categorySpend: [
      CategorySpend(category: 'Seeds', amount: 12000),
      CategorySpend(category: 'Fertilizer', amount: 8000),
    ],
    topProducts: [
      TopProduct(productId: 'p1', title: 'Hybrid Tomato Seeds', quantity: 4, amount: 1520),
      TopProduct(productId: 'p2', title: 'NPK Fertilizer 50kg', quantity: 2, amount: 2400),
    ],
    wishlistCount: 4,
    activeCoupons: 3,
    pendingReturns: 1,
  );
  SellerAnalytics seller = const SellerAnalytics(
    revenue: 98000,
    ordersCount: 21,
    itemsSold: 34,
    aov: 4666,
    monthlyRevenue: [SpendMonth(month: 'M1', amount: 5000)],
    topProducts: [],
    categoryBreakdown: [],
    lowStock: [
      SellerLowStockItem(productId: 'p9', title: 'Low Stock Item', stock: 3),
    ],
    returnRate: 4.5,
    recentOrders: [
      SellerRecentOrder(id: 'ord_s1', total: 1200, status: 'paid', createdAt: '2026-09-20T10:00:00Z'),
    ],
  );

  @override
  Future<CustomerAnalytics> getCustomer() async => customer;

  @override
  Future<SellerAnalytics> getSeller() async => seller;
}

class FakeWishlistApi extends WishlistApi {
  FakeWishlistApi([List<Map<String, dynamic>>? items])
      : items = items ?? List.of(_defaultItems);

  static final _defaultItems = <Map<String, dynamic>>[
    {
      'id': 'prod-1',
      'title': 'Tomato Seeds Hybrid',
      'vernacularTitle': 'हाइब्रिड टमाटर बीज',
      'category': 'Seeds',
      'brand': 'Mahyco',
      'mrp': 450,
      'discountedPrice': 380,
      'inStock': true,
    },
    {
      'id': 'prod-2',
      'title': 'NPK Fertilizer',
      'vernacularTitle': 'एनपीके उर्वरक',
      'category': 'Fertilizer',
      'brand': 'IFFCO',
      'mrp': 1400,
      'discountedPrice': 1200,
      'inStock': false,
    },
  ];

  List<Map<String, dynamic>> items;
  final List<String> addedIds = [];
  final List<String> removedIds = [];

  @override
  Future<List<Map<String, dynamic>>> getWishlist() async =>
      items.map((e) => Map<String, dynamic>.from(e)).toList();

  @override
  Future<void> addItem(String productId) async {
    addedIds.add(productId);
  }

  @override
  Future<void> removeItem(String productId) async {
    removedIds.add(productId);
    items.removeWhere((e) => "${e['id']}" == productId);
  }
}

class FakeCouponsApi extends CouponsApi {
  List<Coupon> coupons = const [
    Coupon(
      code: 'SAVE10',
      type: 'percentage',
      value: 10,
      minOrder: 500,
      maxDiscount: 150,
      validUntil: '2026-12-31',
      usageLimit: 100,
      usedCount: 12,
      active: true,
      description: '10% off on all orders',
      applicable: [],
    ),
  ];
  final List<Map<String, dynamic>> validateCalls = [];
  CouponValidation Function(String code, int cartTotal)? validator;

  @override
  Future<List<Coupon>> list({int? cartTotal}) async => coupons;

  @override
  Future<CouponValidation> validate({
    required String code,
    required int cartTotal,
  }) async {
    validateCalls.add({'code': code, 'cartTotal': cartTotal});
    final fn = validator;
    if (fn != null) return fn(code, cartTotal);
    return CouponValidation(
      valid: true,
      discount: 100,
      finalTotal: 1130,
      message: 'ok',
      code: code,
    );
  }
}

class FakeSellerProductsApi extends SellerProductsApi {
  List<SellerProduct> products = [
    const SellerProduct(
      id: 'sp-1',
      title: 'Hybrid Tomato Seeds',
      category: 'Seeds',
      brand: 'Mahyco',
      mrp: 450,
      discountedPrice: 380,
      stock: 25,
      unit: 'kg',
    ),
    const SellerProduct(
      id: 'sp-2',
      title: 'Organic Compost',
      category: 'Fertilizer',
      brand: 'AgroGold',
      mrp: 900,
      discountedPrice: 750,
      stock: 4,
      unit: 'kg',
    ),
  ];
  final List<String> updateCalls = [];

  @override
  Future<List<SellerProduct>> list() async => products;

  @override
  Future<SellerProduct> create({
    required String title,
    required String category,
    required String brand,
    required double mrp,
    required double discountedPrice,
    required int stock,
    required String unit,
    String? description,
    String? imageUrl,
  }) async {
    final p = SellerProduct(
      id: 'sp_new',
      title: title,
      category: category,
      brand: brand,
      mrp: mrp,
      discountedPrice: discountedPrice,
      stock: stock,
      unit: unit,
      description: description,
      imageUrl: imageUrl,
    );
    products = [...products, p];
    return p;
  }

  @override
  Future<SellerProduct> update(
    String id, {
    double? mrp,
    double? discountedPrice,
    int? stock,
    String? title,
    String? category,
    String? brand,
    String? unit,
    String? description,
    String? imageUrl,
  }) async {
    updateCalls.add(id);
    final p = products.firstWhere((e) => e.id == id);
    products = [
      for (final e in products)
        e.id == id
            ? SellerProduct(
                id: e.id,
                title: title ?? e.title,
                category: category ?? e.category,
                brand: brand ?? e.brand,
                mrp: mrp ?? e.mrp,
                discountedPrice: discountedPrice ?? e.discountedPrice,
                stock: stock ?? e.stock,
                unit: unit ?? e.unit,
                description: description ?? e.description,
                imageUrl: imageUrl ?? e.imageUrl,
              )
            : e,
    ];
    return products.firstWhere((e) => e.id == p.id);
  }
}

Map<String, dynamic> _order(String id, String status) => {
      'id': id,
      'userId': 'u1',
      'items': [
        {'productId': 'prod-1', 'quantity': 2},
      ],
      'paymentMethod': 'cod',
      'deliveryAddress': 'शिवडी, नासिक',
      'total': 760,
      'status': status,
      'refundStatus': 'none',
      'createdAt': '2026-09-15T10:00:00Z',
    };

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('customer home dashboard renders analytics', (tester) async {
    final api = FakeAnalyticsApi();
    final state = TestAppState(initialLanguage: 'en');
    state.applyAuthUser(const {
      'activeProfile': 'customer',
      'linkedProfiles': ['customer'],
      'name': 'Sunita',
    });

    await pumpScreen(
      tester,
      Scaffold(body: CustomerHomeView(state: state, analyticsApi: api)),
    );

    expect(find.text('Namaste, Sunita ji!'), findsOneWidget);
    expect(find.text('₹45,200'), findsOneWidget);
    expect(find.text('12'), findsWidgets);
    expect(find.text('Hybrid Tomato Seeds'), findsOneWidget);
    expect(find.text('Seeds'), findsWidgets);
    expect(find.text('Browse Market'), findsOneWidget);
    expect(find.text('Wishlist'), findsWidgets);
    expect(find.text('Coupons'), findsOneWidget);
    expect(find.text('My Orders'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('wishlist lists products and remove deletes item', (tester) async {
    final api = FakeWishlistApi();
    final state = TestAppState(
      marketplaceApi: FakeMarketplaceApi(),
      initialLanguage: 'en',
    );

    await pumpScreen(
      tester,
      Scaffold(body: WishlistView(state: state, api: api)),
    );

    expect(find.text('हाइब्रिड टमाटर बीज'), findsOneWidget);
    expect(find.text('एनपीके उर्वरक'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.delete_outline_rounded).first);
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.removedIds, ['prod-1']);
    expect(find.text('हाइब्रिड टमाटर बीज'), findsNothing);
    expect(find.text('एनपीके उर्वरक'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('marketplace heart toggle adds and removes wishlist item',
      (tester) async {
    final marketplace = FakeMarketplaceApi();
    marketplace.productsResponse = const {
      'data': [
        {
          'id': 'prod-1',
          'title': 'Tomato Seeds Hybrid',
          'vernacularTitle': 'हाइब्रिड टमाटर बीज',
          'category': 'Seeds',
          'brand': 'Mahyco',
          'mrp': 450,
          'discountedPrice': 380,
          'inStock': true,
        },
      ],
      'page': 1,
      'pageSize': 20,
      'total': 1,
    };
    final wishlist = FakeWishlistApi([]);
    final state = TestAppState(
      marketplaceApi: marketplace,
      initialLanguage: 'en',
    );

    await pumpScreen(
      tester,
      Scaffold(
        body: MarketplaceView(
          state: state,
          marketplaceApi: marketplace,
          wishlistApi: wishlist,
        ),
      ),
    );

    expect(find.byIcon(Icons.favorite_border_rounded), findsOneWidget);
    await tester.tap(find.byIcon(Icons.favorite_border_rounded));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(wishlist.addedIds, ['prod-1']);
    expect(find.byIcon(Icons.favorite_rounded), findsOneWidget);

    await tester.tap(find.byIcon(Icons.favorite_rounded));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(wishlist.removedIds, ['prod-1']);

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('checkout applies coupon and places order with couponCode',
      (tester) async {
    final marketplace = FakeMarketplaceApi();
    marketplace.cartResponse = const {
      'data': [
        {
          'productId': 'prod-1',
          'quantity': 2,
          'product': {'discountedPrice': 615},
        },
      ],
      'cartTotal': 1230,
    };
    final orders = FakeOrdersApi();
    final coupons = FakeCouponsApi();
    final state = TestAppState(
      marketplaceApi: marketplace,
      initialLanguage: 'en',
    );
    await state.refreshCart();

    await openCheckoutSheet(
      tester,
      state,
      buildSheet: () => CheckoutSheet(
        state: state,
        ordersApi: orders,
        couponsApi: coupons,
      ),
    );

    await tester.enterText(find.byType(TextField), 'SAVE10');
    await tester.pump();
    await tester.tap(find.text('Apply'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(coupons.validateCalls, [
      {'code': 'SAVE10', 'cartTotal': 1230},
    ]);
    expect(find.textContaining('SAVE10'), findsWidgets);
    expect(find.text('₹1,130'), findsOneWidget);

    await tester.tap(find.textContaining('Pay ₹'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(orders.placeOrderCalls, hasLength(1));
    expect(orders.placeOrderCalls.first['couponCode'], 'SAVE10');

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('invalid coupon shows error and no discount row', (tester) async {
    final marketplace = FakeMarketplaceApi();
    marketplace.cartResponse = const {
      'data': [],
      'cartTotal': 500,
    };
    final coupons = FakeCouponsApi()
      ..validator = (code, total) => const CouponValidation(
            valid: false,
            discount: 0,
            finalTotal: 500,
            message: 'Coupon expired',
            code: 'OLD',
          );
    final state = TestAppState(
      marketplaceApi: marketplace,
      initialLanguage: 'en',
    );
    await state.refreshCart();

    await openCheckoutSheet(
      tester,
      state,
      buildSheet: () => CheckoutSheet(
        state: state,
        ordersApi: FakeOrdersApi(),
        couponsApi: coupons,
      ),
    );

    await tester.enterText(find.byType(TextField), 'OLD');
    await tester.pump();
    await tester.tap(find.text('Apply'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('Coupon expired'), findsOneWidget);
    expect(find.text('₹500'), findsNothing);
  });

  testWidgets('order detail shows timeline and return flow for delivered order',
      (tester) async {
    final api = FakeOrdersApi();
    api.ordersResponse = {
      'data': [_order('ord_9', 'delivered')],
      'page': 1,
      'pageSize': 20,
      'total': 1,
    };
    api.timelineResponse = const [
      {'status': 'placed', 'at': '2026-09-20T10:00:00Z', 'note': 'Order placed'},
      {'status': 'delivered', 'at': '2026-09-22T15:30:00Z', 'note': 'Package delivered'},
    ];
    final state = TestAppState(initialLanguage: 'en');

    await pumpScreen(
      tester,
      Scaffold(body: OrderTrackingView(state: state, ordersApi: api)),
    );

    await tester.tap(find.text('#ord_9'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('Order timeline'), findsOneWidget);
    expect(find.text('Package delivered'), findsOneWidget);
    expect(find.text('Order placed'), findsOneWidget);
    expect(find.text('Return item'), findsOneWidget);

    await tester.ensureVisible(find.text('Return item'));
    await tester.pump();
    await tester.tap(find.text('Return item'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    await tester.enterText(find.byType(TextField), 'Damaged packet');
    await tester.pump();
    await tester.tap(find.text('Submit return'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.returnCalls, [
      {'id': 'ord_9', 'reason': 'Damaged packet'},
    ]);

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('shipped order shows no return or cancel action', (tester) async {
    final api = FakeOrdersApi();
    api.ordersResponse = {
      'data': [_order('ord_3', 'shipped')],
      'page': 1,
      'pageSize': 20,
      'total': 1,
    };
    final state = TestAppState(initialLanguage: 'en');

    await pumpScreen(
      tester,
      Scaffold(body: OrderTrackingView(state: state, ordersApi: api)),
    );

    await tester.tap(find.text('#ord_3'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('Return item'), findsNothing);
    expect(find.text('Cancel Order'), findsNothing);
  });

  testWidgets('seller products lists stock with low-stock highlight',
      (tester) async {
    final api = FakeSellerProductsApi();
    final state = TestAppState(
      linked: const [UserProfileType.seller],
      initialLanguage: 'en',
    );

    await pumpScreen(
      tester,
      Scaffold(body: SellerProductsView(state: state, api: api)),
    );

    expect(find.text('Hybrid Tomato Seeds'), findsOneWidget);
    expect(find.text('Organic Compost'), findsOneWidget);
    expect(find.textContaining('Low stock'), findsWidgets);
    expect(find.text('4'), findsWidgets);

    await tester.tap(find.byType(FloatingActionButton));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('Add Product'), findsWidgets);
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('my products lists own products with low-stock highlight',
      (tester) async {
    final api = FakeMyProductsApi();
    final state = TestAppState(initialLanguage: 'en');

    await pumpScreen(
      tester,
      Scaffold(body: MyProductsView(state: state, api: api)),
    );

    expect(find.text('Hybrid Tomato Seeds'), findsOneWidget);
    expect(find.text('Organic Compost'), findsOneWidget);
    expect(find.text('Old Pesticide Stock'), findsOneWidget);
    expect(find.textContaining('Low stock'), findsWidgets);
    expect(find.text('Out of stock'), findsOneWidget);
    expect(find.text('₹380'), findsOneWidget);
    expect(find.textContaining('₹450'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('my products empty state shows add CTA', (tester) async {
    final api = FakeMyProductsApi([]);
    final state = TestAppState(initialLanguage: 'en');

    await pumpScreen(
      tester,
      Scaffold(body: MyProductsView(state: state, api: api)),
    );

    expect(find.text('You have not added any products yet'), findsOneWidget);
    expect(find.text('Add Product'), findsWidgets);

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('my products create flow submits full payload and refreshes',
      (tester) async {
    final api = FakeMyProductsApi();
    final state = TestAppState(initialLanguage: 'en');

    await pumpScreen(
      tester,
      Scaffold(body: MyProductsView(state: state, api: api)),
    );

    await tester.tap(find.byType(FloatingActionButton));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('Add Product'), findsWidgets);

    await tester.enterText(
        find.widgetWithText(TextField, 'Title'), 'Neem Oil Spray');
    await tester.enterText(
        find.widgetWithText(TextField, 'Brand'), 'GreenCare');
    await tester.enterText(
        find.widgetWithText(TextField, 'Local-language title (optional)'),
        'नीम तेल स्प्रे');
    await tester.enterText(find.widgetWithText(TextField, 'MRP'), '500');
    await tester.enterText(
        find.widgetWithText(TextField, 'Discounted price'), '450');
    await tester.enterText(find.widgetWithText(TextField, 'Stock'), '30');
    await tester.enterText(
        find.widgetWithText(TextField, 'Description (optional)'),
        'Cold pressed neem oil');
    await tester.enterText(
        find.widgetWithText(TextField, 'Image URL (optional)'),
        'https://img.example/neem.jpg');
    await tester.enterText(
        find.widgetWithText(TextField, 'Batch no. (optional)'), 'BATCH-77');
    await tester.pump();

    await tester.ensureVisible(find.text('Save'));
    await tester.tap(find.text('Save'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.createCalls, hasLength(1));
    final input = api.createCalls.first;
    expect(input.title, 'Neem Oil Spray');
    expect(input.category, 'Seeds');
    expect(input.brand, 'GreenCare');
    expect(input.vernacularTitle, 'नीम तेल स्प्रे');
    expect(input.description, 'Cold pressed neem oil');
    expect(input.mrp, 500);
    expect(input.discountedPrice, 450);
    expect(input.stock, 30);
    expect(input.unit, 'kg');
    expect(input.imageUrl, 'https://img.example/neem.jpg');
    expect(input.batchNo, 'BATCH-77');

    expect(state.toastMessage, 'Product saved');
    expect(find.text('Neem Oil Spray'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('my products create blocks discounted price above mrp',
      (tester) async {
    final api = FakeMyProductsApi();
    final state = TestAppState(initialLanguage: 'en');

    await pumpScreen(
      tester,
      Scaffold(body: MyProductsView(state: state, api: api)),
    );

    await tester.tap(find.byType(FloatingActionButton));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.enterText(
        find.widgetWithText(TextField, 'Title'), 'Test Product');
    await tester.enterText(find.widgetWithText(TextField, 'MRP'), '100');
    await tester.enterText(
        find.widgetWithText(TextField, 'Discounted price'), '150');
    await tester.pump();

    await tester.ensureVisible(find.text('Save'));
    await tester.tap(find.text('Save'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('Discounted price cannot be more than MRP'),
        findsOneWidget);
    expect(api.createCalls, isEmpty);

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('my products edit prefills and sends only changed fields',
      (tester) async {
    final api = FakeMyProductsApi();
    final state = TestAppState(initialLanguage: 'en');

    await pumpScreen(
      tester,
      Scaffold(body: MyProductsView(state: state, api: api)),
    );

    await tester.tap(find.byIcon(Icons.edit_outlined).first);
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('Edit Product'), findsOneWidget);

    final titleField = find.widgetWithText(TextField, 'Title');
    expect(tester.widget<TextField>(titleField).controller!.text,
        'Hybrid Tomato Seeds');

    await tester.enterText(titleField, 'Premium Tomato Seeds');
    await tester.ensureVisible(find.text('Save'));
    await tester.tap(find.text('Save'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.updateCalls, [
      {'id': 'up-1', 'title': 'Premium Tomato Seeds'},
    ]);
    expect(state.toastMessage, 'Product saved');

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('my products delete confirms and removes product',
      (tester) async {
    final api = FakeMyProductsApi();
    final state = TestAppState(initialLanguage: 'en');

    await pumpScreen(
      tester,
      Scaffold(body: MyProductsView(state: state, api: api)),
    );

    await tester.tap(find.byIcon(Icons.delete_outline_rounded).first);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('Delete product?'), findsOneWidget);
    expect(find.textContaining('permanently removed'), findsOneWidget);

    await tester.tap(find.text('Delete'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.deleteCalls, ['up-1']);
    expect(state.toastMessage, 'Product deleted');
    expect(find.text('Hybrid Tomato Seeds'), findsNothing);

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('my products delete blocked by orders shows error toast',
      (tester) async {
    final api = FakeMyProductsApi()
      ..deleteError =
          const ApiException(code: 'PRODUCT_HAS_ORDERS', statusCode: 409);
    final state = TestAppState(initialLanguage: 'en');

    await pumpScreen(
      tester,
      Scaffold(body: MyProductsView(state: state, api: api)),
    );

    await tester.tap(find.byIcon(Icons.delete_outline_rounded).first);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    await tester.tap(find.text('Delete'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.deleteCalls, ['up-1']);
    expect(state.toastMessage,
        'This product has orders and cannot be deleted');
    expect(find.text('Hybrid Tomato Seeds'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('my products stock stepper updates stock via update api',
      (tester) async {
    final api = FakeMyProductsApi();
    final state = TestAppState(initialLanguage: 'en');

    await pumpScreen(
      tester,
      Scaffold(body: MyProductsView(state: state, api: api)),
    );

    final tile = find.ancestor(
      of: find.text('Hybrid Tomato Seeds'),
      matching: find.byType(Container),
    );
    expect(tile, findsOneWidget);
    await tester.tap(
        find.descendant(of: tile, matching: find.byIcon(Icons.add_rounded)));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.updateCalls, [
      {'id': 'up-1', 'stock': 26},
    ]);
    expect(find.text('26'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
  });
}
