import { registerLocale } from '../index';

/** Trust & safety, ratings, admin queues (phase-06 WS-01/WS-03). */
const hiAdmin: Record<string, string> = {
  'trust.report': 'रिपोर्ट करें',
  'trust.block': 'ब्लॉक करें',
  'trust.unblock': 'अनब्लॉक करें',
  'trust.reported': 'रिपोर्ट की गई — हमारी टीम जाँच करेगी',
  'trust.blocked': 'उपयोगकर्ता ब्लॉक किया गया',
  'trust.unblocked': 'उपयोगकर्ता अनब्लॉक किया गया',
  'trust.tier.new': 'नया',
  'trust.tier.trusted': 'भरोसेमंद',
  'trust.tier.established': 'स्थापित',
  'trust.tier.top': 'टॉप रेटेड',
  'rate.title': 'अपना अनुभव रेट करें',
  'rate.submit': 'रेटिंग दें',
  'rate.skip': 'अभी नहीं',
  'admin.moderationQueue.title': 'मॉडरेशन क्यू',
  'admin.moderationQueue.empty': 'कोई खुली रिपोर्ट नहीं',
  'admin.moderationQueue.loadMore': 'और लोड करें',
  'admin.fraudQueue.title': 'धोखाधड़ी होल्ड',
  'admin.fraudQueue.empty': 'कोई खुला होल्ड नहीं',
  'admin.fraudQueue.release': 'रिलीज़ करें',
  'admin.fraudQueue.reject': 'अस्वीकार करें',
  'admin.fraudQueue.reason': 'कारण',
  'admin.localeReview.title': 'भाषा समीक्षा',
  'admin.localeReview.approve': 'स्वीकृत करें',
  'admin.localeReview.reject': 'अस्वीकार करें',
  'admin.localeReview.empty': 'कोई लंबित ड्राफ्ट नहीं',
  'metrics.title': 'उत्तर-तारा मेट्रिक्स',
  'metrics.wtf': 'साप्ताहिक लेन-देन करने वाले किसान',
  'metrics.gmv': 'बाज़ार अनुसार GMV',
  'metrics.takeRate': 'टेक-रेट राजस्व',
  'metrics.paidConversion': 'सशुल्क-प्लान रूपांतरण',
  'metrics.tasksPerUser': 'प्रति उपयोगकर्ता कार्य / सप्ताह',
  'metrics.deepLinkRate': 'डीप-लिंक पूर्णता दर',
};

registerLocale('hi', hiAdmin);
