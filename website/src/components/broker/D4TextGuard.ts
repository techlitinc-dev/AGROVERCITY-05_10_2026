/**
 * D4 ingress filter (spec D4) — client-side pre-send guard until the backend
 * enforces it server-side. Blocks phone numbers, emails, external links
 * (incl. WhatsApp/Telegram) and UPI VPAs from leaving the composer.
 */

export interface D4Verdict {
  blocked: boolean;
  /** i18n key of the matched rule (d4RulePhone / d4RuleEmail / d4RuleLink / d4RuleUpi). */
  rule?: string;
}

const RULES: Array<{ rule: string; test: (text: string) => boolean }> = [
  {
    rule: 'd4RulePhone',
    test: (text) => {
      const compact = text.replace(/[\s-]/g, '');
      return /(?:\+?91)?[6-9]\d{9}/.test(compact);
    },
  },
  {
    rule: 'd4RuleEmail',
    test: (text) => /[\w.+-]+@[\w-]+\.[\w.]+/.test(text),
  },
  {
    rule: 'd4RuleLink',
    test: (text) => /(https?:\/\/|www\.|wa\.me|t\.me|whatsapp|telegram)/i.test(text),
  },
  {
    rule: 'd4RuleUpi',
    test: (text) =>
      /\b[a-z0-9][a-z0-9._-]{1,}@(okhdfc|okicici|okaxis|oksbi|okboi|paytm|ybl|upi|apl|ok|sbi)\b/i.test(
        text
      ),
  },
];

export function checkBlockedText(text: string): D4Verdict {
  if (!text.trim()) return { blocked: false };
  for (const { rule, test } of RULES) {
    if (test(text)) return { blocked: true, rule };
  }
  return { blocked: false };
}
