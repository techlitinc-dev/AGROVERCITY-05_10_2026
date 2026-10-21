import React, { useEffect, useState } from 'react';
import {
  Newspaper,
  Tv,
  GraduationCap,
  Video,
  FileCheck2,
  Plus,
  Trash2,
  Edit,
  ExternalLink,
  Flame,
  Volume2,
  RefreshCw,
  Search,
  CheckCircle2,
  Users,
  Eye,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  AgriNewsItem,
  LiveChannel,
  WorkshopItem,
  VideoGuideItem,
  BlogArticleItem,
  GovSchemeItem,
} from '../types/entities';
import { AuditModal } from '../components/AuditModal';
import { EntityDrawer } from '../components/EntityDrawer';
import { useAuth } from '../context/AuthContext';

type SubTab = 'news' | 'channels' | 'workshops' | 'guides' | 'schemes';

export const FarmerPagesManagementView: React.FC = () => {
  const { hasPermission } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>('news');
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  // Data states
  const [newsList, setNewsList] = useState<AgriNewsItem[]>([]);
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopItem[]>([]);
  const [videos, setVideos] = useState<VideoGuideItem[]>([]);
  const [blogs, setBlogs] = useState<BlogArticleItem[]>([]);
  const [schemes, setSchemes] = useState<GovSchemeItem[]>([]);

  // Selected item for Raw Inspector Drawer
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [drawerTitle, setDrawerTitle] = useState<string>('');

  // Workshop roster modal
  const [activeRoster, setActiveRoster] = useState<{ workshopTitle: string; attendees: any[] } | null>(null);

  // News Modal (Create / Edit)
  const [newsModalOpen, setNewsModalOpen] = useState<boolean>(false);
  const [editingNews, setEditingNews] = useState<Partial<AgriNewsItem> | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formVernacularTitle, setFormVernacularTitle] = useState<string>('');
  const [formSummary, setFormSummary] = useState<string>('');
  const [formContent, setFormContent] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('market-policy');
  const [formIsBreaking, setFormIsBreaking] = useState<boolean>(false);
  const [formAudioText, setFormAudioText] = useState<string>('');
  const [formSource, setFormSource] = useState<string>('Ministry of Agriculture & Farmers Welfare');

  // Audit modal state
  const [auditAction, setAuditAction] = useState<{
    type: 'delete_news' | 'save_news' | 'moderate_channel';
    title: string;
    description: string;
    targetId: string;
    payload?: any;
  } | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [n, c, w, v, b, s] = await Promise.all([
        api.getNews(),
        api.getChannels(),
        api.getWorkshops(),
        api.getVideos(),
        api.getBlogs(),
        api.getSchemes(),
      ]);
      setNewsList(n);
      setChannels(c);
      setWorkshops(w);
      setVideos(v);
      setBlogs(b);
      setSchemes(s);
    } catch (err) {
      console.error('Error loading content data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openCreateNewsModal = () => {
    setEditingNews(null);
    setFormTitle('');
    setFormVernacularTitle('');
    setFormSummary('');
    setFormContent('');
    setFormCategory('market-policy');
    setFormIsBreaking(false);
    setFormAudioText('');
    setFormSource('Ministry of Agriculture & Farmers Welfare');
    setNewsModalOpen(true);
  };

  const openEditNewsModal = (item: AgriNewsItem) => {
    setEditingNews(item);
    setFormTitle(item.title || '');
    setFormVernacularTitle(item.vernacularTitle || '');
    setFormSummary(item.summary || '');
    setFormContent(item.content || item.body || '');
    setFormCategory(item.category || 'market-policy');
    setFormIsBreaking(Boolean(item.isBreaking));
    setFormAudioText(item.audioText || '');
    setFormSource(item.source || 'Ministry of Agriculture');
    setNewsModalOpen(true);
  };

  const handleSaveNewsPrompt = () => {
    if (!formTitle.trim()) {
      alert('Article title is mandatory.');
      return;
    }
    const payload: Partial<AgriNewsItem> = {
      title: formTitle,
      vernacularTitle: formVernacularTitle,
      summary: formSummary,
      content: formContent,
      category: formCategory,
      isBreaking: formIsBreaking,
      audioText: formAudioText,
      source: formSource,
      status: 'published',
    };

    setAuditAction({
      type: 'save_news',
      title: editingNews?.id ? 'Update Agri News Article' : 'Publish New Agri News Article',
      description: `Publish real-time news across mobile apps and farmer web pages.`,
      targetId: editingNews?.id || 'new',
      payload,
    });
  };

  const executeAuditAction = async (reason: string) => {
    if (!auditAction) return;

    if (auditAction.type === 'save_news') {
      if (auditAction.targetId === 'new') {
        await api.createNews(auditAction.payload, reason);
      } else {
        await api.updateNews(auditAction.targetId, auditAction.payload, reason);
      }
      setNewsModalOpen(false);
    } else if (auditAction.type === 'delete_news') {
      await api.deleteNews(auditAction.targetId, reason);
    } else if (auditAction.type === 'moderate_channel') {
      await api.moderateChannel(auditAction.targetId, auditAction.payload.action, reason);
    }

    setAuditAction(null);
    await loadAll();
  };

  const inspectRoster = async (workshop: WorkshopItem) => {
    try {
      const roster = await api.getWorkshopRoster(workshop.id);
      setActiveRoster({
        workshopTitle: workshop.title,
        attendees: roster,
      });
    } catch {
      setActiveRoster({
        workshopTitle: workshop.title,
        attendees: [],
      });
    }
  };

  const filteredNews = newsList.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.title?.toLowerCase().includes(q) ||
      item.vernacularTitle?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q) ||
      item.source?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Farmer CMS & Knowledge Engine
              </span>
              <span className="text-xs text-slate-400">Live Production Firestore Data</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
              Farmer Pages & Content Governance
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Publish and moderate agricultural news, live streaming channel broadcasts, Gurukul training workshops,
              video farming guides, agronomy blogs, and central/state government subsidy schemes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadAll}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
              Refresh
            </button>

            {subTab === 'news' && (
              <button
                onClick={openCreateNewsModal}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-900/40 transition"
              >
                <Plus className="w-4 h-4" />
                Publish News Article
              </button>
            )}
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex border-b border-slate-800 mt-6 -mb-2 overflow-x-auto">
          {[
            { id: 'news', label: 'Agri News CMS', count: newsList.length, icon: Newspaper },
            { id: 'channels', label: 'Live Video Channels', count: channels.length, icon: Tv },
            { id: 'workshops', label: 'Gurukul Workshops', count: workshops.length, icon: GraduationCap },
            { id: 'guides', label: 'Video Guides & Blogs', count: videos.length + blogs.length, icon: Video },
            { id: 'schemes', label: 'Government Schemes', count: schemes.length, icon: FileCheck2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as SubTab)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                  active
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                <span
                  className={`ml-1.5 px-2 py-0.5 text-[10px] rounded-full font-bold ${
                    active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 1. AGRI NEWS CMS TAB */}
      {/* --------------------------------------------------------------------- */}
      {subTab === 'news' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search headlines, vernacular, policy..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="text-xs text-slate-400">
              Showing <span className="text-white font-semibold">{filteredNews.length}</span> live news stories
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Article Headline & Vernacular</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Breaking / Impact</th>
                    <th className="py-3.5 px-4">Audio / Voiceover</th>
                    <th className="py-3.5 px-4">Source</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredNews.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        No news articles found matching filter.
                      </td>
                    </tr>
                  ) : (
                    filteredNews.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4 max-w-md">
                          <div className="font-semibold text-white line-clamp-1">{item.title}</div>
                          {item.vernacularTitle && (
                            <div className="text-[11px] text-amber-300 font-medium mt-0.5 line-clamp-1">
                              {item.vernacularTitle}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">
                            {item.summary || item.content}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            {item.category || 'general'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            {item.isBreaking ? (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                <Flame className="w-3 h-3 text-rose-500" />
                                BREAKING
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-medium">Standard</span>
                            )}
                            {item.impactRating && (
                              <span className="text-[10px] text-emerald-400 font-mono">
                                {item.impactRating}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 max-w-xs">
                          {item.audioText ? (
                            <div className="flex items-start gap-1.5 text-slate-400 text-[11px]">
                              <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{item.audioText}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600 italic">No audio copy</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                          <div className="text-slate-300 font-medium">{item.source || 'Official Bureau'}</div>
                          <div className="text-[10px] text-slate-500">{item.timestamp ? new Date(item.timestamp).toLocaleDateString() : 'Recent'}</div>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedEntity(item);
                                setDrawerTitle(`News Article [${item.id}]`);
                              }}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                              title="Inspect Raw JSON"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => openEditNewsModal(item)}
                              className="p-1.5 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 rounded-lg transition"
                              title="Edit Article"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                setAuditAction({
                                  type: 'delete_news',
                                  title: `Delete News Article: ${item.title}`,
                                  description: `Are you sure you want to permanently delete this news story?`,
                                  targetId: item.id,
                                });
                              }}
                              className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition"
                              title="Delete Article"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 2. LIVE VIDEO CHANNELS TAB */}
      {/* --------------------------------------------------------------------- */}
      {subTab === 'channels' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {channels.map((ch) => (
            <div
              key={ch.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                    LIVE STREAM
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">{ch.id}</span>
                </div>

                <h3 className="text-base font-bold text-white mt-3">
                  {ch.channelName || ch.name || ch.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {ch.currentProgram || '24/7 Krishi Darshan & Mandi Advisory'}
                </p>

                <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Viewers Count:</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      {(ch.viewersCount || 1240).toLocaleString()} Farmers
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Language:</span>
                    <span className="text-slate-200">{ch.language || 'Hindi / Marathi'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    setSelectedEntity(ch);
                    setDrawerTitle(`Live Channel [${ch.id}]`);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                >
                  Inspect Stream
                </button>

                <button
                  onClick={() => {
                    setAuditAction({
                      type: 'moderate_channel',
                      title: `Suspend Live Channel: ${ch.channelName || ch.id}`,
                      description: `Temporarily mute or suspend this broadcast feed across the farmer portal.`,
                      targetId: ch.id,
                      payload: { action: 'suspend' },
                    });
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition"
                >
                  Suspend Stream
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 3. GURUKUL WORKSHOPS TAB */}
      {/* --------------------------------------------------------------------- */}
      {subTab === 'workshops' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Workshop Title</th>
                    <th className="py-3.5 px-4">Instructor</th>
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4">Mode / Venue</th>
                    <th className="py-3.5 px-4">Fee (₹)</th>
                    <th className="py-3.5 px-4">Roster Capacity</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {workshops.map((ws) => (
                    <tr key={ws.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-semibold text-white max-w-sm">
                        <div>{ws.title}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{ws.id}</div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                        <div className="font-medium text-emerald-300">{ws.instructorName || 'Lead Agronomist'}</div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                        <div>{ws.date || 'Upcoming Batch'}</div>
                        <div className="text-[10px] text-slate-500">{ws.time || '10:00 AM - 1:00 PM'}</div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {ws.mode || 'Online Interactive'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                        {ws.feeRupees === 0 ? (
                          <span className="text-emerald-400">FREE</span>
                        ) : (
                          `₹${(ws.feeRupees || 499).toLocaleString()}`
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">
                            {ws.enrolledCount || 85} / {ws.maxSeats || 100}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-medium">85% Full</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => inspectRoster(ws)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition"
                          >
                            <Users className="w-3.5 h-3.5" />
                            View Enrolled Roster
                          </button>

                          <button
                            onClick={() => {
                              setSelectedEntity(ws);
                              setDrawerTitle(`Workshop [${ws.id}]`);
                            }}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 4. VIDEO GUIDES & BLOGS TAB */}
      {/* --------------------------------------------------------------------- */}
      {subTab === 'guides' && (
        <div className="space-y-6">
          {/* Video Guides Section */}
          <div>
            <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <Video className="w-4 h-4 text-emerald-400" />
              Agronomy Video Guides ({videos.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map((vid) => (
                <div
                  key={vid.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono text-emerald-400">{vid.category || 'Agronomy'}</span>
                      <span>{vid.duration || '12 mins'}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mt-2 line-clamp-2">{vid.title}</h3>
                    {vid.crop && (
                      <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                        Crop: {vid.crop}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono">
                      {(vid.views || 4320).toLocaleString()} Views
                    </span>
                    <button
                      onClick={() => {
                        setSelectedEntity(vid);
                        setDrawerTitle(`Video Guide [${vid.id}]`);
                      }}
                      className="text-xs text-emerald-400 hover:underline font-medium"
                    >
                      Inspect Video Doc
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Blogs Section */}
          <div className="pt-4 border-t border-slate-800">
            <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-amber-400" />
              Field Agronomy Blog Articles ({blogs.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {blogs.map((b) => (
                <div
                  key={b.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono text-amber-400">{b.category || 'Disease Control'}</span>
                      <span>{b.readTimeMinutes || 5} min read</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mt-2 line-clamp-2">{b.title}</h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{b.summary}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-400">By {b.author || 'Senior Agronomist'}</span>
                    <button
                      onClick={() => {
                        setSelectedEntity(b);
                        setDrawerTitle(`Blog Article [${b.id}]`);
                      }}
                      className="text-xs text-amber-400 hover:underline font-medium"
                    >
                      Inspect Article Doc
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 5. GOVERNMENT SCHEMES DIRECTORY TAB */}
      {/* --------------------------------------------------------------------- */}
      {subTab === 'schemes' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Scheme Name & ID</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Financial Benefit / Subsidy</th>
                    <th className="py-3.5 px-4">Required Documents Checklist</th>
                    <th className="py-3.5 px-4">Next Deadline</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {schemes.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-semibold text-white max-w-sm">
                        <div className="text-sm font-bold text-emerald-400">{s.name}</div>
                        <div className="text-[11px] text-slate-300 mt-0.5">{s.description}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">Scheme ID: {s.id}</div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                          {s.category}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-amber-300 whitespace-nowrap">
                        {s.benefitAmount || (s.subsidyPercent ? `${s.subsidyPercent}% Subsidy` : 'Direct DBT Support')}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {(s.documentsRequired || ['Aadhaar', '7/12 Land Record', 'Bank Passbook']).map((doc, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700/60"
                            >
                              {doc}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300 font-mono whitespace-nowrap">
                        {s.nextDeadline || '31-Dec-2026'}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedEntity(s);
                              setDrawerTitle(`Government Scheme [${s.id}]`);
                            }}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                            title="Inspect Scheme Doc"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {s.portalUrl && (
                            <a
                              href={s.portalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition"
                              title="Open Official Govt Portal"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* CREATE / EDIT NEWS MODAL */}
      {/* --------------------------------------------------------------------- */}
      {newsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {editingNews?.id ? 'Edit Agri News Story' : 'Publish New Agricultural News'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Broadcast verified news alerts directly to farmers via mobile app and web console.
                </p>
              </div>
              <button
                onClick={() => setNewsModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  English Headline <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Centre Hikes Minimum Export Price & Procurement Buffer"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Vernacular Headline (Marathi / Hindi)
                </label>
                <input
                  type="text"
                  value={formVernacularTitle}
                  onChange={(e) => setFormVernacularTitle(e.target.value)}
                  placeholder="e.g. केंद्र सरकारकडून नाफेड द्वारे 5 लाख टन कांदा खरेदीचे आदेश जारी"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="market-policy">Market & Govt Policy</option>
                    <option value="weather-alert">Weather & Calamity Alert</option>
                    <option value="subsidy-scheme">Subsidies & Grants</option>
                    <option value="crop-advisory">Crop Agronomy Advisory</option>
                    <option value="export-trade">Export & Global Trade</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Source / Bureau</label>
                  <input
                    type="text"
                    value={formSource}
                    onChange={(e) => setFormSource(e.target.value)}
                    placeholder="e.g. Ministry of Agriculture"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <input
                  type="checkbox"
                  id="breakingCheckbox"
                  checked={formIsBreaking}
                  onChange={(e) => setFormIsBreaking(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4 bg-slate-900"
                />
                <label htmlFor="breakingCheckbox" className="text-slate-200 font-medium cursor-pointer">
                  Tag as <span className="text-rose-400 font-bold">🔥 BREAKING NEWS</span> (instant push notification banner)
                </label>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Article Summary / Short Paragraph
                </label>
                <textarea
                  rows={2}
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  placeholder="Short briefing displayed on cards..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Full Article Body / Content
                </label>
                <textarea
                  rows={4}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Detailed news article body text..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  Vernacular Audio Voiceover Copy (For Text-To-Speech)
                </label>
                <textarea
                  rows={2}
                  value={formAudioText}
                  onChange={(e) => setFormAudioText(e.target.value)}
                  placeholder="मराठी किंवा हिंदी ऑडिओ मजकूर..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setNewsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewsPrompt}
                className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg transition"
              >
                Proceed with Audit Reason
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* WORKSHOP ROSTER MODAL */}
      {/* --------------------------------------------------------------------- */}
      {activeRoster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[80vh] overflow-y-auto shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Workshop Enrolled Farmers Roster</h3>
                <p className="text-xs text-emerald-400 mt-0.5">{activeRoster.workshopTitle}</p>
              </div>
              <button
                onClick={() => setActiveRoster(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {activeRoster.attendees.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No registered farmers yet. Capacity is open for enrollment.
                </div>
              ) : (
                activeRoster.attendees.map((att, i) => (
                  <div
                    key={i}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">{att.name || att.farmerName || 'Registered Farmer'}</div>
                      <div className="text-[10px] text-slate-400">{att.phone || att.village || 'Maharashtra'}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Confirmed
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 text-right">
              <button
                onClick={() => setActiveRoster(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Raw JSON Inspector Drawer */}
      <EntityDrawer
        isOpen={Boolean(selectedEntity)}
        onClose={() => setSelectedEntity(null)}
        title={drawerTitle}
        data={selectedEntity}
      />

      {/* Rule 8 Audit Reason Modal */}
      {auditAction && (
        <AuditModal
          isOpen={true}
          title={auditAction.title}
          description={auditAction.description}
          targetEntityId={auditAction.targetId}
          onConfirm={executeAuditAction}
          onCancel={() => setAuditAction(null)}
        />
      )}
    </div>
  );
};
