import { registerLocale } from '../index';

/**
 * Refer & Earn strings — merged into `hi`. Key set mirrors `en.referrals.ts`
 * exactly (parity-checked).
 */

const hiReferrals: Record<string, string> = {
  referralsTitle: 'रेफर करें और कमाएं',
  referralsHint: 'साथी किसानों को आमंत्रित करें और साथ में एग्री-कॉइन्स कमाएं।',
  referralsLoadFailed: 'आपका रेफरल हब लोड नहीं हो सका।',

  referralsCodeTitle: 'आपका रेफरल कोड',
  referralsCopy: 'कोड कॉपी करें',
  referralsCopied: 'रेफरल कोड कॉपी हो गया',
  referralsShareWhatsapp: 'WhatsApp पर साझा करें',
  referralsCreditAfterTransaction:
    'आपका इनाम तभी जुड़ेगा जब आपका आमंत्रित किसान अपना पहला लेन-देन पूरा करेगा।',

  referralsStatsTitle: 'आपकी प्रगति',
  referralsStatInvited: 'आमंत्रित',
  referralsStatJoined: 'जुड़े',
  referralsStatEarned: 'कमाए सिक्के',

  referralsMilestonesTitle: 'माइलस्टोन',
  referralsMilestone: '{count} जुड़ाव — +{coins} सिक्के',
  referralsMilestoneAchieved: 'पूरा',
  referralsMilestonePending: 'जारी',

  referralsReferredTitle: 'आपके आमंत्रित किसान',
  referralsReferredEmpty: 'अभी कोई आमंत्रण नहीं — शुरू करने के लिए कोड साझा करें।',
  referralsReferredStatusInvited: 'आमंत्रित',
  referralsReferredStatusJoined: 'जुड़े',
  referralsReferredStatusCredited: 'इनाम मिला',
  referralsRewardCoins: '+{coins} सिक्के',

  referralsLeaderboardTitle: 'रेफरल लीडरबोर्ड',
  referralsLeaderboardEmpty: 'अभी कोई रैंकिंग नहीं।',
  referralsRank: 'रैंक #{rank}',
  referralsColName: 'किसान',
  referralsColVillage: 'गाँव',
  referralsColCount: 'रेफरल',
  referralsYou: 'आप',

  referralsInviteTitle: 'फ़ोन से आमंत्रित करें',
  referralsInviteName: 'नाम',
  referralsInvitePhone: 'फ़ोन (E.164)',
  referralsInvitePhonePlaceholder: '+919876543210',
  referralsInviteSubmit: 'आमंत्रण भेजें',
  referralsInviteSent: 'आमंत्रण दर्ज हुआ',
  referralsInviteLoadFailed: 'रेफरल हब लोड नहीं हो सका।',
};

registerLocale('hi', hiReferrals);
