from pydantic import BaseModel, Field


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
    nutrition: str | None = None
    harvestDate: str | None = None
    deliverySlots: list[str] | None = None


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
    deliverySlot: str | None = None
    coinsToRedeem: int = Field(default=0, ge=0)
    plantTree: bool = False
    # Doorstep delivery fee in paisa — the checkout page computes it
    # client-side (free above the merchandise threshold, else a flat fee).
    # Capped at Rs 500 so a tampered value cannot inflate the payable.
    deliveryFeePaisa: int = Field(default=0, ge=0, le=50000)


class RazorpayOrderRequest(BaseModel):
    orderId: str


class RazorpayVerifyRequest(BaseModel):
    orderId: str
    razorpayOrderId: str
    razorpayPaymentId: str
    razorpaySignature: str


class RazorpayRefundRequest(BaseModel):
    orderId: str
