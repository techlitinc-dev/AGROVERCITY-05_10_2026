import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, ShieldCheck, Check, Tag } from 'lucide-react';
import { useCartStore } from '../../stores/cartStore';
import { formatCurrency } from '../../lib/utils';

export const CartCheckoutView: React.FC = () => {
  const { items, updateQty, removeItem, clearCart, getSubtotal } = useCartStore();
  const [coupon, setCoupon] = useState('KISAN50');
  const [couponApplied, setCouponApplied] = useState(true);
  const [address, setAddress] = useState('Gat 312, Pimpalgaon Baswant, Taluka Niphad, Nashik - 422209');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'UPI'>('UPI');
  const [orderPlacedId, setOrderPlacedId] = useState<string | null>(null);

  const navigate = useNavigate();

  const subtotal = getSubtotal();
  const discount = couponApplied && subtotal > 0 ? 50 : 0;
  const deliveryFee = subtotal > 1500 || subtotal === 0 ? 0 : 99;
  const grandTotal = Math.max(0, subtotal - discount + deliveryFee);

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    setOrderPlacedId(orderId);
    clearCart();
  };

  if (orderPlacedId) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-md">
          <Check className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">Order Placed Successfully!</h2>
        <p className="text-xs text-slate-500">
          Your order <strong>#{orderPlacedId}</strong> has been confirmed. Delivery to Pimpalgaon Baswant within 2 business days.
        </p>

        <div className="pt-4 flex justify-center gap-3">
          <Link
            to="/mall"
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
          <ShoppingCart className="w-8 h-8" />
        </div>
        <h3 className="font-extrabold text-base text-slate-800">Your Cart is Empty</h3>
        <p className="text-xs text-slate-500">Explore seeds, fertilizers, and farm equipment on Krishi Mall.</p>
        <Link
          to="/mall"
          className="inline-block px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
        >
          Browse Krishi Mall
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <ShoppingCart className="w-7 h-7 text-emerald-600" />
          Shopping Cart & Checkout
        </h1>
        <p className="text-xs text-slate-500 mt-1">Review items, delivery address, and payment options</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Cart Items & Address */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Items in Your Cart ({items.length})</h3>

            <div className="divide-y divide-slate-100">
              {items.map((item) => (
                <div key={item.product.id} className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.title}
                      className="w-14 h-14 rounded-2xl object-cover bg-slate-100"
                    />
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 leading-tight">{item.product.title}</h4>
                      <p className="text-[11px] text-slate-400">{item.product.brand}</p>
                      <span className="font-extrabold text-xs text-emerald-800 mt-1 block">
                        {formatCurrency(item.product.price)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1">
                      <button
                        onClick={() => updateQty(item.product.id, item.quantity - 1)}
                        className="p-1 text-slate-500 hover:text-slate-800"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2 text-xs font-bold text-slate-800">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.product.id, item.quantity + 1)}
                        className="p-1 text-slate-500 hover:text-slate-800"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(item.product.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Address */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-2">
            <h3 className="font-bold text-sm text-slate-900">Delivery Address</h3>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
        </div>

        {/* Right: Order Summary & Payment */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Payment Summary</h3>

            {/* Coupon input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="Coupon Code"
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
                />
              </div>
              <button
                onClick={() => setCouponApplied(true)}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
              >
                Apply
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-bold text-slate-800">{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Coupon Discount (KISAN50):</span>
                  <span>-{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Doorstep Delivery:</span>
                <span className="font-bold text-slate-800">
                  {deliveryFee === 0 ? 'FREE' : formatCurrency(deliveryFee)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-2">
                <span>Total Amount:</span>
                <span className="text-emerald-800 text-base">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="pt-2 space-y-2">
              <label className="block text-xs font-bold text-slate-700">Payment Option</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('UPI')}
                  className={`p-2.5 rounded-xl border font-bold text-center transition-all ${
                    paymentMethod === 'UPI' ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-slate-200'
                  }`}
                >
                  Instant UPI
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('COD')}
                  className={`p-2.5 rounded-xl border font-bold text-center transition-all ${
                    paymentMethod === 'COD' ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-slate-200'
                  }`}
                >
                  Cash on Delivery
                </button>
              </div>
            </div>

            <button
              onClick={handlePlaceOrder}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span>Place Order ({formatCurrency(grandTotal)})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
