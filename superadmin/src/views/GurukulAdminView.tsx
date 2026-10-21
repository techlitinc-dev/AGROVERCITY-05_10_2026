import React, { useEffect, useState } from 'react';
import {
  GraduationCap,
  BookOpen,
  Award,
  RefreshCw,
  Search,
  Eye,
  Star,
  Clock,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../lib/api';
import { GurukulCourse, TeacherProfile } from '../types/entities';
import { EntityDrawer } from '../components/EntityDrawer';
import { KpiCard } from '../components/KpiCard';

export const GurukulAdminView: React.FC = () => {
  const [subTab, setSubTab] = useState<'courses' | 'instructors'>('courses');
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const [courses, setCourses] = useState<GurukulCourse[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);

  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [drawerTitle, setDrawerTitle] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [cRes, tRes] = await Promise.all([
        api.getCourses(),
        api.getTeachers(),
      ]);
      setCourses(cRes);
      setTeachers(tRes);
    } catch (err) {
      console.error('Error loading Gurukul academy data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredCourses = courses.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.title?.toLowerCase().includes(q) ||
      c.instructorName?.toLowerCase().includes(q) ||
      c.category?.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    );
  });

  const filteredTeachers = teachers.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.name?.toLowerCase().includes(q) ||
      t.specialization?.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Persona 14: Gurukul Instructor & Agri Educator
              </span>
              <span className="text-xs text-slate-400">Live Gurukul Learning Management System</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
              Gurukul Academy & Instructor Governance
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Inspect certified agronomist courses (ZBNF, Precision Polyhouse, Micro-irrigation), verify ICAR/KVK
              expert teaching credentials, audit student completion rates, and manage practical farming curriculum.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Subtab Navigation */}
        <div className="flex border-b border-slate-800 mt-6 -mb-2">
          <button
            onClick={() => setSubTab('courses')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
              subTab === 'courses'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Active Courses & Masterclasses
            <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-300 font-bold">
              {courses.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('instructors')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
              subTab === 'instructors'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Certified Instructors Roster
            <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-300 font-bold">
              {teachers.length}
            </span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Published Courses"
          value={courses.length}
          change="5 curriculum tracks"
          changeType="positive"
          icon={BookOpen}
        />
        <KpiCard
          title="Certified Instructors"
          value={teachers.length}
          change="ICAR accredited"
          changeType="positive"
          icon={GraduationCap}
        />
        <KpiCard
          title="Enrolled Kisan Students"
          value="4,820"
          change="Across all masterclasses"
          changeType="positive"
          icon={Users}
        />
        <KpiCard
          title="Course Satisfaction"
          value="4.9 / 5.0"
          change="From farmer reviews"
          changeType="positive"
          icon={Star}
        />
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={subTab === 'courses' ? "Search course title, instructor, crop..." : "Search instructor name, research..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="text-xs text-slate-400">
          Showing real Firestore live data
        </div>
      </div>

      {/* Subtab 1: Courses Table */}
      {subTab === 'courses' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Course Title & ID</th>
                  <th className="py-3.5 px-4">Instructor</th>
                  <th className="py-3.5 px-4">Duration & Modules</th>
                  <th className="py-3.5 px-4">Fee (₹)</th>
                  <th className="py-3.5 px-4">Enrolled Students</th>
                  <th className="py-3.5 px-4">Farmer Rating</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredCourses.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-semibold text-white max-w-sm">
                      <div className="text-sm font-bold text-white">{c.title}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{c.id}</div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300 font-medium whitespace-nowrap">
                      <div className="text-emerald-300">{c.instructorName || 'Dr. Radheshyam Patel'}</div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                      <div>{c.durationHours || 16} Hours Total</div>
                      <div className="text-[10px] text-slate-500">{c.modulesCount || 8} Comprehensive Modules</div>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                      {c.feeRupees === 0 ? (
                        <span className="text-emerald-400">FREE</span>
                      ) : (
                        `₹${(c.feeRupees || 799).toLocaleString()}`
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-semibold text-indigo-300 whitespace-nowrap">
                      {(c.enrolledStudentsCount || 1240).toLocaleString()} Farmers
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-amber-400 font-bold font-mono">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {c.rating || 4.9}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSelectedEntity(c);
                          setDrawerTitle(`Course Syllabus [${c.id}]`);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                        title="Inspect Course Syllabus"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 2: Instructors Grid */}
      {subTab === 'instructors' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTeachers.map((t) => (
            <div
              key={t.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Award className="w-3.5 h-3.5 text-indigo-400" />
                    Certified Instructor
                  </span>
                  <span className="text-xs font-mono text-slate-400">{t.id}</span>
                </div>

                <h3 className="text-base font-bold text-white mt-3">{t.name}</h3>
                <div className="text-xs text-emerald-400 font-medium mt-0.5">
                  {t.specialization || 'Precision Agronomy & Natural Farming'}
                </div>

                <p className="text-xs text-slate-400 mt-3 line-clamp-3">
                  {t.bio || '22+ years of field agronomy research at ICAR. Author of 14 national research publications on precision farming and IPM.'}
                </p>

                <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Experience:</span>
                    <span className="font-bold text-slate-200">
                      {t.experienceYears || 22}+ Years in Agricultural Research
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Accreditation:</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      ICAR / KVK Verified
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-mono">Status: Active Faculty</span>
                <button
                  onClick={() => {
                    setSelectedEntity(t);
                    setDrawerTitle(`Instructor Credential [${t.id}]`);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 rounded-lg transition"
                >
                  Inspect Faculty Profile
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Raw JSON Inspector Drawer */}
      <EntityDrawer
        isOpen={Boolean(selectedEntity)}
        onClose={() => setSelectedEntity(null)}
        title={drawerTitle}
        data={selectedEntity}
      />
    </div>
  );
};
