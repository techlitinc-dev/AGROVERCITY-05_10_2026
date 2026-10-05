import { useCallback, useEffect, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { bookmarkBlog, likeBlog, listBlogs, type BlogItem } from '../../lib/api/gyan';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';
import RelatedCoursesBlock from './RelatedCoursesBlock';

/**
 * Blogs page (task 4.10) — list from `listBlogs()` with per-item bookmark and
 * like actions.
 */
export default function BlogsPage() {
  const t = useT();
  const [blogs, setBlogs] = useState<BlogItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    listBlogs()
      .then((res) => setBlogs(res.data))
      .catch(() => toast(t('gyanLoadFailed'), { error: true }))
      .finally(() => setLoaded(true));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleBookmark = async (blogId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await bookmarkBlog(blogId);
      setBlogs((prev) =>
        prev.map((blog) => (blog.id === blogId ? { ...blog, isBookmarked: res.isBookmarked } : blog)),
      );
    } catch (e) {
      toast(isApiError(e) ? e.message : t('gyanBookmarkFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const like = async (blogId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await likeBlog(blogId);
      setBlogs((prev) =>
        prev.map((blog) => (blog.id === blogId ? { ...blog, likesCount: res.likesCount } : blog)),
      );
    } catch (e) {
      toast(isApiError(e) ? e.message : t('gyanLikeFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="gyanHub">
      <section className="dash-section">
        <h3>{t('gyanBlogs')}</h3>
        {!loaded ? (
          <p className="dash-empty-line">…</p>
        ) : blogs.length === 0 ? (
          <p className="dash-empty-line">{t('gyanEmptyBlogs')}</p>
        ) : (
          blogs.map((blog) => (
            <div key={blog.id} style={{ padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ fontWeight: 600 }}>{blog.title}</div>
              <div style={{ color: '#6B7280', fontSize: 13 }}>
                {t('gyanAuthorBy', { name: blog.author })} · {blog.category} ·{' '}
                {t('gyanReadTime', { minutes: blog.readTimeMinutes })}
              </div>
              <p style={{ color: '#374151', marginTop: 4 }}>{blog.summary}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" disabled={busy} onClick={() => toggleBookmark(blog.id)}>
                  🔖 {blog.isBookmarked ? t('gyanBookmarked') : t('gyanBookmark')}
                </button>
                <button type="button" disabled={busy} onClick={() => like(blog.id)}>
                  👍 {t('gyanLike')} · {t('gyanLikesCountLabel', { count: blog.likesCount })}
                </button>
              </div>
              <RelatedCoursesBlock search={blog.category} />
            </div>
          ))
        )}
      </section>
    </ToolShell>
  );
}
