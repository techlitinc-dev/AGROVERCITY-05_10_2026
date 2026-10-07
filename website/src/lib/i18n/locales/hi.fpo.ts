import { registerLocale } from '../index';

/**
 * FPO (discovery, join, pools, shared machinery) strings — merged into `hi`.
 * Same key set as `en.fpo.ts` (parity-checked).
 */

const hiFpo: Record<string, string> = {
  fpoDirectoryTitle: 'एफपीओ निर्देशिका',
  fpoDirectoryHint: 'अपने पास की किसान उत्पादक संगठन से जुड़ें।',
  fpoMemberCount: '{count} सदस्य',
  fpoMembershipMember: 'सदस्य',
  fpoMembershipPending: 'अनुरोध लंबित',
  fpoMembershipNone: 'सदस्य नहीं',
  fpoVerificationUnverified: 'सत्यापन लंबित',
  fpoVerificationVerified: 'सत्यापित',
  fpoJoin: 'सदस्यता अनुरोध भेजें',
  fpoJoinSent: 'सदस्यता अनुरोध भेजा गया — स्वीकृति हेतु लंबित।',
  fpoJoinApproveDev: 'सदस्य के रूप में चिह्नित करें (डेव)',
  fpoJoinAlreadyMember: 'आप पहले से सदस्य हैं।',
  fpoEmpty: 'कोई एफपीओ नहीं मिला।',
  fpoLoadFailed: 'एफपीओ निर्देशिका लोड नहीं हो सकी।',

  fpoPoolsTitle: 'समूह-खरीद पूल',
  fpoPoolsHint: 'समूह छूट पाने के लिए अन्य सदस्यों के साथ मांग जोड़ें।',
  fpoPoolsEmpty: 'कोई खुला समूह-खरीद पूल नहीं है।',
  fpoPoolsLoadFailed: 'समूह-खरीद पूल लोड नहीं हो सके।',
  fpoPoolProgress: '{booked} / {target} इकाइयाँ',
  fpoPoolDiscount: '{percent}% समूह छूट',
  fpoPoolDeadline: '{date} तक बंद',
  fpoPoolJoin: 'पूल जॉइन करें',
  fpoPoolJoined: 'आप पूल में शामिल हो गए।',
  fpoPoolFull: 'इस पूल का लक्ष्य पूरा हो गया है।',
  fpoPoolUnits: 'इकाइयाँ',

  fpoMachineryTitle: 'साझा मशीनरी कैलेंडर',
  fpoMachineryHint: 'एफपीओ के माध्यम से साझा मशीनरी और स्लॉट।',
  fpoMachineryEmpty: 'इस सप्ताह कोई साझा मशीनरी स्लॉट नहीं।',
  fpoMachineryLoadFailed: 'मशीनरी कैलेंडर लोड नहीं हो सका।',
  fpoMachineryWeek: '{date} से शुरू सप्ताह',
  fpoSlotAvailable: 'उपलब्ध',
  fpoSlotBooked: 'बुक',
  fpoSlotPrice: '₹{price}',
};

registerLocale('hi', hiFpo);
