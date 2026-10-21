import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CloudRain,
  Coins,
  Flower2,
  Heart,
  Leaf,
  Package,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Sun,
  Truck,
  Wallet,
  Wind,
} from 'lucide-react';
import { apiErrorMessage, dashboard, mall, users } from '../../lib/api';
import { customerHub, type CustomerHomePayload, type CustomerProductCard, type CustomerRecommendationsPayload } from '../../lib/api/customerHub';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import { cn } from '../../lib/utils';
import type { MallProduct } from '../../types';
import { MallProductCard } from './MallProductCard';
import { asRecord, formatDateTime, num, str, toMallProduct, PRODUCT_PLACEHOLDER_IMAGE, type ApiProductDoc } from './mallMappers';

interface WeatherDay {
  day?: string;
  tempC?: number;
  rainProbability?: number;
}

interface HomePayload {
  weather?: {
    tempC?: number;
    condition?: string;
    rainProbability?: number;
    forecast?: WeatherDay[];
  } | null;
  urgentTask?: Record<string, unknown> | null;
  mandiRates?: Array<Record<string, unknown>>;
  banners?: Array<Record<string, unknown>>;
}

const QUICK_LINKS = [
  { to: '/customer/orders', label: 'My Orders', icon: Package, tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { to: '/customer/subscriptions', label: 'Subscriptions', icon: Repeat, tone: 'bg-sky-50 text-sky-700 border-sky-100' },
  { to: '/customer/wallet', label: 'Wallet & Coins', icon: Wallet, tone: 'bg-amber-50 text-amber-700 border-amber-100' },
  { to: '/mall/wishlist', label: 'Wishlist', icon: Heart, tone: 'bg-rose-50 text-rose-700 border-rose-100' },
  { to: '/mall/cart', label: 'Cart', icon: ShoppingCart, tone: 'bg-purple-50 text-purple-700 border-purple-100' },
  { to: '/mall', label: 'Krishi Mall', icon: ShoppingBag, tone: 'bg-slate-50 text-slate-700 border-slate-200' },
];

const ORDER_STATUS_TONE: Record<string, string> = {
  placed: 'bg-sky-100 text-sky-700',
  paid: 'bg-sky-100 text-sky-700',
  confirmed: 'bg-indigo-100 text-indigo-700',
  shipped: 'bg-amber-100 text-amber-700',
  out_for_delivery: 'bg-amber-100 text-amber-700',
};

const OrderStatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={cn(
      'px-2 py-0.5 rounded-full text-[10px] font-bold capitalize',
      ORDER_STATUS_TONE[status] ?? 'bg-slate-100 text-slate-600'
    )}
  >
    {status.replace(/_/g, ' ')}
  </span>
);

/** Compact product card used by the hub sections (follows / seasonal / AI basket). */
const HubProductCard: React.FC<{ product: CustomerProductCard }> = ({ product }) => (
  <Link
    to={`/mall/product/${product.id}`}
    className="min-w-[160px] w-40 bg-white rounded-2xl border border-slate-200/80 p-3 hover:shadow-md transition-all flex flex-col"
  >
    <img
      src={product.imageUrl || PRODUCT_PLACEHOLDER_IMAGE}
      alt={product.name}
      className="w-full h-24 object-cover rounded-xl bg-slate-100"
    />
    <p className="text-[11px] font-bold text-slate-800 mt-2 leading-tight line-clamp-2">{product.name}</p>
    <p className="text-sm font-black text-emerald-700 mt-1">
      ₹{product.price}
      {product.unit ? <span className="text-[10px] text-slate-400 font-bold"> / {product.unit}</span> : null}
    </p>
    {product.reason && (
      <span className="mt-1.5 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[9px] font-bold leading-tight">
        {product.reason}
      </span>
    )}
  </Link>
);

