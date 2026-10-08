import { registerLocale } from '../index';

/** Notification prefs, consent center, account deletion, offline sync (WS-02/04/06). */
const enSettings: Record<string, string> = {
  notifEnablePush: 'Enable push notifications',
  notifPushEnabled: 'Push notifications enabled',
  notifPushDenied: 'Push permission not granted',
  tool_notificationPrefs: 'Notification settings',
  tool_notificationPrefs_sub: 'Categories, channels & quiet hours',
  'notif.prefs.title': 'Notification settings',
  'notif.prefs.categories': 'Categories',
  'notif.prefs.channels': 'Channels',
  'notif.prefs.tasks': 'Tasks',
  'notif.prefs.trade': 'Trade',
  'notif.prefs.payments': 'Payments',
  'notif.prefs.social': 'Social',
  'notif.prefs.marketing': 'Marketing',
  'notif.prefs.push': 'Push',
  'notif.prefs.sms': 'SMS',
  'notif.prefs.inApp': 'In-app',
  'notif.prefs.quietHours': 'Override quiet hours (21:00–06:30)',
  'notif.prefs.digest': 'Digest mode (batch non-urgent updates)',
  'consent.title': 'Consent center',
  'consent.dataSharing': 'Data sharing',
  'consent.dataSharing.purpose':
    'Allow AGROVERCITY to share your details with matched buyers, transporters and service providers so they can fulfil your orders.',
  'consent.location': 'Location',
  'consent.location.purpose':
    'Use your GPS location for mandi discovery, weather advisories and the farm map.',
  'consent.marketing': 'Marketing',
  'consent.marketing.purpose':
    'Receive offers, promotions and product announcements from AGROVERCITY.',
  'delete.title': 'Delete account',
  'delete.consequences':
    'This permanently deletes your profile, personas, transactions, diaries, consents and notifications. This cannot be undone.',
  'delete.reauth': 'Enter your 4-digit MPIN to confirm',
  'delete.confirm': 'Delete my account',
  'delete.done': 'Your account has been deleted.',
  tool_consentCenter: 'Consent center',
  tool_consentCenter_sub: 'Privacy & data sharing',
  tool_accountDelete: 'Delete account',
  tool_accountDelete_sub: 'Permanently remove your data',
  'offline.pendingSync': '{count} change(s) waiting to sync',
  'offline.synced': 'All changes synced',
  'offline.syncFailed': 'Sync failed — will retry when online',
};

registerLocale('en', enSettings);
