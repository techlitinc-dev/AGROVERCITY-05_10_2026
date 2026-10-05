import { registerLocale } from '../index';

/**
 * Agri News strings (phase-04 WS-05) — merged into `en`.
 * Key catalog is the contract for all views under views/news/.
 */

const enNews: Record<string, string> = {
  newsTitle: 'Agri News',
  newsListen: 'Listen',
  newsShareWhatsApp: 'Share on WhatsApp',
  newsBreaking: 'Breaking',
  newsImpact: 'Impact',
  newsAllCategories: 'All',
  newsViewAll: 'View all news',
  newsEmpty: 'No news right now',
  newsLoadFailed: 'Could not load news — please try again',
  newsBackToFeed: 'Back to news',
};

registerLocale('en', enNews);
