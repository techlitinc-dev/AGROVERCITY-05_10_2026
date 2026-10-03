// E-Market models — wishlist/coupons/analytics/order-lifecycle/seller products
// (fields match the /v1 e-market contract).

class Coupon {
  final String code;
  final String type;
  final double value;
  final double minOrder;
  final double maxDiscount;
  final String validUntil;
  final int usageLimit;
  final int usedCount;
  final bool active;
  final String description;
  final List<String> applicable;

  const Coupon({
    required this.code,
    required this.type,
    required this.value,
    required this.minOrder,
    required this.maxDiscount,
    required this.validUntil,
    required this.usageLimit,
    required this.usedCount,
    required this.active,
    required this.description,
    required this.applicable,
  });

  factory Coupon.fromJson(Map<String, dynamic> json) => Coupon(
        code: json['code'] as String? ?? '',
        type: json['type'] as String? ?? 'flat',
        value: (json['value'] as num?)?.toDouble() ?? 0,
        minOrder: (json['minOrder'] as num?)?.toDouble() ?? 0,
        maxDiscount: (json['maxDiscount'] as num?)?.toDouble() ?? 0,
        validUntil: json['validUntil'] as String? ?? '',
        usageLimit: (json['usageLimit'] as num?)?.toInt() ?? 0,
        usedCount: (json['usedCount'] as num?)?.toInt() ?? 0,
        active: json['active'] == true,
        description: json['description'] as String? ?? '',
        applicable: ((json['applicable'] as List?) ?? const <dynamic>[])
            .map((e) => "$e")
            .toList(),
      );
}

class CouponValidation {
  final bool valid;
  final double discount;
  final double finalTotal;
  final String message;
  final String? code;

  const CouponValidation({
    required this.valid,
    required this.discount,
    required this.finalTotal,
    required this.message,
    this.code,
  });

  factory CouponValidation.fromJson(
    Map<String, dynamic> json, {
    String? code,
  }) =>
      CouponValidation(
        valid: json['valid'] == true,
        discount: (json['discount'] as num?)?.toDouble() ?? 0,
        finalTotal: (json['finalTotal'] as num?)?.toDouble() ?? 0,
        message: json['message'] as String? ?? '',
        code: code,
      );
}

class SpendMonth {
  final String month;
  final double amount;

  const SpendMonth({required this.month, required this.amount});

  factory SpendMonth.fromJson(Map<String, dynamic> json) => SpendMonth(
        month: json['month'] as String? ?? '',
        amount: (json['amount'] as num?)?.toDouble() ?? 0,
      );
}

class CategorySpend {
  final String category;
  final double amount;

  const CategorySpend({required this.category, required this.amount});

  factory CategorySpend.fromJson(Map<String, dynamic> json) => CategorySpend(
        category: json['category'] as String? ?? '',
        amount: (json['amount'] as num?)?.toDouble() ?? 0,
      );
}

class TopProduct {
  final String productId;
  final String title;
  final int quantity;
  final double amount;

  const TopProduct({
    required this.productId,
    required this.title,
    required this.quantity,
    required this.amount,
  });

  factory TopProduct.fromJson(Map<String, dynamic> json) => TopProduct(
        productId: json['productId'] as String? ?? '',
        title: json['title'] as String? ?? '',
        quantity: (json['quantity'] as num?)?.toInt() ?? 0,
        amount: (json['amount'] as num?)?.toDouble() ?? 0,
      );
}

class CustomerAnalytics {
  final double totalSpent;
  final int totalOrders;
  final Map<String, int> ordersByStatus;
  final List<SpendMonth> monthlySpend;
  final List<CategorySpend> categorySpend;
  final List<TopProduct> topProducts;
  final int wishlistCount;
  final int activeCoupons;
  final int pendingReturns;

  const CustomerAnalytics({
    required this.totalSpent,
    required this.totalOrders,
    required this.ordersByStatus,
    required this.monthlySpend,
    required this.categorySpend,
    required this.topProducts,
    required this.wishlistCount,
    required this.activeCoupons,
    required this.pendingReturns,
  });

