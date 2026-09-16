export type ProductCategory = 'seeds' | 'vehicles' | 'fertilizer' | 'pesticide' | 'tools';

export interface InputProduct {
  id: string;
  title: string;
  vernacularTitle: string;
  category: ProductCategory;
  brand: string;
  rating: number;
  reviewsCount: number;
  dealerName: string;
  distanceKm: number;
  mrp: number;
  discountedPrice: number;
  bnplAvailable: boolean;
  batchNo: string;
}

export interface ProductCertificate {
  batchNo: string;
  certifier: string;
  certificateNo: string;
  valid: boolean;
  verifiedAt: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
  product?: InputProduct;
}

export interface Cart {
  items: CartItem[];
  total: number;
}

export type OrderPaymentMethod = 'upi' | 'cod' | 'bnpl';

export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'outForDelivery'
  | 'delivered'
  | 'cancelled';

export interface BnplInstallment {
  dueDate: string;
  amount: number;
  paid: boolean;
}

export interface OrderItem {
  productId: string;
  title: string;
  quantity: number;
  price: number;
}

export interface Order {
  orderId: string;
  items: OrderItem[];
  total: number;
  paymentMethod: OrderPaymentMethod;
  deliveryAddress: string;
  status: OrderStatus;
  bnplSchedule?: BnplInstallment[];
  refundStatus?: 'notApplicable' | 'initiated' | 'refunded' | 'failed';
  placedAt: string;
}

export interface PlaceOrderBody {
  items: { productId: string; quantity: number }[];
  paymentMethod: OrderPaymentMethod;
  deliveryAddress: string;
  addressId?: string;
  idempotencyKey: string;
}

export interface PlaceOrderRes {
  orderId: string;
  total: number;
  bnplSchedule?: BnplInstallment[];
}

export interface CancelOrderBody {
  reason: 'changedMind' | 'wrongAddress' | 'foundCheaper' | 'other';
}

export interface CancelOrderRes {
  orderId: string;
  status: 'cancelled';
  refundStatus: 'notApplicable' | 'initiated' | 'refunded' | 'failed';
  refundEtaDays: number;
}

export interface ProductReview {
  id: string;
  userId: string;
  userName: string;
  stars: number;
  text: string;
  photoUrl: string | null;
  createdAt: string;
}
