import React, { useEffect, useState } from 'react';
import {
  Radio,
  Newspaper,
  Play,
  BookOpen,
  Tv,
  Mic,
  Heart,
  Bookmark,
  CalendarClock,
  GraduationCap,
  MapPin,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { apiErrorMessage, content } from '../../lib/api';
import { cn, formatDateTime, formatNumber } from '../../lib/utils';
import { asRecords, pickNum, pickStr } from '../shared/records';

type Tab = 'news' | 'videos' | 'blogs' | 'channels' | 'talks' | 'workshops';

const TABS: { id: Tab; label: string }[] = [
  { id: 'news', label: 'Agri News' },
  { id: 'videos', label: 'Videos' },
  { id: 'blogs', label: 'Blogs' },
  { id: 'channels', label: 'Live Channels' },
  { id: 'talks', label: 'Expert Talks' },
  { id: 'workshops', label: 'Workshops' },
];

export const AgriNewsChannelsView: React.FC = () => {
  const [tab, setTab] = useState<Tab>('news');
  const [news, setNews] = useState<Record<string, unknown>[]>([]);
  const [videos, setVideos] = useState<Record<string, unknown>[]>([]);
  const [blogs, setBlogs] = useState<Record<string, unknown>[]>([]);
  const [channels, setChannels] = useState<Record<string, unknown>[]>([]);
  const [talks, setTalks] = useState<Record<string, unknown>[]>([]);
  const [workshops, setWorkshops] = useState<Record<string, unknown>[]>([]);
  const [schedule, setSchedule] = useState<Record<string, unknown>[]>([]);
  const [likedBlogs, setLikedBlogs] = useState<Set<string>>(new Set());
  const [savedBlogs, setSavedBlogs] = useState<Set<string>>(new Set());
  const [registeredTalks, setRegisteredTalks] = useState<Set<string>>(new Set());
  const [enrolledWorkshops, setEnrolledWorkshops] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [n, v, b, c, t, w, s] = await Promise.all([
          content.news().catch(() => []),
          content.videos().catch(() => []),
          content.blogs().catch(() => []),
          content.channels().catch(() => []),
          content.expertTalks().catch(() => []),
          content.workshops().catch(() => []),
          content.channelSchedule().catch(() => []),
        ]);
        if (!alive) return;
        setNews(asRecords(n));
        setVideos(asRecords(v));
        setBlogs(asRecords(b));
        setChannels(asRecords(c));
        setTalks(asRecords(t));
        setWorkshops(asRecords(w));
        setSchedule(asRecords(s));
      } catch {
        // reads — dev mock fallback or silent empty state
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 4000);
  };

  const handleLike = async (blogId: string) => {
    setBusyId(blogId);
    try {
      await content.likeBlog(blogId);
      setLikedBlogs((prev) => new Set(prev).add(blogId));
      flash('ok', 'Blog liked — the author and community thank you!');
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleBookmark = async (blogId: string) => {
    setBusyId(blogId);
    try {
      await content.bookmarkBlog(blogId);
      setSavedBlogs((prev) => new Set(prev).add(blogId));
      flash('ok', 'Saved to your bookmarks.');
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleRegisterTalk = async (talkId: string) => {
    setBusyId(talkId);
    try {
      await content.registerTalk(talkId);
      setRegisteredTalks((prev) => new Set(prev).add(talkId));
      flash('ok', 'Registered for the expert talk — a reminder is sent before it goes live.');
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleEnrollWorkshop = async (workshopId: string, title: string) => {
    setBusyId(workshopId);
    try {
      await content.enrollWorkshop(workshopId);
      setEnrolledWorkshops((prev) => new Set(prev).add(workshopId));
      flash('ok', `Enrolled in "${title}". Joining details are sent to your registered number.`);
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleRemind = async (bcastId: string) => {
    setBusyId(bcastId);
    try {
      await content.remindBroadcast(bcastId);
      flash('ok', 'Reminder set for this broadcast.');
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Radio className="w-7 h-7 text-indigo-600" />
          Agri News, Gyan Hub & Live Audio Bulletins
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Daily verified agricultural updates, mandi policy shifts, and regional vernacular radio broadcasts
        </p>
      </div>

      {notice && (
        <div
          className={cn(
            'rounded-2xl border p-3 text-xs flex items-start gap-2',
            notice.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          )}
        >
          {notice.kind === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'whitespace-nowrap px-4 py-2 rounded-2xl text-xs font-bold border transition-colors',
              tab === t.id
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* NEWS */}
      {tab === 'news' && (
        <div className="space-y-4">
          {news.length === 0 && (
            <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center">
              No news articles available right now.
            </p>
          )}
          {news.map((item, i) => (
            <div
              key={pickStr(item, 'id') || i}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-2 hover:border-slate-300 transition-colors"
            >
              <div className="flex justify-between items-center text-xs">
                <span className="text-[10px] font-bold uppercase text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                  {pickStr(item, 'category', 'tag') || 'Agri Update'}
                </span>
                <span className="text-slate-400">
                  {formatDateTime(pickStr(item, 'publishedAt', 'createdAt', 'time')) || 'Recently'}
                </span>
              </div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug">
                {pickStr(item, 'title', 'headline') || 'Untitled'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {pickStr(item, 'summary', 'body', 'description')}
              </p>
              <p className="text-xs text-slate-500">Source: {pickStr(item, 'source', 'author') || 'Agrovercity Desk'}</p>
            </div>
          ))}
        </div>
      )}

      {/* VIDEOS */}
      {tab === 'videos' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.length === 0 && (
            <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center sm:col-span-2 lg:col-span-3">
              No videos published yet.
            </p>
          )}
          {videos.map((v, i) => (
            <div
              key={pickStr(v, 'id') || i}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col"
            >
              <div className="relative h-36 bg-slate-900">
                {pickStr(v, 'thumbnailUrl', 'thumbnail', 'poster') ? (
                  <img
                    src={pickStr(v, 'thumbnailUrl', 'thumbnail', 'poster')}
                    alt={pickStr(v, 'title')}
                    className="w-full h-full object-cover opacity-80"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <Play className="w-8 h-8" />
                  </div>
                )}
                <span className="absolute bottom-2 right-2 text-[10px] font-bold bg-black/70 text-white px-2 py-0.5 rounded-full">
                  {pickStr(v, 'duration', 'length') || 'video'}
                </span>
              </div>
              <div className="p-4 space-y-1">
                <h4 className="font-bold text-xs text-slate-900 leading-snug">
                  {pickStr(v, 'title') || 'Untitled video'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {pickStr(v, 'channel', 'source') || 'Agrovercity TV'} · {pickStr(v, 'views', 'viewCount') || 0} views
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BLOGS */}
      {tab === 'blogs' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {blogs.length === 0 && (
            <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center sm:col-span-2">
              No blog posts yet.
            </p>
          )}
          {blogs.map((b, i) => {
            const id = pickStr(b, 'id') || String(i);
            const liked = likedBlogs.has(id);
            const saved = savedBlogs.has(id);
            return (
              <div key={id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold uppercase text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {pickStr(b, 'category', 'tag') || 'Blog'}
                  </span>
                  <span className="text-slate-400">
                    {pickStr(b, 'author', 'authorName') || 'Community'} ·{' '}
                    {formatDateTime(pickStr(b, 'publishedAt', 'createdAt')) || '—'}
                  </span>
                </div>
                <h4 className="font-extrabold text-sm text-slate-900 leading-snug">
                  {pickStr(b, 'title') || 'Untitled post'}
                </h4>
                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                  {pickStr(b, 'excerpt', 'summary', 'body')}
                </p>
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => void handleLike(id)}
                    disabled={busyId === id || liked}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 transition-colors',
                      liked
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-rose-300'
                    )}
                  >
                    <Heart className={cn('w-3.5 h-3.5', liked && 'fill-current')} />
                    {liked ? 'Liked' : 'Like'} ({pickStr(b, 'likes', 'likeCount') || (liked ? 1 : 0)})
                  </button>
                  <button
                    onClick={() => void handleBookmark(id)}
                    disabled={busyId === id || saved}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 transition-colors',
                      saved
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                    )}
                  >
                    <Bookmark className={cn('w-3.5 h-3.5', saved && 'fill-current')} />
                    {saved ? 'Saved' : 'Bookmark'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CHANNELS */}
      {tab === 'channels' && (
        <div className="space-y-4">
          <div className="p-6 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl text-white shadow-md flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                <Tv className="w-6 h-6 text-indigo-300 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                  Live Mandi Radio & TV Bulletin (मराठी / हिन्दी)
                </span>
                <h4 className="font-extrabold text-sm sm:text-base mt-0.5">
                  {pickStr(schedule[0], 'title', 'program') || "Today's Scheduled Broadcasts"}
                </h4>
              </div>
            </div>
          </div>

          {channels.length === 0 && (
            <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center">
              No channels are live right now.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {channels.map((c, i) => (
              <div key={pickStr(c, 'id') || i} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-slate-900">
                    {pickStr(c, 'name', 'title') || 'Channel'}
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 capitalize">
                    {pickStr(c, 'status') || 'live'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {pickStr(c, 'description', 'tagline') || 'Vernacular agri broadcast'} ·{' '}
                  {pickStr(c, 'language', 'languages') || 'hi'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {pickStr(c, 'listeners', 'subscribers', 'followers') || 0} followers
                </p>
              </div>
            ))}
          </div>

          {schedule.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4 text-slate-400" /> Upcoming Broadcasts
              </h3>
              {schedule.slice(0, 6).map((s, i) => {
                const id = pickStr(s, 'id', 'bcastId') || String(i);
                return (
                  <div
                    key={id}
                    className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{pickStr(s, 'title', 'program') || 'Broadcast'}</p>
                      <p className="text-[11px] text-slate-400">
                        {formatDateTime(pickStr(s, 'startsAt', 'startTime', 'scheduledAt')) || 'Schedule TBA'}
                      </p>
                    </div>
                    <button
                      onClick={() => void handleRemind(id)}
                      disabled={busyId === id}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold rounded-xl transition-colors disabled:opacity-40"
                    >
                      Remind Me
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* EXPERT TALKS */}
      {tab === 'talks' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {talks.length === 0 && (
            <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center sm:col-span-2">
              No expert talks scheduled — check back soon.
            </p>
          )}
          {talks.map((t, i) => {
            const id = pickStr(t, 'id') || String(i);
            const registered = registeredTalks.has(id);
            return (
              <div key={id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-[11px]">
                  <Mic className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold uppercase text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                    {pickStr(t, 'topic', 'category') || 'Expert Talk'}
                  </span>
                </div>
                <h4 className="font-extrabold text-sm text-slate-900 leading-snug">
                  {pickStr(t, 'title') || 'Expert session'}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {pickStr(t, 'speaker', 'expertName') || 'Agrovercity Expert Panel'} ·{' '}
                  {formatDateTime(pickStr(t, 'startsAt', 'scheduledAt', 'date')) || 'Schedule TBA'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {pickStr(t, 'registrations', 'registeredCount') || 0} farmers registered
                </p>
                <button
                  onClick={() => void handleRegisterTalk(id)}
                  disabled={busyId === id || registered}
                  className={cn(
                    'w-full px-4 py-2 rounded-xl font-bold text-xs transition-colors disabled:opacity-50',
                    registered
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                  )}
                >
                  {registered ? '✓ Registered' : 'Register Free'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* WORKSHOPS */}
      {tab === 'workshops' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {workshops.length === 0 && (
            <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center sm:col-span-2">
              No workshops scheduled in your district yet — new batches open every month.
            </p>
          )}
          {workshops.map((w, i) => {
            const id = pickStr(w, 'id') || String(i);
            const enrolled = enrolledWorkshops.has(id);
            const seatsLeft =
              pickNum(w, 'capacity', 'seatsTotal') - pickNum(w, 'enrolled', 'seatsFilled');
            return (
              <div key={id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-[11px]">
                  <GraduationCap className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold uppercase text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {pickStr(w, 'category', 'topic') || 'Hands-on Workshop'}
                  </span>
                </div>
                <h4 className="font-extrabold text-sm text-slate-900 leading-snug">
                  {pickStr(w, 'title') || 'Workshop'}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {pickStr(w, 'trainer', 'instructor', 'organization') || 'Agrovercity Gurukul'} ·{' '}
                  {formatDateTime(pickStr(w, 'startsAt', 'scheduledAt', 'date')) || 'Schedule TBA'}
                </p>
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {pickStr(w, 'location', 'venue', 'address') || 'Village cluster centre'}
                  {pickNum(w, 'feeRupees', 'fee') > 0 ? ` · ₹${pickNum(w, 'feeRupees', 'fee')} fee` : ' · Free'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {pickNum(w, 'enrolled', 'seatsFilled') || 0} enrolled
                  {pickNum(w, 'capacity', 'seatsTotal') > 0 && seatsLeft > 0
                    ? ` · ${formatNumber(seatsLeft)} seats left`
                    : ''}
                </p>
                <button
                  onClick={() => void handleEnrollWorkshop(id, pickStr(w, 'title') || 'workshop')}
                  disabled={busyId === id || enrolled}
                  className={cn(
                    'w-full px-4 py-2 rounded-xl font-bold text-xs transition-colors disabled:opacity-50',
                    enrolled
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  )}
                >
                  {enrolled ? '✓ Enrolled' : 'Enroll Free'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Static footer strip for the original "bulletin" feel */}
      <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl flex items-center gap-2 text-[11px] text-indigo-800">
        <Newspaper className="w-4 h-4 flex-shrink-0" />
        <span>
          All news and videos are sourced from verified Krishi Mantralaya, IMD, and Agrovercity Market Intelligence desks.
        </span>
      </div>
    </div>
  );
};
