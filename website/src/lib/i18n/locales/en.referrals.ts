import { registerLocale } from '../index';

/**
 * Refer & Earn strings — merged into `en`. Key catalog is the contract for
 * views/referrals/.
 *
 * `referralsCreditAfterTransaction` states the X11 anti-fraud rule visibly:
 * the referrer is credited only after the invitee's FIRST completed
 * transaction. Common keys (commonLoading, actionFailed) come from the trade
 * locale.
 */

const enReferrals: Record<string, string> = {
  referralsTitle: 'Refer & Earn',
  referralsHint: 'Invite fellow farmers and earn AgriCoins together.',
  referralsLoadFailed: 'Could not load your referral hub.',

  referralsCodeTitle: 'Your referral code',
  referralsCopy: 'Copy code',
  referralsCopied: 'Referral code copied',
  referralsShareWhatsapp: 'Share on WhatsApp',
  referralsCreditAfterTransaction:
    'Your reward is credited only after your invitee completes their first transaction.',

  referralsStatsTitle: 'Your progress',
  referralsStatInvited: 'Invited',
  referralsStatJoined: 'Joined',
  referralsStatEarned: 'Coins earned',

  referralsMilestonesTitle: 'Milestones',
  referralsMilestone: '{count} joins — +{coins} coins',
  referralsMilestoneAchieved: 'Achieved',
  referralsMilestonePending: 'In progress',

  referralsReferredTitle: 'Farmers you invited',
  referralsReferredEmpty: 'No invites yet — share your code to start.',
  referralsReferredStatusInvited: 'Invited',
  referralsReferredStatusJoined: 'Joined',
  referralsReferredStatusCredited: 'Rewarded',
  referralsRewardCoins: '+{coins} coins',

  referralsLeaderboardTitle: 'Referral leaderboard',
  referralsLeaderboardEmpty: 'No rankings yet.',
  referralsRank: 'Rank #{rank}',
  referralsColName: 'Farmer',
  referralsColVillage: 'Village',
  referralsColCount: 'Referrals',
  referralsYou: 'You',

  referralsInviteTitle: 'Invite by phone',
  referralsInviteName: 'Name',
  referralsInvitePhone: 'Phone (E.164)',
  referralsInvitePhonePlaceholder: '+919876543210',
  referralsInviteSubmit: 'Send invite',
  referralsInviteSent: 'Invite recorded',
  referralsInviteLoadFailed: 'Could not load the referral hub.',
};

registerLocale('en', enReferrals);
