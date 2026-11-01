import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Award, CheckCircle2 } from 'lucide-react';
import { courses, apiErrorMessage } from '../../lib/api';
import { asRec, strOf } from './helpers';

/**
 * Learner-facing Course Completion Certificate. Issued only against the real
 * completion rules (every lesson complete) — it never implies professional or
 * government accreditation.
 */
export const CourseCertificatePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const courseId = id || '';
  const [cert, setCert] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setCert(asRec(await courses.certificate(courseId)));
      } catch (e) {
        setError(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId]);

  if (loading) return <p className="text-xs text-slate-400">Loading your certificate…</p>;

  if (error || !cert) {
    return (
      <div className="space-y-6">
        <Link to="/academy/my-learning" className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-emerald-600">
          <ArrowLeft className="w-3.5 h-3.5" /> My Learning
        </Link>
        <div className="bg-white rounded-3xl border border-rose-200 shadow-xs p-10 text-center">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-rose-700">{error || 'Certificate not available.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to={`/academy/courses/${courseId}/learn`}
        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-emerald-600"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to course
      </Link>

      <div className="max-w-2xl mx-auto bg-white rounded-3xl border-2 border-amber-300 shadow-md p-10 text-center space-y-4">
        <Award className="w-12 h-12 text-amber-500 mx-auto" />
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
          Agrovercity Gurukul
        </p>
        <h1 className="text-xl font-extrabold text-slate-900">{strOf(cert.certificateTitle) || 'Course Completion Certificate'}</h1>
        <p className="text-xs text-slate-500">Awarded to</p>
        <p className="text-lg font-extrabold text-emerald-800">{strOf(cert.studentName)}</p>
        <p className="text-xs text-slate-500">
          for completing <strong>{strOf(cert.courseTitle)}</strong> with {strOf(cert.instructorName)}
        </p>
        <div className="flex items-center justify-center gap-6 pt-2 text-[10px] text-slate-400">
          <span>
            Issued <strong>{strOf(cert.issuedAt)?.slice(0, 10)}</strong>
          </span>
          <span className="font-mono">{strOf(cert.certificateId)}</span>
        </div>
        <p className="text-[10px] text-slate-400 italic">
          A course completion record — not a professional or government accreditation.
        </p>
        <p className="text-[10px] text-emerald-700 font-bold flex items-center justify-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Verify at {strOf(cert.verificationUrl)}
        </p>
      </div>
    </div>
  );
};

export default CourseCertificatePage;
