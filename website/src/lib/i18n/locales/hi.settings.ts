import { registerLocale } from '../index';

/** Notification prefs, consent center, account deletion, offline sync (WS-02/04/06). */
const hiSettings: Record<string, string> = {
  notifEnablePush: 'पुश सूचनाएँ चालू करें',
  notifPushEnabled: 'पुश सूचनाएँ चालू',
  notifPushDenied: 'पुश अनुमति नहीं मिली',
  tool_notificationPrefs: 'सूचना सेटिंग्स',
  tool_notificationPrefs_sub: 'श्रेणियाँ, चैनल और शांत समय',
  'notif.prefs.title': 'सूचना सेटिंग्स',
  'notif.prefs.categories': 'श्रेणियाँ',
  'notif.prefs.channels': 'चैनल',
  'notif.prefs.tasks': 'कार्य',
  'notif.prefs.trade': 'व्यापार',
  'notif.prefs.payments': 'भुगतान',
  'notif.prefs.social': 'सामाजिक',
  'notif.prefs.marketing': 'मार्केटिंग',
  'notif.prefs.push': 'पुश',
  'notif.prefs.sms': 'एसएमएस',
  'notif.prefs.inApp': 'इन-ऐप',
  'notif.prefs.quietHours': 'शांत समय ओवरराइड करें (21:00–06:30)',
  'notif.prefs.digest': 'डाइजेस्ट मोड (गैर-ज़रूरी अपडेट एक साथ)',
  'consent.title': 'सहमति केंद्र',
  'consent.dataSharing': 'डेटा साझाकरण',
  'consent.dataSharing.purpose':
    'AGROVERCITY को आपका विवरण मिलान किए गए खरीदारों, ट्रांसपोर्टरों और सेवा प्रदाताओं के साथ साझा करने दें ताकि वे आपके ऑर्डर पूरे कर सकें।',
  'consent.location': 'स्थान',
  'consent.location.purpose':
    'मंडी खोज, मौसम सलाह और खेत नक्शे के लिए आपके GPS स्थान का उपयोग करें।',
  'consent.marketing': 'मार्केटिंग',
  'consent.marketing.purpose': 'AGROVERCITY से ऑफ़र, प्रचार और उत्पाद घोषणाएँ प्राप्त करें।',
  'delete.title': 'खाता हटाएँ',
  'delete.consequences':
    'यह आपकी प्रोफ़ाइल, भूमिकाएँ, लेन-देन, डायरी, सहमतियाँ और सूचनाएँ स्थायी रूप से हटा देता है। इसे पूर्ववत नहीं किया जा सकता।',
  'delete.reauth': 'पुष्टि के लिए अपना 4 अंकों का MPIN दर्ज करें',
  'delete.confirm': 'मेरा खाता हटाएँ',
  'delete.done': 'आपका खाता हटा दिया गया है।',
  tool_consentCenter: 'सहमति केंद्र',
  tool_consentCenter_sub: 'गोपनीयता और डेटा साझाकरण',
  tool_accountDelete: 'खाता हटाएँ',
  tool_accountDelete_sub: 'अपना डेटा स्थायी रूप से हटाएँ',
  'offline.pendingSync': '{count} बदलाव सिंक होने बाकी',
  'offline.synced': 'सभी बदलाव सिंक हो गए',
  'offline.syncFailed': 'सिंक विफल — ऑनलाइन होने पर पुनः प्रयास होगा',
};

registerLocale('hi', hiSettings);
