from pydantic import BaseModel


class ProductOut(BaseModel):
    id: str
    title: str
    vernacularTitle: str
    category: str
    brand: str
    rating: float
    reviewsCount: int
    dealerName: str
    distanceKm: float
    mrp: float
    discountedPrice: float
    bnplAvailable: bool
    batchNo: str
    inStock: bool = True


class CertificateOut(BaseModel):
    batchNo: str
    certifier: str
    certificateNo: str
    valid: bool
    verifiedAt: str


class CartItemRequest(BaseModel):
    productId: str
    quantity: int


class CartQuantityRequest(BaseModel):
    quantity: int


class PlaceOrderRequest(BaseModel):
    items: list[CartItemRequest]
    paymentMethod: str
    deliveryAddress: str = ""
    idempotencyKey: str
    addressId: str | None = None
    couponCode: str | None = None


class RazorpayOrderRequest(BaseModel):
    orderId: str


class RazorpayVerifyRequest(BaseModel):
    orderId: str
    razorpayOrderId: str
    razorpayPaymentId: str
    razorpaySignature: str


class RazorpayRefundRequest(BaseModel):
    orderId: str