  factory CustomerAnalytics.fromJson(Map<String, dynamic> json) {
    final byStatus = (json['ordersByStatus'] as Map?) ?? const {};
    return CustomerAnalytics(
      totalSpent: (json['totalSpent'] as num?)?.toDouble() ?? 0,
      totalOrders: (json['totalOrders'] as num?)?.toInt() ?? 0,
      ordersByStatus: byStatus.map(
        (k, v) => MapEntry("$k", (v as num?)?.toInt() ?? 0),
      ),
      monthlySpend: ((json['monthlySpend'] as List?) ?? const <dynamic>[])
          .map((e) => SpendMonth.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
      categorySpend: ((json['categorySpend'] as List?) ?? const <dynamic>[])
          .map((e) => CategorySpend.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
      topProducts: ((json['topProducts'] as List?) ?? const <dynamic>[])
          .map((e) => TopProduct.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
      wishlistCount: (json['wishlistCount'] as num?)?.toInt() ?? 0,
      activeCoupons: (json['activeCoupons'] as num?)?.toInt() ?? 0,
      pendingReturns: (json['pendingReturns'] as num?)?.toInt() ?? 0,
    );
  }
}

class SellerLowStockItem {
  final String productId;
  final String title;
  final int stock;

  const SellerLowStockItem({
    required this.productId,
    required this.title,
    required this.stock,
  });

  factory SellerLowStockItem.fromJson(Map<String, dynamic> json) =>
      SellerLowStockItem(
        productId: json['productId'] as String? ?? '',
        title: json['title'] as String? ?? '',
        stock: (json['stock'] as num?)?.toInt() ?? 0,
      );
}

class SellerRecentOrder {
  final String id;
  final double total;
  final String status;
  final String createdAt;

  const SellerRecentOrder({
    required this.id,
    required this.total,
    required this.status,
    required this.createdAt,
  });

  factory SellerRecentOrder.fromJson(Map<String, dynamic> json) =>
      SellerRecentOrder(
        id: json['id'] as String? ?? '',
        total: (json['total'] as num?)?.toDouble() ?? 0,
        status: json['status'] as String? ?? '',
        createdAt: json['createdAt'] as String? ?? '',
      );
}

class SellerAnalytics {
  final double revenue;
  final int ordersCount;
  final int itemsSold;
  final double aov;
  final List<SpendMonth> monthlyRevenue;
  final List<TopProduct> topProducts;
  final List<CategorySpend> categoryBreakdown;
  final List<SellerLowStockItem> lowStock;
  final double returnRate;
  final List<SellerRecentOrder> recentOrders;

  const SellerAnalytics({
    required this.revenue,
    required this.ordersCount,
    required this.itemsSold,
    required this.aov,
    required this.monthlyRevenue,
    required this.topProducts,
    required this.categoryBreakdown,
    required this.lowStock,
    required this.returnRate,
    required this.recentOrders,
  });

  factory SellerAnalytics.fromJson(Map<String, dynamic> json) =>
      SellerAnalytics(
        revenue: (json['revenue'] as num?)?.toDouble() ?? 0,
        ordersCount: (json['ordersCount'] as num?)?.toInt() ?? 0,
        itemsSold: (json['itemsSold'] as num?)?.toInt() ?? 0,
        aov: (json['aov'] as num?)?.toDouble() ?? 0,
        monthlyRevenue:
            ((json['monthlyRevenue'] as List?) ?? const <dynamic>[])
                .map((e) =>
                    SpendMonth.fromJson((e as Map).cast<String, dynamic>()))
                .toList(),
        topProducts: ((json['topProducts'] as List?) ?? const <dynamic>[])
            .map((e) => TopProduct.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
        categoryBreakdown:
            ((json['categoryBreakdown'] as List?) ?? const <dynamic>[])
                .map((e) =>
                    CategorySpend.fromJson((e as Map).cast<String, dynamic>()))
                .toList(),
        lowStock: ((json['lowStock'] as List?) ?? const <dynamic>[])
            .map((e) =>
                SellerLowStockItem.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
        returnRate: (json['returnRate'] as num?)?.toDouble() ?? 0,
        recentOrders: ((json['recentOrders'] as List?) ?? const <dynamic>[])
            .map((e) =>
                SellerRecentOrder.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
      );
}

class OrderTimelineEvent {
  final String status;
  final String at;
  final String note;

  const OrderTimelineEvent({
    required this.status,
    required this.at,
    required this.note,
  });

  factory OrderTimelineEvent.fromJson(Map<String, dynamic> json) =>
      OrderTimelineEvent(
        status: json['status'] as String? ?? '',
        at: json['at'] as String? ?? '',
        note: json['note'] as String? ?? '',
      );
}

class SellerProduct {
  final String id;
  final String title;
  final String category;
  final String brand;
  final double mrp;
  final double discountedPrice;
  final int stock;
  final String unit;
  final String? description;
  final String? imageUrl;

  const SellerProduct({
    required this.id,
    required this.title,
    required this.category,
    required this.brand,
    required this.mrp,
    required this.discountedPrice,
    required this.stock,
    required this.unit,
    this.description,
    this.imageUrl,
  });

  factory SellerProduct.fromJson(Map<String, dynamic> json) => SellerProduct(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        category: json['category'] as String? ?? '',
        brand: json['brand'] as String? ?? '',
        mrp: (json['mrp'] as num?)?.toDouble() ?? 0,
        discountedPrice: (json['discountedPrice'] as num?)?.toDouble() ?? 0,
        stock: (json['stock'] as num?)?.toInt() ?? 0,
        unit: json['unit'] as String? ?? '',
        description: json['description'] as String?,
        imageUrl: json['imageUrl'] as String?,
      );
}

class UserProduct {
  final String id;
  final String title;
  final String category;
  final String brand;
  final String vernacularTitle;
  final String description;
  final double mrp;
  final double discountedPrice;
  final int stock;
  final String unit;
  final String imageUrl;
  final String batchNo;
  final String sellerId;
  final String sellerName;
  final String dealerName;
  final double rating;
  final int reviewsCount;
  final bool bnplAvailable;
  final double distanceKm;
  final String createdAt;
  final String updatedAt;

  const UserProduct({
    required this.id,
    required this.title,
    required this.category,
    required this.brand,
    required this.vernacularTitle,
    required this.description,
    required this.mrp,
    required this.discountedPrice,
    required this.stock,
    required this.unit,
    required this.imageUrl,
    required this.batchNo,
    required this.sellerId,
    required this.sellerName,
    required this.dealerName,
    required this.rating,
    required this.reviewsCount,
    required this.bnplAvailable,
    required this.distanceKm,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get inStock => stock > 0;

  factory UserProduct.fromJson(Map<String, dynamic> json) => UserProduct(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        category: json['category'] as String? ?? '',
        brand: json['brand'] as String? ?? '',
        vernacularTitle: json['vernacularTitle'] as String? ?? '',
        description: json['description'] as String? ?? '',
        mrp: (json['mrp'] as num?)?.toDouble() ?? 0,
        discountedPrice: (json['discountedPrice'] as num?)?.toDouble() ?? 0,
        stock: (json['stock'] as num?)?.toInt() ?? 0,
        unit: json['unit'] as String? ?? '',
        imageUrl: json['imageUrl'] as String? ?? '',
        batchNo: json['batchNo'] as String? ?? '',
        sellerId: json['sellerId'] as String? ?? '',
        sellerName: json['sellerName'] as String? ?? '',
        dealerName: json['dealerName'] as String? ?? '',
        rating: (json['rating'] as num?)?.toDouble() ?? 0,
        reviewsCount: (json['reviewsCount'] as num?)?.toInt() ?? 0,
        bnplAvailable: json['bnplAvailable'] == true,
        distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0,
        createdAt: json['createdAt'] as String? ?? '',
        updatedAt: json['updatedAt'] as String? ?? '',
      );

  UserProduct copyWith({int? stock}) => UserProduct(
        id: id,
        title: title,
        category: category,
        brand: brand,
        vernacularTitle: vernacularTitle,
        description: description,
        mrp: mrp,
        discountedPrice: discountedPrice,
        stock: stock ?? this.stock,
        unit: unit,
        imageUrl: imageUrl,
        batchNo: batchNo,
        sellerId: sellerId,
        sellerName: sellerName,
        dealerName: dealerName,
        rating: rating,
        reviewsCount: reviewsCount,
        bnplAvailable: bnplAvailable,
        distanceKm: distanceKm,
        createdAt: createdAt,
        updatedAt: updatedAt,
      );
}

class UserProductInput {
  final String title;
  final String category;
  final String brand;
  final String vernacularTitle;
  final String description;
  final double mrp;
  final double discountedPrice;
  final int stock;
  final String unit;
  final String imageUrl;
  final String batchNo;

  const UserProductInput({
    required this.title,
    required this.category,
    required this.mrp,
    required this.discountedPrice,
    required this.stock,
    required this.unit,
    this.brand = '',
    this.vernacularTitle = '',
    this.description = '',
    this.imageUrl = '',
    this.batchNo = '',
  });

  Map<String, dynamic> toJson() => {
        'title': title,
        'category': category,
        'mrp': mrp,
        'discountedPrice': discountedPrice,
        'stock': stock,
        'unit': unit,
        if (brand.isNotEmpty) 'brand': brand,
        if (vernacularTitle.isNotEmpty) 'vernacularTitle': vernacularTitle,
        if (description.isNotEmpty) 'description': description,
        if (imageUrl.isNotEmpty) 'imageUrl': imageUrl,
        if (batchNo.isNotEmpty) 'batchNo': batchNo,
      };
}
