import { api } from './client';

export interface AcademyCourse {
  id: string;
  title: string;
  category: string;
  instructorId: string;
  instructorName: string;
  description?: string;
  syllabus: string[];
  sessionCount: number;
  practicalHours: number;
  mode: string;
  feeRupees: number;
  batchCapacity: number;
  enrolledCount: number;
  prerequisites?: string;
  materialsList?: string[];
  ratingAverage: number;
  ratingCount: number;
  status: 'published' | 'draft' | 'archived' | 'pendingReview' | 'rejected';
  /** Phase-07 module 27 consumes this; set by WS-02 task 2.24. */
  moderationStatus?: string;
  createdAt: string;
}

export interface CourseBatch {
  id: string;
  instructorId: string;
  courseId: string;
  courseTitle?: string;
  batchName: string;
  startDate: string;
  endDate: string;
  locationPin: string;
  maxSeats: number;
  enrolledSeats: number;
  scheduleDays: string;
  status: 'upcoming' | 'active' | 'completed';
  createdAt: string;
}

export interface CourseEnquiry {
  id: string;
  instructorId: string;
  farmerId: string;
  farmerName: string;
  courseId: string;
  courseTitle: string;
  questionTemplate: string;
  details?: string;
  status: 'pending' | 'quoted' | 'enrolled';
  quotedFeeRupees?: number;
  terms?: string;
  createdAt: string;
}

export interface SessionAttendance {
  sessionId: string;
  sessionDate: string;
  records: Array<{
    studentId: string;
    studentName: string;
    status: string;
    verifiedAt?: string;
  }>;
  totalPresent: number;
  totalEnrolled: number;
}

export interface PracticalAssignment {
  id: string;
  instructorId: string;
  courseTitle: string;
  studentName: string;
  studentId: string;
  title: string;
  notes: string;
  evidencePhotoUrls: string[];
  rubric: {
    fieldTechnique: string;
    safetyProtocol: string;
    documentation: string;
  };
  grade?: string;
  feedback?: string;
  status: 'submitted' | 'graded';
  submittedAt: string;
  /** Prefill-only AI grade suggestion (WS-06 task 6.9) — never auto-publishes. */
  aiSuggestion?: {
    rubric?: Array<{ questionId: string; score: number; maxScore: number; feedbackKey: string }>;
    overallFeedbackKey?: string;
    decision_id?: string;
  };
}

export interface AcademyAnalytics {
  totalCourses: number;
  publishedCourses: number;
  pendingReviewCourses: number;
  totalStudents: number;
  completedStudents: number;
  completionRatePercent: number;
  totalEarningsRupees: number;
  averageRating: number;
}

export interface InstructorEarnings {
  grossRevenueRupees: number;
  platformCommissionRupees: number;
  netPayoutRupees: number;
  payoutSchedule: string;
  settledBatchesCount: number;
  pendingSettlementRupees: number;
}

export interface CertificateVerification {
  isValid: boolean;
  certificateId: string;
  recipientName: string;
  courseTitle: string;
  issuedAt: string;
  institution: string;
  tamperProofHash: string;
}

export async function fetchAcademyAnalytics(): Promise<AcademyAnalytics> {
  const res = await api.get<AcademyAnalytics>('/teachers/analytics');
  return res.data;
}

export async function fetchMyCourses(): Promise<AcademyCourse[]> {
  const res = await api.get<{ data: AcademyCourse[] }>('/teachers/courses/mine');
  return res.data.data;
}

export async function createCourse(data: {
  title: string;
  category?: string;
  syllabus?: string[];
  sessionCount?: number;
  practicalHours?: number;
  mode?: string;
  feeRupees: number;
  batchCapacity?: number;
  prerequisites?: string;
  materialsList?: string[];
}): Promise<AcademyCourse> {
  const res = await api.post<AcademyCourse>('/teachers/courses/create', data);
  return res.data;
}

export async function fetchBatches(): Promise<CourseBatch[]> {
  const res = await api.get<{ data: CourseBatch[] }>('/teachers/batches');
  return res.data.data;
}

export async function createBatch(data: {
  courseId: string;
  batchName: string;
  startDate: string;
  endDate: string;
  locationPin?: string;
  maxSeats?: number;
  scheduleDays?: string;
}): Promise<CourseBatch> {
  const res = await api.post<CourseBatch>('/teachers/batches', data);
  return res.data;
}

