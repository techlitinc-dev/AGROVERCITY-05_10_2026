import { registerLocale } from '../index';

/** Trust & safety, ratings, admin queues (phase-06 WS-01/WS-03). */
const enAdmin: Record<string, string> = {
  'trust.report': 'Report',
  'trust.block': 'Block',
  'trust.unblock': 'Unblock',
  'trust.reported': 'Reported — our team will review',
  'trust.blocked': 'User blocked',
  'trust.unblocked': 'User unblocked',
  'trust.tier.new': 'New',
  'trust.tier.trusted': 'Trusted',
  'trust.tier.established': 'Established',
  'trust.tier.top': 'Top rated',
  'rate.title': 'Rate your experience',
  'rate.submit': 'Submit rating',
  'rate.skip': 'Not now',
  'admin.moderationQueue.title': 'Moderation queue',
  'admin.moderationQueue.empty': 'No open reports',
  'admin.moderationQueue.loadMore': 'Load more',
  'admin.fraudQueue.title': 'Fraud holds',
  'admin.fraudQueue.empty': 'No open holds',
  'admin.fraudQueue.release': 'Release',
  'admin.fraudQueue.reject': 'Reject',
  'admin.fraudQueue.reason': 'Reason',
  'admin.localeReview.title': 'Locale review',
  'admin.localeReview.approve': 'Approve',
  'admin.localeReview.reject': 'Reject',
  'admin.localeReview.empty': 'No pending drafts',
  'metrics.title': 'North-star metrics',
  'metrics.wtf': 'Weekly transacting farmers',
  'metrics.gmv': 'GMV per marketplace',
  'metrics.takeRate': 'Take-rate revenue',
  'metrics.paidConversion': 'Paid-plan conversion',
  'metrics.tasksPerUser': 'Tasks per user / week',
  'metrics.deepLinkRate': 'Deep-link completion rate',
};

registerLocale('en', enAdmin);
