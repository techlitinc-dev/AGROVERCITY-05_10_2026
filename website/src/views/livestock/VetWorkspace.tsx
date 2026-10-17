import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Stethoscope, BadgeCheck, CalendarClock, IndianRupee, Star, ArrowRight, AlertCircle, CheckCircle2, Syringe, FileText } from 'lucide-react';
import { livestock, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import { asRec, boolOf, nameOf, numOf, recArr, strOf, todayStr } from './helpers';

const VET_LINKS = [
  { to: '/vet/schedule', label: 'Schedule Editor', desc: 'Weekly slots, leaves & tele-consults', icon: CalendarClock },
  { to: '/vet/appointments', label: 'Appointments', desc: 'Inbox, confirm & complete visits', icon: Stethoscope },
  { to: '/vet/campaigns', label: 'Vaccination Campaigns', desc: 'Drives, enrolment & coverage', icon: Syringe },
  { to: '/vet/earnings', label: 'Earnings & Payouts', desc: 'Fees, settlements & bank payouts', icon: IndianRupee },
  { to: '/vet/records', label: 'Medical Records', desc: 'Prescriptions & treatment history', icon: FileText },
];

export const VetWorkspace: React.FC = () => {
  const [workspace, setWorkspace] = useState<Record<string, unknown> | null>(null);
  const [unclaimed, setUnclaimed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setWorkspace(asRec(await livestock.vet.me()));
      setUnclaimed(false);
    } catch (e) {
      const msg = apiErrorMessage(e).toLowerCase();
      if (msg.includes('not found') || msg.includes('claim') || msg.includes('404')) {
        setUnclaimed(true);
      } else {
        setError(apiErrorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleClaim = async () => {
    setClaiming(true);
    setError(null);
    try {
      await livestock.vet.claim({});
      setNotice('Vet profile claimed! Your workspace is ready.');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return <p className="text-xs text-slate-400">Loading vet workspace…</p>;

  if (unclaimed) {
    return (
      <div className="space-y-6">
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Stethoscope className="w-7 h-7 text-emerald-600" />
            Vet Workspace
          </h1>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-10 text-center space-y-4 max-w-xl mx-auto">
          <Stethoscope className="w-12 h-12 text-slate-300 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Claim your vet profile</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            We match your account phone number against the registered veterinarian directory. Claiming
            gives you appointments, scheduling, campaigns, earnings and payouts.
          </p>
          {error && (
            <p className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
              {error}
            </p>
          )}
          {notice && (
            <p className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
              {notice}
            </p>
          )}
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            <BadgeCheck className="w-4 h-4" /> {claiming ? 'Claiming…' : 'Claim My Profile'}
          </button>
        </div>
      </div>
    );
  }

  const vet = asRec(workspace?.vet);
  const stats = asRec(workspace?.stats);
  const schedule = asRec(workspace?.schedule);
  const leaves = recArr(schedule.leaves).map((l) => strOf(l));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Stethoscope className="w-7 h-7 text-emerald-600" />
            Dr. {nameOf(vet, 'Veterinarian')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {strOf(vet.qualification)} {strOf(vet.specializations) ? `• ${strOf(vet.specializations)}` : ''} •{' '}
            {strOf(vet.clinicAddress) || 'Clinic address on record'}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {boolOf(vet.emergencyAvailable) && <StatusBadge status="emergency_available" />}
          {boolOf(vet.availableForFarmVisit) && <StatusBadge status="farm_visits" />}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Appointments"
          value={numOf(stats.totalAppointments)}
          icon={Stethoscope}
          colorScheme="blue"
        />
        <StatCard
          title="Month Earnings"
          value={formatCurrency(numOf(stats.monthEarnings))}
          subtitle="Completed consultations"
          icon={IndianRupee}
          colorScheme="green"
        />
        <StatCard
          title="Rating"
          value={numOf(stats.ratingAverage) > 0 ? numOf(stats.ratingAverage).toFixed(1) : '—'}
          subtitle={`${numOf(stats.ratingCount)} reviews`}
          icon={Star}
          colorScheme="amber"
        />
        <StatCard
          title="Leaves This Month"
          value={leaves.filter((l) => l.startsWith(todayStr().slice(0, 7))).length}
          subtitle={leaves.length ? `Next: ${leaves.sort()[0]}` : 'No upcoming leaves'}
          icon={CalendarClock}
          colorScheme="purple"
        />
      </div>

      <div>
        <h3 className="font-bold text-sm text-slate-900 mb-3">Vet Modules</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {VET_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 hover:shadow-md hover:border-emerald-200 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <l.icon className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
              </div>
              <h4 className="mt-3 font-bold text-sm text-slate-900">{l.label}</h4>
              <p className="text-xs text-slate-500 mt-0.5">{l.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VetWorkspace;
