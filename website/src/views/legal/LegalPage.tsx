import { Navigate, useParams } from 'react-router-dom';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';
import { useT } from '../../lib/i18n';
import '../../theme/views.css';

type LegalKey = 'privacy' | 'terms' | 'refunds' | 'community';

interface LegalContent {
  titleKey: string;
  sections: Array<{ heading: string; body: string[] }>;
}

const CONTENT: Record<LegalKey, LegalContent> = {
  privacy: {
    titleKey: 'legalPrivacyTitle',
    sections: [
      {
        heading: '1. Information we collect',
        body: [
          'AGROVERCITY is a digital agriculture marketplace. To create your account we collect your name, mobile number (verified by OTP), state, and the farm and role details you enter during onboarding (village, district, land area, soil type, irrigation, crops, and any business details for the roles you select).',
          'If you mark your farm boundary on the map, we store the boundary points and calculated area so we can show you field-level services. We also collect the content you post — listings, bookings, orders, reviews, and messages between buyers and sellers.',
        ],
      },
      {
        heading: '2. How we use your information',
        body: [
          'We use your information to run the marketplace: matching farmers with buyers, transporters, equipment owners and service providers; showing mandi prices and crop advisories for your region; processing orders and payments; and keeping your account secure with your MPIN.',
          'Your phone number is visible to counterparties you transact with (for example, a buyer who books your produce) so they can coordinate pickup and delivery. We never sell your personal data to advertisers.',
        ],
      },
      {
        heading: '3. Location and device data',
        body: [
          'With your permission we use your GPS location to suggest languages, find nearby mandis, and place you on the farm map. You can deny location access and still use the app — you will just type your village and district manually.',
        ],
      },
      {
        heading: '4. Data sharing and retention',
        body: [
          'We share the minimum data needed with service providers who work for us (SMS delivery, payment processing, cloud hosting) and with the counterparty in a transaction you initiate. We may disclose data if the law requires it.',
          'You can ask us to correct or delete your account data at any time from Settings, or by contacting support. Account data is deleted within 30 days of a verified deletion request, except records we must keep for tax, fraud-prevention, or legal reasons.',
        ],
      },
      {
        heading: '5. Security',
        body: [
          'Your login is protected by a 4-digit MPIN and Firebase-verified phone authentication. All traffic is encrypted in transit. Access to personal data inside our systems is restricted to staff who need it to operate the service.',
        ],
      },
      {
        heading: '6. Contact',
        body: [
          'For privacy questions, data correction, or deletion requests, contact the AGROVERCITY support team through the Help & Support section in the app.',
        ],
      },
    ],
  },
  terms: {
    titleKey: 'legalTermsTitle',
    sections: [
      {
        heading: '1. Acceptance of terms',
        body: [
          'By creating an AGROVERCITY account you agree to these Terms of Use and our Privacy Policy. If you do not agree, please do not use the service.',
          'You must be 18 years or older and legally able to form a contract in India to register. One person may hold multiple roles (farmer, seller, transporter, and so on) under a single account, and you are responsible for the information you provide for each role.',
        ],
      },
      {
        heading: '2. Your account',
        body: [
          'You are responsible for keeping your MPIN secret and for everything that happens under your account. Tell us immediately at support if you suspect unauthorised use.',
          'Information you provide during registration — farm details, licences, GST numbers, vehicle RC numbers — must be true. Listings or profiles with false or misleading information may be suspended.',
        ],
      },
      {
        heading: '3. Marketplace conduct',
        body: [
          'Buyers and sellers negotiate prices and confirm quantities through the platform. Once an order or booking is confirmed, both sides are expected to honour it. Cancelling confirmed orders repeatedly may lead to account restrictions.',
          'You agree not to list prohibited items, misrepresent produce quality or quantity, manipulate prices, or use the platform for anything unlawful. Reviews must reflect genuine transactions.',
        ],
      },
      {
        heading: '4. Payments and fees',
        body: [
          'Payments between parties follow the payment terms shown at the time of the order. Any platform fees or commissions are displayed before you confirm a transaction.',
          'You are responsible for taxes applicable to your sales under Indian law, including GST where you are registered.',
        ],
      },
      {
        heading: '5. Content and intellectual property',
        body: [
          'You keep ownership of the content you upload, and you grant AGROVERCITY a licence to display it in the app so the marketplace can function. Do not upload content you do not have the rights to.',
        ],
      },
      {
        heading: '6. Changes and termination',
        body: [
          'We may update these terms from time to time; material changes will be announced in the app. You may delete your account at any time. We may suspend accounts that breach these terms, with notice where practicable.',
        ],
      },
    ],
  },
  refunds: {
    titleKey: 'legalRefundsTitle',
    sections: [
      {
        heading: '1. Cancellation by the buyer',
        body: [
          'An order can be cancelled free of charge before the seller confirms it. After confirmation but before dispatch, cancellation is at the seller\'s discretion and may attract charges already incurred (packing, loading, transport booking).',
          'Once produce has been dispatched, orders cannot be cancelled; please use the dispute process below for quality issues on delivery.',
        ],
      },
      {
        heading: '2. Quality disputes on delivery',
        body: [
          'If delivered produce does not match the agreed grade or quantity, report it in the app within 24 hours of delivery with photos. Our team will review the evidence and may approve a full or partial refund, or a replacement, within 5–7 working days.',
          'Perishable goods that deteriorate after accepted delivery, or produce rejected for reasons not related to quality (for example, a change of mind), are not eligible for refund.',
        ],
      },
      {
        heading: '3. Service bookings (transport, equipment, cold storage)',
        body: [
          'Bookings cancelled more than 12 hours before the scheduled slot receive a full refund of any advance. Cancellations within 12 hours forfeit the advance, which compensates the provider for the reserved slot.',
          'If the provider fails to show up or the service was not delivered as booked, the full advance is refunded automatically.',
        ],
      },
      {
        heading: '4. How refunds are paid',
        body: [
          'Approved refunds are returned to the original payment method (UPI, bank account, or wallet) within 5–7 working days. Platform fees on refunded transactions are refunded in full.',
        ],
      },
      {
        heading: '5. Raising a request',
        body: [
          'Raise cancellations, disputes, and refund requests from the order or booking detail screen, or through Help & Support. Keep photos of the produce and the weighbridge slip where possible — they make resolution much faster.',
        ],
      },
    ],
  },
  community: {
    titleKey: 'legalCommunityTitle',
    sections: [
      {
        heading: '1. Who we are',
        body: [
          'AGROVERCITY connects farmers, traders, transporters, equipment owners, instructors, dairy operators, banks, and buyers. The community works best when everyone deals honestly and respectfully, in any of the languages the app supports.',
        ],
      },
      {
        heading: '2. Deal honestly',
        body: [
          'Quote real prices, real quantities, and real grades. Honour confirmed orders and bookings. If something goes wrong — weather, vehicle breakdown, crop failure — tell the other party as early as you can and cancel through the app rather than simply not showing up.',
        ],
      },
      {
        heading: '3. Respect each other',
        body: [
          'No abuse, harassment, caste or gender-based discrimination, or personal attacks in messages or reviews. Negotiation is part of the mandi culture — keep it hard but fair, never insulting.',
          'Women farmers, first-time sellers, and smallholders get the same respect and the same prices as everyone else.',
        ],
      },
      {
        heading: '4. Keep it useful',
        body: [
          'Post in the right category, use real photos of your actual produce or vehicles, and share advice in the community sections only if you genuinely know it. Wrong advice on pesticides, loans, or animal health can cause real damage — when in doubt, say so.',
        ],
      },
      {
        heading: '5. Safety',
        body: [
          'Meet counterparties in public places where possible, verify vehicle and licence details before big bookings, and never share your MPIN or OTP with anyone — AGROVERCITY staff will never ask for them.',
        ],
      },
      {
        heading: '6. Reporting',
        body: [
          'Use the report option on any profile, listing, or message that breaks these guidelines. Our team reviews reports within 48 hours and may warn, restrict, or suspend accounts that repeatedly violate community standards.',
        ],
      },
    ],
  },
};

/** Static legal pages rendered as a centered prose column inside a white panel. */
export default function LegalPage() {
  const t = useT();
  const { page } = useParams<{ page: string }>();
  const content = page ? CONTENT[page as LegalKey] : undefined;
  if (!content) return <Navigate to="/" replace />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <SiteHeader />
      <main style={{ flex: 1 }}>
        <div className="av-container">
          <div className="av-panel legal-prose">
            <h1>{t(content.titleKey)}</h1>
            <p className="legal-updated">{t('legalLastUpdated')}</p>
            {content.sections.map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                {section.body.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
