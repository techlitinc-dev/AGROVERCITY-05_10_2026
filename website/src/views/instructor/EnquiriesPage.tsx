import { useCallback, useEffect, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  fetchEnquiries,
  quoteEnquiryFee,
  type CourseEnquiry,
} from '../../lib/api/instructorAcademy';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const ENQUIRY_STATUS_KEYS: Record<string, string> = {
  pending: 'instructorEnquiryPending',
  quoted: 'instructorEnquiryQuoted',
  enrolled: 'instructorEnquiryEnrolled',
};

/**
 * Enquiries (WS-02 task 2.5) — GET /v1/teachers/enquiries; replies go through
 * structured template cards only (fee quote = proposedFeeRupees + terms). No
 * free-text chat pre-booking (instructions.md §WS-02 step 1).
 */
export default function EnquiriesPage() {
  const t = useT();
  const [enquiries, setEnquiries] = useState<CourseEnquiry[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [quote, setQuote] = useState({ proposedFeeRupees: '', terms: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchEnquiries()
      .then(setEnquiries)
      .catch(() => {
        setEnquiries([]);
        toast(t('instructorLoadFailed'), { error: true });
      });
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleQuote = async (event: React.FormEvent, enquiryId: string) => {
    event.preventDefault();
    setBusy(true);
    try {
      await quoteEnquiryFee(enquiryId, {
        proposedFeeRupees: Number(quote.proposedFeeRupees),
        terms: quote.terms,
      });
      setActiveId(null);
      setQuote({ proposedFeeRupees: '', terms: '' });
      toast(t('instructorQuoteSent'));
      load();
    } catch {
      toast(t('instructorQuoteFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="enquiries">
      <section className="dash-section">
        <h3>{t('instructorEnquiries')}</h3>
        {enquiries === null ? (
          <p className="dash-empty-line">{t('instructorLoading')}</p>
        ) : enquiries.length === 0 ? (
          <p className="dash-empty-line">📩 {t('instructorNoEnquiries')}</p>
        ) : (
          enquiries.map((enquiry) => (
            <div key={enquiry.id} style={{ padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <strong>{enquiry.farmerName}</strong>
                <span style={{ fontSize: 12, color: '#6B7280' }}>
                  {ENQUIRY_STATUS_KEYS[enquiry.status] ? t(ENQUIRY_STATUS_KEYS[enquiry.status]) : enquiry.status}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#6B7280' }}>{enquiry.courseTitle}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                {t('instructorEnquiryCard')}: “{enquiry.questionTemplate}”
              </div>
              {enquiry.quotedFeeRupees ? (
                <div style={{ fontSize: 13, color: '#166534' }}>
                  {t('instructorQuotedFee')}: {enquiry.quotedFeeRupees} • {enquiry.terms}
                </div>
              ) : activeId === enquiry.id ? (
                <form onSubmit={(e) => handleQuote(e, enquiry.id)} style={{ display: 'grid', gap: 6, maxWidth: 380, marginTop: 6 }}>
                  <input
                    className="av-input"
                    type="number"
                    placeholder={t('instructorQuotedFee')}
                    value={quote.proposedFeeRupees}
                    onChange={(e) => setQuote({ ...quote, proposedFeeRupees: e.target.value })}
                    required
                  />
                  <input
                    className="av-input"
                    placeholder={t('instructorQuoteTerms')}
                    value={quote.terms}
                    onChange={(e) => setQuote({ ...quote, terms: e.target.value })}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="av-btn" disabled={busy}>
                      {t('instructorSendQuote')}
                    </button>
                    <button type="button" className="av-btn" onClick={() => setActiveId(null)}>
                      {t('instructorCancel')}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  className="av-btn"
                  style={{ marginTop: 6 }}
                  onClick={() => {
                    setActiveId(enquiry.id);
                    setQuote({ proposedFeeRupees: '', terms: '' });
                  }}
                >
                  {t('instructorSendQuote')}
                </button>
              )}
            </div>
          ))
        )}
      </section>
    </ToolShell>
  );
}