export async function fetchEnquiries(): Promise<CourseEnquiry[]> {
  const res = await api.get<{ data: CourseEnquiry[] }>('/teachers/enquiries');
  return res.data.data;
}

export async function quoteEnquiryFee(enquiryId: string, data: { proposedFeeRupees: number; terms?: string }): Promise<CourseEnquiry> {
  const res = await api.post<CourseEnquiry>(`/teachers/enquiries/${enquiryId}/quote`, data);
  return res.data;
}

export async function fetchSessionAttendance(sessionId: string): Promise<SessionAttendance> {
  const res = await api.get<SessionAttendance>(`/teachers/sessions/${sessionId}/attendance`);
  return res.data;
}

export async function markSessionAttendance(
  sessionId: string,
  data: { studentId: string; status: string; verificationMethod?: string }
): Promise<SessionAttendance> {
  const res = await api.post<SessionAttendance>(`/teachers/sessions/${sessionId}/attendance`, data);
  return res.data;
}

export async function fetchPracticalAssignments(): Promise<PracticalAssignment[]> {
  const res = await api.get<{ data: PracticalAssignment[] }>('/teachers/assignments');
  return res.data.data;
}

export async function gradeAssignment(
  assignmentId: string,
  data: { grade: string; feedback?: string; passed?: boolean }
): Promise<PracticalAssignment> {
  const res = await api.post<PracticalAssignment>(`/teachers/assignments/${assignmentId}/grade`, data);
  return res.data;
}

export async function verifyCertificate(certificateId: string): Promise<CertificateVerification> {
  const res = await api.get<CertificateVerification>(`/teachers/certificates/verify/${certificateId}`);
  return res.data;
}

export async function fetchInstructorEarnings(): Promise<InstructorEarnings> {
  const res = await api.get<InstructorEarnings>('/teachers/earnings');
  return res.data;
}

/**
 * Instructor earnings ledger (WS-02 task 2.19 contract) — integer paisa
 * everywhere. `onHold` mirrors the bank-verification rule used by the
 * settlement payout rails; `nextPayoutDate` is the next weekly run (ISO date).
 */
export interface InstructorEarningsLedger {
  grossPaisa: number;
  commissionPaisa: number;
  netPaisa: number;
  currency: string;
  commissionPct: number;
  byCourse: Array<{
    courseId: string;
    courseTitle: string;
    grossPaisa: number;
    commissionPaisa: number;
    netPaisa: number;
  }>;
  nextPayoutDate: string;
  onHold: boolean;
}

export async function fetchEarningsLedger(): Promise<InstructorEarningsLedger> {
  const res = await api.get<InstructorEarningsLedger>('/teachers/earnings');
  return res.data;
}

/** Edit an existing course (courses.py PUT /v1/courses/{id}). */
export async function updateCourse(
  courseId: string,
  data: {
    title?: string;
    subtitle?: string;
    description?: string;
    category?: string;
    priceRupees?: number;
    coinsDiscountAllowed?: number;
    status?: string;
  }
): Promise<AcademyCourse> {
  const res = await api.put<AcademyCourse>(`/courses/${courseId}`, data);
  return res.data;
}

/** Phase-00 KYC pipeline wrapper (routers/kyc.py). */
export interface KycDoc {
  docId: string;
  type: string;
  status: 'pending' | 'verified' | 'rejected';
  storagePath?: string | null;
  expiresAt?: string | null;
}

export interface KycCase {
  caseId: string;
  userId: string;
  persona: string;
  status: 'pending' | 'verified' | 'rejected';
  docs: KycDoc[];
}

export async function getMyKycCases(): Promise<KycCase[]> {
  const res = await api.get<{ data: KycCase[] }>('/kyc/status');
  return res.data.data;
}

export async function submitKycCase(
  persona: string,
  docs: Array<{ type: string; storagePath?: string; expiresAt?: string }>
): Promise<KycCase> {
  const res = await api.post<{ case: KycCase; requiredDocs: string[] }>('/kyc/cases', {
    persona,
    docs,
  });
  return res.data.case;
}

export async function uploadCredentialDoc(caseId: string, docId: string, file: File): Promise<KycCase> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<{ case: KycCase }>(`/kyc/cases/${caseId}/docs/${docId}/upload`, form);
  return res.data.case;
}
