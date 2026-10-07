import { registerLocale } from '../index';

/**
 * Krishi Ratna (gamification) strings — merged into `en`. Key catalog is the
 * contract for views/rewards/.
 *
 * `coinsNoCashRedemption` is the mandatory regulatory label shown in the
 * rewards store (X11 — coins are NEVER redeemable for cash). Common keys
 * (commonLoading, actionFailed, retry) come from the trade locale.
 */

const enGamification: Record<string, string> = {
  gamificationTitle: 'Krishi Ratna',
  gamificationHint: 'Coins, rewards and your standing among fellow farmers.',

  gamificationWalletTitle: 'My coin wallet',
  gamificationWalletHint: 'Every coin you have earned and spent.',
  gamificationBalance: 'Coin balance',
  gamificationLevel: 'Level: {tier}',
  gamificationNextTier: '{coins} coins to the next level',
  gamificationTopTier: 'Top level reached',
  gamificationStreakCurrent: 'Current streak',
  gamificationStreakLongest: 'Longest streak',
  gamificationDays: '{count} days',
  gamificationEarnedTotal: 'Coins earned',
  gamificationBadgesTitle: 'Badges',
  gamificationBadgeProgress: '{progress}/{target}',
  gamificationWalletLoadFailed: 'Could not load your coin wallet.',

  gamificationLedgerTitle: 'Coin ledger',
  gamificationLedgerEmpty: 'No coin activity yet.',
  gamificationLedgerLoadMore: 'Load more',

  gamificationStoreTitle: 'Rewards store',
  gamificationStoreHint: 'Redeem coins for vouchers, soil tests and expert sessions.',
  gamificationRedeem: 'Redeem',
  gamificationRedeemed: 'Redeemed — voucher {code}',
  gamificationStoreLoadFailed: 'Could not load the rewards store.',
  coinsNoCashRedemption: 'Coins are never redeemable for cash',

  gamificationLeaderboardTitle: 'Coin leaderboard',
  gamificationLeaderboardHint: 'Top coin earners across the platform.',
  gamificationLeaderboardAll: 'All time',
  gamificationLeaderboardMonth: 'This month',
  gamificationLeaderboardEmpty: 'No rankings yet.',
  gamificationRank: 'Rank #{rank}',
  gamificationColName: 'Farmer',
  gamificationColVillage: 'Village',
  gamificationColCoins: 'Coins',
  gamificationYou: 'You',
};

registerLocale('en', enGamification);