export const CustomerHomeView: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const { addItem } = useCartStore();
  const [home, setHome] = useState<HomePayload>({});
  const [hub, setHub] = useState<CustomerHomePayload | null>(null);
  const [recs, setRecs] = useState<CustomerRecommendationsPayload | null>(null);
  const [rawDocs, setRawDocs] = useState<ApiProductDoc[]>([]);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [womenMode, setWomenMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bannerError, setBannerError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const [homePayload, hubPayload, recsPayload, productDocs, wishlistItems] = await Promise.all([
        dashboard.home().catch(() => null),
        customerHub.home().catch(() => null),
        customerHub.recommendations().catch(() => null),
        mall.products().catch(() => [] as unknown as ApiProductDoc[]),
        mall.wishlist().catch(() => [] as MallProduct[]),
      ]);
      if (!mounted) return;
      setHome((homePayload as HomePayload | null) ?? {});
      setHub(hubPayload);
      setRecs(recsPayload);
      setRawDocs(productDocs as unknown as ApiProductDoc[]);
      setWishlistIds(new Set(wishlistItems.map((p) => p.id)));
      setLoading(false);
    };
    void load();

    users
      .getSettings()
      .then((s) => {
        if (!mounted) return;
        setSettings(asRecord(s));
        setWomenMode(Boolean(s?.womenMode));
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  // Women mode lifts gruh-udyog (SHG / women-led) listings to the top of the shelf.
  const recommended = useMemo(() => {
    const entries = rawDocs.map((d) => ({
      product: toMallProduct(d),
      gruh: str(d.source) === 'gruh_udyog',
    }));
    entries.sort((a, b) => {
      if (womenMode && a.gruh !== b.gruh) return a.gruh ? -1 : 1;
      return b.product.rating - a.product.rating || b.product.ratingCount - a.product.ratingCount;
    });
    return entries.map((e) => e.product).slice(0, 8);
  }, [rawDocs, womenMode]);

  const handleToggleWomenMode = async () => {
    const next = !womenMode;
    setWomenMode(next);
    try {
      const saved = await users.updateSettings({ ...settings, womenMode: next });
      setSettings(asRecord(saved));
    } catch (e) {
      setWomenMode((v) => !v);
      setBannerError(apiErrorMessage(e));
    }
  };

  const handleToggleWishlist = async (product: MallProduct) => {
    const wasSaved = wishlistIds.has(product.id);
    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(product.id);
      else next.add(product.id);
      return next;
    });
    try {
      if (wasSaved) await mall.removeFromWishlist(product.id);
      else await mall.addToWishlist(product.id);
    } catch (e) {
      setBannerError(apiErrorMessage(e));
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(product.id);
        else next.delete(product.id);
        return next;
      });
    }
  };

  const handleAddToCart = async (product: MallProduct) => {
    addItem(product, 1);
    try {
      await mall.addToCart(product.id, 1);
    } catch (e) {
      setBannerError(apiErrorMessage(e));
    }
  };

  const weather = home.weather;
  const banners = home.banners ?? [];
  const firstName = (user?.name ?? 'Kisan').split(' ')[0];
  const seasonalPicks = hub?.seasonalPicks ?? [];
  const activeOrders = hub?.activeOrders ?? [];
  const subscriptionNext = hub?.subscriptionNext ?? [];
  const followedOffers = hub?.followedOffers ?? [];
  const coinBalance = hub?.coinBalance ?? 0;
  const unreadNotifications = hub?.unreadNotifications ?? 0;
  const basket = recs?.basket ?? [];
  const bestPrice = recs?.bestPrice ?? [];
  const seasonalAlternatives = recs?.seasonalAlternatives ?? [];

  return (
    <div className="space-y-6">
      {/* Greeting + weather strip */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 bg-gradient-to-br from-emerald-700 to-emerald-900 rounded-3xl p-6 text-white shadow-md">
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-200">Namaste</p>
          <h1 className="text-2xl font-black mt-1">{firstName}, welcome to your farm store</h1>
          <p className="text-xs text-emerald-100 mt-2">
            Order certified inputs, track deliveries, and manage subscriptions — all from one place.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Link
              to="/mall"
              className="px-4 py-2 rounded-xl bg-white text-emerald-800 font-bold text-xs hover:bg-emerald-50 transition-colors"
            >
              Shop Krishi Mall
            </Link>
            <Link
              to="/customer/orders"
              className="px-4 py-2 rounded-xl bg-emerald-800/60 border border-emerald-600 text-white font-bold text-xs hover:bg-emerald-800 transition-colors"
            >
              Track Orders
            </Link>
          </div>
        </div>

        <div className="lg:w-80 bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              {weather && (weather.rainProbability ?? 0) > 40 ? (
                <CloudRain className="w-4 h-4 text-sky-600" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
              Weather at your farm
            </h3>
            {weather && (
              <span className="text-xl font-black text-slate-900">{Math.round(num(weather.tempC))}°C</span>
            )}
          </div>
          {weather ? (
            <>
              <p className="text-[11px] text-slate-500 mt-1 capitalize">
                {str(weather.condition, 'Clear')} · {num(weather.rainProbability)}% rain probability
              </p>
              <div className="flex gap-2 mt-3">
                {(weather.forecast ?? []).slice(0, 3).map((day, i) => (
                  <div key={i} className="flex-1 bg-slate-50 rounded-2xl border border-slate-100 p-2 text-center">
                    <p className="text-[10px] font-bold text-slate-500">{str(day.day, `Day ${i + 1}`)}</p>
                    <p className="text-sm font-black text-slate-800">{Math.round(num(day.tempC))}°</p>
                    <p className="text-[9px] text-sky-600 flex items-center justify-center gap-0.5">
                      <Wind className="w-2.5 h-2.5" />
                      {num(day.rainProbability)}%
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[11px] text-slate-400 mt-2">
              Weather appears once your farm boundary location is saved on your profile.
            </p>
          )}
        </div>
      </div>

      {/* Banners */}
      {banners.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {banners.slice(0, 2).map((banner, i) => (
            <div
              key={str(banner.id) || i}
              className="relative rounded-3xl overflow-hidden border border-slate-200/80 bg-slate-900 min-h-[120px] flex"
            >
              {str(banner.bannerUrl) && (
                <img src={str(banner.bannerUrl)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
              )}
              <div className="relative p-5 flex flex-col justify-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                  {str(banner.title, 'Featured')}
                </p>
                <h3 className="text-lg font-black text-white leading-tight">{str(banner.headline)}</h3>
                {str(banner.description) && <p className="text-[11px] text-slate-200 mt-1">{str(banner.description)}</p>}
                {str(banner.ctaText) && (
                  <Link
                    to={banner.targetType === 'url' ? str(banner.targetId, '/mall') : '/mall'}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold w-fit"
                  >
                    {str(banner.ctaText)}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick links */}
      {bannerError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">
          {bannerError}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`rounded-2xl border p-4 flex flex-col items-center gap-2 hover:shadow-md transition-all ${link.tone}`}
          >
            <link.icon className="w-5 h-5" />
            <span className="text-[11px] font-bold">{link.label}</span>
          </Link>
        ))}
      </div>

      {/* Notifications bell + coin balance (SR 1) */}
      {(unreadNotifications > 0 || coinBalance > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {unreadNotifications > 0 && (
            <Link
              to="/notifications"
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3 hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 relative">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center">
                  {unreadNotifications}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800">{unreadNotifications} new notification{unreadNotifications > 1 ? 's' : ''}</p>
                <p className="text-[11px] text-slate-400">Updates on your orders, offers and deliveries</p>
              </div>
            </Link>
          )}
          {coinBalance > 0 && (
            <Link
              to="/customer/wallet"
              className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl border border-amber-200/80 p-4 flex items-center gap-3 hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-2xl bg-amber-200/70 text-amber-700 flex items-center justify-center shrink-0">
                <Coins className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-900">{coinBalance} AgriCoins</p>
                <p className="text-[11px] text-amber-700">Redeem for discounts on your next order</p>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Active orders strip (SR 1) */}
      {activeOrders.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-emerald-600" />
              Your Orders
            </h3>
            <Link to="/customer/orders" className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800">
              View all →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {activeOrders.map((order) => (
              <Link
                key={order.id}
                to="/customer/orders"
                className="min-w-[180px] bg-slate-50 rounded-2xl border border-slate-100 p-3 hover:border-emerald-200 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-black text-slate-800">#{order.id.replace(/^ord_/, '').toUpperCase()}</p>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="text-sm font-black text-emerald-700 mt-1">₹{order.total}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{formatDateTime(order.createdAt)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Subscription next delivery (SR 1) */}
      {subscriptionNext.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Repeat className="w-4 h-4 text-sky-600" />
              Subscription Box
            </h3>
            <Link to="/customer/subscriptions" className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800">
              Manage →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {subscriptionNext.map((sub) => (
              <Link
                key={sub.id}
                to="/customer/subscriptions"
                className="min-w-[190px] bg-sky-50 rounded-2xl border border-sky-100 p-3 hover:border-sky-200 transition-colors"
              >
                <p className="text-[11px] font-black text-slate-800">{sub.label}</p>
                <p className="text-[10px] text-sky-700 font-bold mt-1 capitalize">{sub.frequency ?? 'recurring'} delivery</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Next: {formatDateTime(sub.nextRunAt)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Women mode — prioritise SHG & gruh udyog content */}
      <div className="bg-white rounded-3xl border border-purple-100 shadow-xs p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Flower2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800">Women mode</p>
            <p className="text-[11px] text-slate-400">
              Prioritise SHG &amp; gruh udyog products in your recommendations
              {womenMode && (
                <>
                  {' · '}
                  <Link to="/community/women" className="text-purple-700 font-bold hover:underline">
                    Explore the women hub
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleToggleWomenMode()}
          aria-label="Toggle women mode"
          aria-pressed={womenMode}
          className="shrink-0"
        >
          <span className={cn('w-9 h-5 rounded-full relative flex-shrink-0 block', womenMode ? 'bg-purple-500' : 'bg-slate-300')}>
            <span
              className={cn(
                'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
                womenMode ? 'left-[18px]' : 'left-0.5'
              )}
            />
          </span>
        </button>
      </div>

      {/* Mandi rates strip */}
      {(home.mandiRates?.length ?? 0) > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
          <h3 className="text-xs font-bold text-slate-700 mb-3">Today's mandi rates near you</h3>
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {(home.mandiRates ?? []).slice(0, 8).map((rate, i) => (
              <div key={i} className="min-w-[140px] bg-slate-50 rounded-2xl border border-slate-100 p-3">
                <p className="text-[11px] font-black text-slate-800 capitalize">{str(rate.crop, 'Crop')}</p>
                <p className="text-sm font-black text-emerald-700 mt-0.5">
                  {str(rate.rateDisplay) ||
                    (num(rate.ratePerKg) > 0 ? `₹${num(rate.ratePerKg)}/kg` : '—')}
                </p>
                <p className="text-[10px] text-slate-400 capitalize">
                  {str(rate.mandiName ?? rate.market, '')}
                  {str(rate.priceChange) && str(rate.priceChange) !== '0' ? (
                    <span className={str(rate.changeDir) === 'up' ? 'text-rose-500 font-bold' : 'text-emerald-600 font-bold'}>
                      {' '}
                      {str(rate.priceChange)}/q vs modal
                    </span>
                  ) : null}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Urgent task */}
      {home.urgentTask && (
        <div className="bg-amber-50 border border-amber-100 rounded-3xl p-4 flex items-center gap-3">
          <Coins className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-xs font-black text-amber-900">{str(home.urgentTask.title_en ?? home.urgentTask.title, 'Reminder')}</p>
            <p className="text-[11px] text-amber-700">
              {str(home.urgentTask.subtitle, 'An open task needs your attention today.')}
            </p>
          </div>
        </div>
      )}

      {/* Recommended products */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">Recommended for you</h2>
          <Link to="/mall" className="text-xs font-bold text-emerald-700 hover:text-emerald-800">
            View all →
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-3xl border border-slate-200/80 p-4 space-y-3 animate-pulse">
                <div className="h-44 bg-slate-100 rounded-2xl" />
                <div className="h-4 bg-slate-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {recommended.slice(0, 4).map((product) => (
              <MallProductCard
                key={product.id}
                product={product}
                inWishlist={wishlistIds.has(product.id)}
                onToggleWishlist={handleToggleWishlist}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        )}
      </div>

      {/* From farmers you follow (SR 1) */}
      {followedOffers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">From Farmers You Follow</h2>
            <Link to="/mall" className="text-xs font-bold text-emerald-700 hover:text-emerald-800">
              Visit mall →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {followedOffers.map((product) => (
              <HubProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}

      {/* Seasonal picks (SR 1) */}
      {seasonalPicks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Leaf className="w-5 h-5 text-emerald-600" />
              Seasonal Picks
            </h2>
            <Link to="/mall" className="text-xs font-bold text-emerald-700 hover:text-emerald-800">
              View all →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {seasonalPicks.map((product) => (
              <HubProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}

      {/* AI basket (SR 23) */}
      {basket.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              For You — AI Basket
            </h2>
            <Link to="/mall" className="text-xs font-bold text-emerald-700 hover:text-emerald-800">
              Shop the mall →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {basket.map((product) => (
              <HubProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}

      {/* Best price board + seasonal alternatives (SR 23) */}
      {(bestPrice.length > 0 || seasonalAlternatives.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {bestPrice.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
              <h3 className="text-xs font-bold text-slate-700 mb-3">Best prices on the mall</h3>
              <div className="space-y-2">
                {bestPrice.slice(0, 5).map((product) => (
                  <Link
                    key={product.id}
                    to={`/mall/product/${product.id}`}
                    className="flex items-center justify-between gap-2 bg-slate-50 rounded-xl border border-slate-100 px-3 py-2 hover:border-emerald-200 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-800 truncate">{product.name}</p>
                      <p className="text-[9px] text-slate-400">{product.reason}</p>
                    </div>
                    <p className="text-sm font-black text-emerald-700 shrink-0">₹{product.price}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {seasonalAlternatives.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
              <h3 className="text-xs font-bold text-slate-700 mb-3">Seasonal alternatives</h3>
              <div className="flex gap-3 overflow-x-auto no-scrollbar">
                {seasonalAlternatives.map((product) => (
                  <HubProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
