import React, { useState } from 'react';
import { Coins, Gift, Share2, Copy, Check, Users, Award, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { StatCard } from '../../components/common/StatCard';
import { formatNumber } from '../../lib/utils';

export const KisanCoinsView: React.FC = () => {
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);

  const referralCode = 'RAMESH712';

  const rewards = [
    { id: 'rew_1', title: '₹100 Off on Soil Health Lab Test', cost: 150, category: 'Soil Diagnostics' },
    { id: 'rew_2', title: 'Free 1-Hour Rotavator Equipment Rental', cost: 400, category: 'Machinery' },
    { id: 'rew_3', title: '1-Year Agrovercity Pro Weather Alerts', cost: 250, category: 'Intelligence' },
    { id: 'rew_4', title: 'Free 1kg Certified Bio-NPK Fertilizer Sample', cost: 100, category: 'Krishi Mall' },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Coins className="w-7 h-7 text-amber-500" />
          Kisan Coins Rewards Wallet & Referral Hub
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Earn Kisan Coins on every produce sale, transport trip, and neighbor referral. Redeem for farming subsidies.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Current Balance"
          value={`${user?.kisanCoins || 350} Coins`}
          subtitle="₹350 equivalent purchasing power"
          icon={Coins}
          colorScheme="amber"
        />
        <StatCard
          title="Successful Referrals"
          value="7 Farmers"
          subtitle="50 coins earned per active joining"
          icon={Users}
          colorScheme="green"
        />
        <StatCard
          title="Farmer Reputation Badge"
          value="Gold Kisan"
          subtitle="Verified seller with 100% fulfillments"
          icon={Award}
          colorScheme="purple"
        />
      </div>

      {/* Referral Code Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h3 className="font-extrabold text-lg">Invite Neighboring Farmers & Earn 50 Coins</h3>
          <p className="text-xs text-emerald-200 max-w-lg">
            Share your unique invite code. When they register their 7/12 land record, both of you receive 50 bonus Kisan Coins!
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20 self-start sm:self-auto">
          <span className="font-mono font-black text-sm tracking-wider px-3">{referralCode}</span>
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Rewards Catalog */}
      <div className="space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Kisan Coin Rewards Store</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rewards.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between gap-4"
            >
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">{r.category}</span>
                <h4 className="font-bold text-xs text-slate-900 mt-0.5">{r.title}</h4>
                <span className="text-xs font-black text-amber-600 mt-1 block">
                  {r.cost} Kisan Coins
                </span>
              </div>

              <button
                disabled={(user?.kisanCoins || 0) < r.cost}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs whitespace-nowrap"
              >
                Redeem Reward
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
