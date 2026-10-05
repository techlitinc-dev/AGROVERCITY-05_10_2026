import { registerLocale } from '../index';

/**
 * Agri News strings — Hindi (merged into `hi`, falls back to en for gaps).
 */

const hiNews: Record<string, string> = {
  newsTitle: 'कृषि समाचार',
  newsListen: 'सुनें',
  newsShareWhatsApp: 'व्हाट्सऐप पर साझा करें',
  newsBreaking: 'ब्रेकिंग',
  newsImpact: 'प्रभाव',
  newsAllCategories: 'सभी',
  newsViewAll: 'सभी समाचार देखें',
  newsEmpty: 'अभी कोई समाचार नहीं',
  newsLoadFailed: 'समाचार लोड नहीं हो सके — कृपया पुनः प्रयास करें',
  newsBackToFeed: 'समाचार पर वापस जाएँ',
};

registerLocale('hi', hiNews);
