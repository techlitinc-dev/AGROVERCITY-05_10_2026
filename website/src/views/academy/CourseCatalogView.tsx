import React, { useState } from 'react';
import { GraduationCap, Play, Star, Clock, BookOpen, Award, CheckCircle2 } from 'lucide-react';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency } from '../../lib/utils';
import type { CourseItem } from '../../types';

export const CourseCatalogView: React.FC = () => {
  const [courses, setCourses] = useState<CourseItem[]>([
    {
      id: 'crs_1',
      title: 'Advanced Soybean Farming: High Yield & Pest Control',
      instructorName: 'Dr. V. N. Patil (Agronomist)',
      category: 'Modern Farming',
      durationHours: 4.5,
      lessonsCount: 12,
      enrolledStudents: 1420,
      rating: 4.9,
      price: 0,
      isFree: true,
      thumbnailUrl: 'https://images.unsplash.com/photo-1595855759920-86582396756a?auto=format&fit=crop&w=400&q=80',
      description: 'Complete masterclass on seed selection, basal fertilizer application, pod borer management, and moisture harvesting.',
    },
    {
      id: 'crs_2',
      title: 'Commercial Dairy Management: FAT/SNF Optimization',
      instructorName: 'Er. Sandeep Deshmukh (Dairy Specialist)',
      category: 'Dairy Tech',
      durationHours: 6.0,
      lessonsCount: 18,
      enrolledStudents: 890,
      rating: 4.8,
      price: 499,
      isFree: false,
      thumbnailUrl: 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&w=400&q=80',
      description: 'Scientific fodder ratios, silage preparation, animal genetics, and maximizing daily milk profits.',
    },
    {
      id: 'crs_3',
      title: 'Drip Irrigation & Fertigation Automation',
      instructorName: 'Prof. Anjali Kulkarni (Water Scientist)',
      category: 'Modern Farming',
      durationHours: 3.5,
      lessonsCount: 8,
      enrolledStudents: 1100,
      rating: 4.7,
      price: 0,
      isFree: true,
      thumbnailUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=400&q=80',
      description: 'Designing venturi injectors, pressure compensating drippers, and seasonal fertilizer injection schedules.',
    },
  ]);

  const [activeCourse, setActiveCourse] = useState<CourseItem | null>(null);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <GraduationCap className="w-7 h-7 text-emerald-600" />
          Krishi Gurukul Academy (Skill Passport)
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Practical farming masterclasses led by university agronomists and progressive farmers. Earn digital certificates.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {courses.map((c) => (
          <div
            key={c.id}
            className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="relative h-44 w-full bg-slate-900">
                <img src={c.thumbnailUrl} alt={c.title} className="w-full h-full object-cover opacity-80" />
                <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[10px] font-bold">
                  {c.category}
                </div>
                <button
                  onClick={() => setActiveCourse(c)}
                  className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-emerald-600/90 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                >
                  <Play className="w-5 h-5 ml-0.5 fill-current" />
                </button>
              </div>

              <div className="p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1 font-semibold text-amber-600">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> {c.rating}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> {c.durationHours} Hours
                  </span>
                </div>

                <h3 className="font-extrabold text-sm text-slate-900 leading-snug">{c.title}</h3>
                <p className="text-xs text-slate-400">By {c.instructorName}</p>
                <p className="text-xs text-slate-600 line-clamp-2 mt-2 leading-relaxed">{c.description}</p>
              </div>
            </div>

            <div className="p-5 pt-0 border-t border-slate-100 mt-4 flex items-center justify-between">
              <span className="text-sm font-black text-emerald-800">
                {c.isFree ? 'Free Course' : formatCurrency(c.price)}
              </span>
              <button
                onClick={() => setActiveCourse(c)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
              >
                Start Learning
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Video Lesson Player Modal */}
      <ModalSheet
        isOpen={Boolean(activeCourse)}
        onClose={() => setActiveCourse(null)}
        title={activeCourse?.title}
        description={`Instructor: ${activeCourse?.instructorName}`}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="w-full h-72 rounded-2xl bg-slate-950 flex flex-col items-center justify-center text-white relative overflow-hidden shadow-inner">
            <Play className="w-16 h-16 text-emerald-400 fill-emerald-400/20 animate-pulse" />
            <p className="text-xs text-slate-400 mt-3">Interactive Video Lesson Streaming (HLS / MP4)</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl space-y-2 text-xs">
            <h5 className="font-bold text-slate-900">Module 1: Soil Prep & Certified Seed Inoculation</h5>
            <p className="text-slate-600 leading-relaxed">
              In this lesson, Dr. Patil walks through the practical field demonstration of mixing Rhizobium biofertilizer with gum arabic solution for soybean seeds to increase nodulation by 35%.
            </p>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
              <Award className="w-4 h-4" /> Certificate awarded on completion
            </span>
            <button
              onClick={() => setActiveCourse(null)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl"
            >
              Mark Completed
            </button>
          </div>
        </div>
      </ModalSheet>
    </div>
  );
};
