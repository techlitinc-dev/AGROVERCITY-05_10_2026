import { post, put, readList, readOne } from './http';

/** DEV-only fallback for the public instructor directory (used by http read helpers only in DEV). */
const MOCK_TEACHERS: Record<string, unknown>[] = [
  {
    id: 'usr_teacher_demo1',
    userId: 'usr_teacher_demo1',
    name: 'Dr. Sunita Deshmukh',
    headline: 'Soil scientist & organic farming specialist',
    qualification: 'Ph.D. Agronomy',
    institution: 'MPKV Rahuri',
    expertise: ['Soil Health', 'Organic Farming', 'Composting'],
    experienceYears: 14,
    avatarUrl: '',
    isVerified: true,
  },
  {
    id: 'usr_teacher_demo2',
    userId: 'usr_teacher_demo2',
    name: 'Shri Vilas Jadhav',
    headline: 'Drip irrigation & water budgeting expert',
    qualification: 'M.Sc. Horticulture',
    institution: 'Jain Irrigation Academy',
    expertise: ['Drip Irrigation', 'Water Management'],
    experienceYears: 9,
    avatarUrl: '',
    isVerified: true,
  },
];

/** Teachers (Gurukul instructor) namespace — profile, courses, batches, students, earnings. */
export const teachers = {
  // --- profile ---
  /** GET /teachers/me */
  me: (): Promise<unknown> => readOne<unknown>('/teachers/me'),

  /** PUT /teachers/me */
  updateMe: (updates: Record<string, unknown>): Promise<unknown> => put<unknown>('/teachers/me', updates),

  /** POST /teachers/me/credentials */
  addCredential: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/teachers/me/credentials', payload),

  /** PUT /teachers/availability */
  setAvailability: (payload: Record<string, unknown>): Promise<unknown> =>
    put<unknown>('/teachers/availability', payload),

  /** GET /teachers/home */
  home: (): Promise<unknown> => readOne<unknown>('/teachers/home'),

  // --- directory ---
  /** GET /teachers — public instructor directory (teacher_profiles docs). */
  list: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<Record<string, unknown>>('/teachers', { params, mock: MOCK_TEACHERS }),

  /** GET /teachers */
  directory: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/teachers', { params }),

  /** GET /teachers/{id} */
  teacher: (teacherId: string): Promise<unknown> => readOne<unknown>(`/teachers/${teacherId}`),

  /** GET /teachers/{id}/card */
  card: (teacherId: string): Promise<unknown> => readOne<unknown>(`/teachers/${teacherId}/card`),

  // --- courses ---
  /** GET /teachers/courses/mine */
  myCourses: (): Promise<unknown[]> => readList<unknown[]>('/teachers/courses/mine'),

  /** POST /teachers/courses/create */
  createCourse: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/teachers/courses/create', payload),

  /** GET /teachers/courses/{id}/students */
  students: (courseId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/teachers/courses/${courseId}/students`),

  /** GET /teachers/students */
  allStudents: (): Promise<unknown[]> => readList<unknown[]>('/teachers/students'),

  /** GET /teachers/students/{id} */
  student: (studentId: string): Promise<unknown> => readOne<unknown>(`/teachers/students/${studentId}`),

  /** POST /teachers/courses/{id}/students/{studentId}/certificate */
  issueCertificate: (courseId: string, studentId: string): Promise<unknown> =>
    post<unknown>(`/teachers/courses/${courseId}/students/${studentId}/certificate`),

  /** POST /teachers/courses/{id}/announcements */
  announce: (courseId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/teachers/courses/${courseId}/announcements`, payload),

  /** GET /teachers/courses/{id}/announcements */
  announcements: (courseId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/teachers/courses/${courseId}/announcements`),

  // --- batches & sessions ---
  /** GET /teachers/batches */
  batches: (): Promise<unknown[]> => readList<unknown[]>('/teachers/batches'),

  /** POST /teachers/batches */
  createBatch: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/teachers/batches', payload),

  /** POST /teachers/batches/{id}/sessions */
  addSession: (batchId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/teachers/batches/${batchId}/sessions`, payload),

  /** GET /teachers/sessions/{id}/attendance */
  attendance: (sessionId: string): Promise<unknown> =>
    readOne<unknown>(`/teachers/sessions/${sessionId}/attendance`),

  /** POST /teachers/sessions/{id}/attendance */
  markAttendance: (sessionId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/teachers/sessions/${sessionId}/attendance`, payload),

  // --- enquiries ---
  /** GET /teachers/enquiries */
  enquiries: (): Promise<unknown[]> => readList<unknown[]>('/teachers/enquiries'),

  /** POST /teachers/enquiries/{id}/quote */
  quoteEnquiry: (enquiryId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/teachers/enquiries/${enquiryId}/quote`, payload),

  /** POST /teachers/enquiries/{id}/counter */
  counterEnquiry: (enquiryId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/teachers/enquiries/${enquiryId}/counter`, payload),

  /** POST /teachers/enquiries/{id}/accept */
  acceptEnquiry: (enquiryId: string): Promise<unknown> =>
    post<unknown>(`/teachers/enquiries/${enquiryId}/accept`),

  // --- assignments ---
  /** GET /teachers/assignments */
  assignments: (): Promise<unknown[]> => readList<unknown[]>('/teachers/assignments'),

  /** POST /teachers/assignments/{id}/grade */
  gradeAssignment: (assignmentId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/teachers/assignments/${assignmentId}/grade`, payload),

  // --- certificates ---
  /** GET /teachers/certificates/verify/{certificateId} */
  verifyCertificate: (certificateId: string): Promise<unknown> =>
    readOne<unknown>(`/teachers/certificates/verify/${certificateId}`),

  /** GET /teachers/certificates/{id}/download */
  downloadCertificate: (certificateId: string): Promise<unknown> =>
    readOne<unknown>(`/teachers/certificates/${certificateId}/download`),

  /** POST /teachers/certificates/{id}/revoke */
  revokeCertificate: (certificateId: string, reason: string): Promise<unknown> =>
    post<unknown>(`/teachers/certificates/${certificateId}/revoke`, { reason }),

  // --- chat ---
  /** POST /teachers/chat/open */
  openChat: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/teachers/chat/open', payload),

  /** GET /teachers/chat/rooms */
  chatRooms: (): Promise<unknown[]> => readList<unknown[]>('/teachers/chat/rooms'),

  // --- money & feedback ---
  /** GET /teachers/earnings */
  earnings: (): Promise<unknown> => readOne<unknown>('/teachers/earnings'),

  /** GET /teachers/payments/history */
  paymentHistory: (): Promise<unknown[]> => readList<unknown[]>('/teachers/payments/history'),

  /** GET /teachers/commission-structure */
  commissionStructure: (): Promise<unknown> => readOne<unknown>('/teachers/commission-structure'),

  /** GET /instructor/settlements */
  settlements: (): Promise<unknown[]> => readList<unknown[]>('/instructor/settlements'),

  /** GET /teachers/analytics */
  analytics: (): Promise<unknown> => readOne<unknown>('/teachers/analytics'),

  /** GET /teachers/feedback */
  feedback: (): Promise<unknown[]> => readList<unknown[]>('/teachers/feedback'),
};
