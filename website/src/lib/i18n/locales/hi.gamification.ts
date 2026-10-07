import { registerLocale } from '../index';

/**
 * Krishi Ratna (gamification) strings — merged into `hi`. Key set mirrors
 * `en.gamification.ts` exactly (parity-checked).
 */

const hiGamification: Record<string, string> = {
  gamificationTitle: 'कृषि रत्न',
  gamificationHint: 'सिक्के, इनाम और साथी किसानों में आपकी स्थिति।',

  gamificationWalletTitle: 'मेरा सिक्का बटुआ',
  gamificationWalletHint: 'आपके कमाए और खर्च किए हर सिक्के का हिसाब।',
  gamificationBalance: 'सिक्का शेष',
  gamificationLevel: 'स्तर: {tier}',
  gamificationNextTier: 'अगले स्तर तक {coins} सिक्के',
  gamificationTopTier: 'सर्वोच्च स्तर प्राप्त',
  gamificationStreakCurrent: 'वर्तमान स्ट्रीक',
  gamificationStreakLongest: 'सबसे लंबी स्ट्रीक',
  gamificationDays: '{count} दिन',
  gamificationEarnedTotal: 'कमाए सिक्के',
  gamificationBadgesTitle: 'बैज',
  gamificationBadgeProgress: '{progress}/{target}',
  gamificationWalletLoadFailed: 'आपका सिक्का बटुआ लोड नहीं हो सका।',

  gamificationLedgerTitle: 'सिक्का बहीखाता',
  gamificationLedgerEmpty: 'अभी कोई सिक्का गतिविधि नहीं।',
  gamificationLedgerLoadMore: 'और लोड करें',

  gamificationStoreTitle: 'इनाम स्टोर',
  gamificationStoreHint: 'वाउचर, मिट्टी जांच और विशेषज्ञ सत्र के लिए सिक्के भुनाएं।',
  gamificationRedeem: 'भुनाएं',
  gamificationRedeemed: 'भुनाया गया — वाउचर {code}',
  gamificationStoreLoadFailed: 'इनाम स्टोर लोड नहीं हो सका।',
  coinsNoCashRedemption: 'सिक्के कभी नकद के बदले भुनाए नहीं जा सकते',

  gamificationLeaderboardTitle: 'सिक्का लीडरबोर्ड',
  gamificationLeaderboardHint: 'प्लेटफ़ॉर्म पर सबसे ज़्यादा सिक्के कमाने वाले।',
  gamificationLeaderboardAll: 'अब तक',
  gamificationLeaderboardMonth: 'इस महीने',
  gamificationLeaderboardEmpty: 'अभी कोई रैंकिंग नहीं।',
  gamificationRank: 'रैंक #{rank}',
  gamificationColName: 'किसान',
  gamificationColVillage: 'गाँव',
  gamificationColCoins: 'सिक्के',
  gamificationYou: 'आप',
};

registerLocale('hi', hiGamification);
