// AnnouncementsFeed.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { T, C } from '../design/DesignTokens';
import {
  MessageSquare, Heart, Pin, Trash2, Send, FileText, Edit,
  AlertCircle, Upload, X, ChevronLeft, ChevronRight, Filter, Star
} from 'lucide-react';
import { announcementAPI, organizationAPI } from '../lib/api';

interface Announcement {
  id: number; user_id: string; author_email: string; author_role: string;
  author_first_name?: string | null; author_last_name?: string | null;
  title: string; content: string; image_url?: string; image_urls?: string[] | string;
  is_pinned: boolean; likes_count: number; comments_count: number;
  author_group_id?: number | null; author_group_name?: string | null; author_is_head?: boolean;
  target_group_id?: number | null; target_group_name?: string | null; target_heads_only?: boolean;
  created_at: string; updated_at: string;
}
interface Comment {
  id: number; announcement_id: number; user_id: string; author_email?: string; user_email?: string;
  user_first_name?: string | null; user_last_name?: string | null;
  content: string; created_at: string;
}
interface Group { id: number; name: string; }
interface AnnouncementsFeedProps { userRole: 'admin' | 'coordinator' | 'member'; userId: string; }

function MultiImageUploader({ images, onChange, max = 5 }: { images: string[]; onChange: (imgs: string[]) => void; max?: number }) {
  const [dragOver, setDragOver] = useState(false);

  const compress = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = ev => {
        const img = new window.Image();
        img.onerror = reject;
        img.onload = () => {
          const MAX = 800; let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
            else { width = Math.round(width * MAX / height); height = MAX; }
          }
          const c = document.createElement('canvas');
          c.width = width; c.height = height;
          c.getContext('2d')!.drawImage(img, 0, 0, width, height);
          resolve(c.toDataURL('image/jpeg', 0.55));
        };
        img.src = ev.target!.result as string;
      };
      reader.readAsDataURL(file);
    });

  const process = (files: FileList | null) => {
    if (!files) return;
    const todo = Array.from(files).filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024).slice(0, max - images.length);
    if (!todo.length) return;
    Promise.all(todo.map(compress)).then(c => onChange([...images, ...c])).catch(console.error);
  };

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {images.map((src, i) => (
            <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition">
                <X className="w-3 h-3" />
              </button>
              {i === 0 && <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-sm">Cover</span>}
            </div>
          ))}
        </div>
      )}
      {images.length < max && (
        <label
          className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer transition ${dragOver ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400 hover:bg-green-50'}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); process(e.dataTransfer.files); }}>
          <div className="flex flex-col items-center gap-1.5 text-gray-500 pointer-events-none">
            <Upload className="w-6 h-6" />
            <span className="text-sm font-medium">{images.length === 0 ? 'Upload photos' : 'Add more'}</span>
            <span className="text-xs text-gray-400">{images.length}/{max} · up to 10MB each</span>
          </div>
          <input type="file" accept="image/*" multiple className="hidden" onChange={e => { process(e.target.files); e.target.value = ''; }} />
        </label>
      )}
      {images.length >= max && <p className="text-center text-gray-400 text-xs">Maximum {max} photos reached</p>}
    </div>
  );
}

function SlideshowModal({ images, initialIndex = 0, title, onClose }: { images: string[]; initialIndex?: number; title?: string; onClose: () => void }) {
  const [cur, setCur] = useState(initialIndex);
  const prev = useCallback(() => setCur(c => (c - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setCur(c => (c + 1) % images.length), [images.length]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [prev, next, onClose]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <button onClick={onClose} className="fixed top-4 right-4 z-[70] bg-white/20 hover:bg-white/40 text-white p-3 rounded-2xl border border-white/30 backdrop-blur-sm">
        <X className="w-5 h-5" />
      </button>
      <div className="flex items-center justify-between px-4 pr-20 py-4 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {title && <span className="text-white truncate" style={T.sectionHeader}>{title}</span>}
        </div>
        <span className="text-white/60 tabular-nums flex-shrink-0" style={T.body}>{cur + 1} / {images.length}</span>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 min-h-0 relative">
        {images.length > 1 && <button onClick={prev} className="absolute left-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white backdrop-blur-sm"><ChevronLeft className="w-6 h-6" /></button>}
        <img key={cur} src={images[cur]} alt={`Photo ${cur + 1}`} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" style={{ maxHeight: 'calc(100vh - 220px)' }} />
        {images.length > 1 && <button onClick={next} className="absolute right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white backdrop-blur-sm"><ChevronRight className="w-6 h-6" /></button>}
      </div>
      {images.length > 1 && (
        <div className="flex-shrink-0 py-4 px-6 flex items-center justify-center gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button key={i} onClick={() => setCur(i)}
              className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition ${i === cur ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-80'}`}>
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function parseImageUrls(raw: string[] | string | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') { try { const p = JSON.parse(raw); return Array.isArray(p) ? p.filter(Boolean) : []; } catch { return []; } }
  return [];
}

function getImages(post: Announcement): string[] {
  const arr = parseImageUrls(post.image_urls);
  if (arr.length > 0) return arr;
  if (post.image_url) {
    const f = parseImageUrls(post.image_url);
    if (f.length > 0) return f;
    if (post.image_url.startsWith('data:') || post.image_url.startsWith('http')) return [post.image_url];
  }
  return [];
}

function fullName(first?: string | null, last?: string | null, fallback?: string): string {
  const v = `${first || ''} ${last || ''}`.trim();
  return v || fallback || 'Unknown';
}

export default function AnnouncementsFeed({ userRole, userId }: AnnouncementsFeedProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [authError,      setAuthError]      = useState(false);
  const [showCreate,     setShowCreate]     = useState(false);
  const [postError,      setPostError]      = useState('');
  const [newPost,        setNewPost]        = useState({ title: '', content: '', target_group_id: '' as number | '', target_heads_only: false });
  const [newImages,      setNewImages]      = useState<string[]>([]);
  const [comments,       setComments]       = useState<Record<number, Comment[]>>({});
  const [newComment,     setNewComment]     = useState<Record<number, string>>({});
  const [showComments,   setShowComments]   = useState<Record<number, boolean>>({});
  const [slideshow,      setSlideshow]      = useState<{ images: string[]; index: number; title: string } | null>(null);
  const [editingId,      setEditingId]      = useState<number | null>(null);
  const [editPost,       setEditPost]       = useState({ title: '', content: '', target_group_id: '' as number | '', target_heads_only: false });
  const [editImages,     setEditImages]     = useState<string[]>([]);
  const [newNotice,      setNewNotice]      = useState<{ count: number; latestTitle: string } | null>(null);
  const [groups,         setGroups]         = useState<Group[]>([]);
  const [filterGroup,    setFilterGroup]    = useState<number | 'heads' | ''>('');
  const knownIds = useRef<Set<number>>(new Set());

  useEffect(() => { loadAnnouncements(); loadGroups(); }, []);
  useEffect(() => {
    const t = window.setInterval(() => loadAnnouncements(true), 30000);
    return () => window.clearInterval(t);
  }, []);

  const loadGroups = async () => {
    try { const d = await organizationAPI.listGroups(); setGroups(Array.isArray(d) ? d : []); } catch {}
  };

  const loadAnnouncements = async (withNotice = false) => {
    try {
      setAuthError(false);
      const data = await announcementAPI.getAll();
      const list: Announcement[] = Array.isArray(data) ? data : [];
      const ids = new Set<number>(list.map(a => a.id));
      if (withNotice && knownIds.current.size > 0) {
        const fresh = list.filter(a => !knownIds.current.has(a.id) && a.user_id !== userId);
        if (fresh.length > 0) setNewNotice({ count: fresh.length, latestTitle: fresh[0].title });
      }
      knownIds.current = ids;
      setAnnouncements(list);
    } catch (e: any) {
      if (e.message?.includes('401')) setAuthError(true);
      setAnnouncements([]);
    } finally { setLoading(false); }
  };

  const createAnnouncement = async () => {
    setPostError('');
    if (!newPost.title.trim()) { setPostError('Title is required.'); return; }
    if (!newPost.content.trim()) { setPostError('Content is required.'); return; }
    try {
      await announcementAPI.create({
        title: newPost.title, content: newPost.content,
        image_url: newImages[0] || undefined, image_urls: newImages,
        target_group_id: newPost.target_group_id || null,
        target_heads_only: newPost.target_heads_only,
      });
      setNewPost({ title: '', content: '', target_group_id: '', target_heads_only: false });
      setNewImages([]); setShowCreate(false); loadAnnouncements();
    } catch (err: any) { setPostError(err.message || 'Failed to create announcement.'); }
  };

  const resetCreate = () => {
    setShowCreate(false); setPostError('');
    setNewPost({ title: '', content: '', target_group_id: '', target_heads_only: false });
    setNewImages([]);
  };

  const togglePin  = async (id: number, pinned: boolean) => { try { await announcementAPI.togglePin(id, !pinned); loadAnnouncements(); } catch {} };
  const toggleLike = async (id: number) => { try { await announcementAPI.toggleLike(id); loadAnnouncements(); } catch {} };
  const deletePost = async (id: number) => { if (!confirm('Delete this announcement?')) return; try { await announcementAPI.delete(id); loadAnnouncements(); } catch {} };

  const startEdit = (post: Announcement) => {
    setEditingId(post.id);
    setEditPost({ title: post.title, content: post.content, target_group_id: post.target_group_id ?? '', target_heads_only: !!post.target_heads_only });
    setEditImages(getImages(post));
  };
  const cancelEdit = () => { setEditingId(null); setEditPost({ title: '', content: '', target_group_id: '', target_heads_only: false }); setEditImages([]); };
  const saveEdit = async () => {
    if (!editingId || !editPost.title.trim() || !editPost.content.trim()) return;
    try {
      await announcementAPI.update(editingId, {
        title: editPost.title, content: editPost.content,
        image_url: editImages[0] || undefined, image_urls: editImages,
        target_group_id: editPost.target_group_id || null, target_heads_only: editPost.target_heads_only,
      });
      cancelEdit(); loadAnnouncements();
    } catch {}
  };

  const loadComments   = async (id: number) => { try { const d = await announcementAPI.getComments(id); setComments(p => ({ ...p, [id]: d as Comment[] })); } catch {} };
  const addComment     = async (id: number) => {
    const c = newComment[id]?.trim(); if (!c) return;
    try { await announcementAPI.addComment(id, c); setNewComment(p => ({ ...p, [id]: '' })); loadComments(id); loadAnnouncements(); } catch {}
  };
  const toggleComments = (id: number) => {
    const showing = showComments[id];
    setShowComments(p => ({ ...p, [id]: !showing }));
    if (!showing && !comments[id]) loadComments(id);
  };
  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), day = Math.floor(diff / 86400000);
    if (m < 1) return 'Just now'; if (m < 60) return `${m}m ago`; if (h < 24) return `${h}h ago`; if (day < 7) return `${day}d ago`;
    return new Date(d).toLocaleDateString();
  };
  const canManage = (post: Announcement) => post.user_id === userId;

  const filtered = announcements.filter(p => {
    if (!filterGroup) return true;
    if (filterGroup === 'heads') return p.author_is_head === true;
    return p.author_group_id === filterGroup;
  });
  const pinned  = filtered.filter(a => a.is_pinned);
  const regular = filtered.filter(a => !a.is_pinned);

  const AudienceSelect = ({ value, onChange }: { value: number | '' | 'heads'; onChange: (v: number | '' | 'heads') => void }) => (
    <select value={value}
      onChange={e => { const v = e.target.value; onChange(v === 'heads' ? 'heads' : v === '' ? '' : Number(v)); }}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm">
      <option value="">🌐 Everyone</option>
      <option value="heads">⭐ Heads Only</option>
      {groups.map(g => <option key={g.id} value={g.id}>👥 {g.name}</option>)}
    </select>
  );

  return (
    <>
      <div className="space-y-4">
        {authError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div><p className="text-red-900 font-semibold">Session expired</p><p className="text-red-700 text-sm mt-1">Please refresh and log in again.</p></div>
          </div>
        )}
        {newNotice && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start justify-between gap-3">
            <p className="text-green-700 text-sm">{newNotice.count > 1 ? `${newNotice.count} new announcements.` : `New: "${newNotice.latestTitle}"`}</p>
            <button onClick={() => setNewNotice(null)} className="text-green-700 hover:text-green-900 text-sm font-medium">Dismiss</button>
          </div>
        )}

        {(userRole === 'coordinator' || userRole === 'admin') && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
            <button onClick={() => setShowCreate(true)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl font-medium transition-all shadow-md">
              <FileText className="w-5 h-5" /><span>Create New Announcement</span>
            </button>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <select value={filterGroup} onChange={e => { const v = e.target.value; setFilterGroup(v === '' ? '' : v === 'heads' ? 'heads' : Number(v)); }}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white">
                <option value="">All</option>
                <option value="heads">⭐ Heads Only</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              {filterGroup !== '' && <button onClick={() => setFilterGroup('')} className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition">Clear</button>}
            </div>
          </div>
        )}

        {pinned.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 uppercase tracking-wider"><Pin className="w-4 h-4" /><span>Pinned</span></div>
            {pinned.map(post => (
              <PostCard key={post.id} post={post} canManage={canManage(post)} canEdit={post.user_id === userId}
                onEdit={startEdit} onPin={togglePin} onLike={toggleLike} onDelete={deletePost}
                onToggleComments={toggleComments} showComments={!!showComments[post.id]}
                comments={comments[post.id] || []} newComment={newComment[post.id] || ''}
                onCommentChange={v => setNewComment(p => ({ ...p, [post.id]: v }))}
                onAddComment={addComment} timeAgo={timeAgo}
                onSlideshow={idx => setSlideshow({ images: getImages(post), index: idx, title: post.title })} />
            ))}
          </div>
        )}

        <div className="space-y-4">
          {regular.map(post => (
            <PostCard key={post.id} post={post} canManage={canManage(post)} canEdit={post.user_id === userId}
              onEdit={startEdit} onPin={togglePin} onLike={toggleLike} onDelete={deletePost}
              onToggleComments={toggleComments} showComments={!!showComments[post.id]}
              comments={comments[post.id] || []} newComment={newComment[post.id] || ''}
              onCommentChange={v => setNewComment(p => ({ ...p, [post.id]: v }))}
              onAddComment={addComment} timeAgo={timeAgo}
              onSlideshow={idx => setSlideshow({ images: getImages(post), index: idx, title: post.title })} />
          ))}
        </div>

        {loading && <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>}
        {!loading && announcements.length === 0 && !authError && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p style={{...T.body, color: C.inkMuted}}>No announcements yet</p>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-auto">
            <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 style={T.pageTitle}>Create Announcement</h2>
              <button onClick={resetCreate} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              {postError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{postError}</div>}
              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-700">Title <span className="text-red-500">*</span></label>
                <input type="text" value={newPost.title} onChange={e => setNewPost(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="Announcement title..." />
              </div>
              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-700">Content <span className="text-red-500">*</span></label>
                <textarea value={newPost.content} onChange={e => setNewPost(p => ({ ...p, content: e.target.value }))} rows={6}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none" placeholder="What would you like to announce?" />
              </div>
              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-700">Audience</label>
                <AudienceSelect value={newPost.target_heads_only ? 'heads' : newPost.target_group_id}
                  onChange={v => { if (v === 'heads') setNewPost(p => ({ ...p, target_heads_only: true, target_group_id: '' })); else if (v === '') setNewPost(p => ({ ...p, target_heads_only: false, target_group_id: '' })); else setNewPost(p => ({ ...p, target_heads_only: false, target_group_id: v as number })); }} />
              </div>
              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-700">Photos <span className="text-gray-400 font-normal">(Optional)</span></label>
                <MultiImageUploader images={newImages} onChange={setNewImages} max={5} />
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-gray-200 flex gap-3">
              <button onClick={resetCreate} className="flex-1 px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition border border-gray-300">Cancel</button>
              <button onClick={createAnnouncement} className="flex-1 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition">Post Announcement</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-auto">
            <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 style={T.pageTitle}>Edit Announcement</h2>
              <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-700">Title</label>
                <input type="text" value={editPost.title} onChange={e => setEditPost(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-700">Content</label>
                <textarea value={editPost.content} onChange={e => setEditPost(p => ({ ...p, content: e.target.value }))} rows={6}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none" />
              </div>
              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-700">Audience</label>
                <AudienceSelect value={editPost.target_heads_only ? 'heads' : editPost.target_group_id}
                  onChange={v => { if (v === 'heads') setEditPost(p => ({ ...p, target_heads_only: true, target_group_id: '' })); else if (v === '') setEditPost(p => ({ ...p, target_heads_only: false, target_group_id: '' })); else setEditPost(p => ({ ...p, target_heads_only: false, target_group_id: v as number })); }} />
              </div>
              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-700">Photos</label>
                <MultiImageUploader images={editImages} onChange={setEditImages} max={5} />
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-gray-200 flex gap-3">
              <button onClick={cancelEdit} className="flex-1 px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition border border-gray-300">Cancel</button>
              <button onClick={saveEdit} className="flex-1 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {slideshow && slideshow.images.length > 0 && (
        <SlideshowModal images={slideshow.images} initialIndex={slideshow.index} title={slideshow.title} onClose={() => setSlideshow(null)} />
      )}
    </>
  );
}

// ── PostCard ──────────────────────────────────────────────────────────────────
interface PostCardProps {
  post: Announcement; canManage: boolean; canEdit: boolean;
  onEdit: (p: Announcement) => void; onPin: (id: number, pinned: boolean) => void;
  onLike: (id: number) => void; onDelete: (id: number) => void;
  onToggleComments: (id: number) => void; showComments: boolean;
  comments: Comment[]; newComment: string;
  onCommentChange: (v: string) => void; onAddComment: (id: number) => void;
  timeAgo: (d: string) => string; onSlideshow: (idx: number) => void;
}

function PostCard({ post, canManage, canEdit, onEdit, onPin, onLike, onDelete, onToggleComments, showComments, comments, newComment, onCommentChange, onAddComment, timeAgo, onSlideshow }: PostCardProps) {
  const images = getImages(post);
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 40;
  const words = post.content.split(' ');
  const isLong = words.length > LIMIT;
  const display = isLong && !expanded ? words.slice(0, LIMIT).join(' ') + '…' : post.content;

  return (
    <div className={`bg-white rounded-xl shadow-sm border ${post.is_pinned ? 'border-green-300' : 'border-gray-200'} overflow-hidden`}>
      {/* Header */}
      <div className="p-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold">
            {fullName(post.author_first_name, post.author_last_name, post.user_id)[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{fullName(post.author_first_name, post.author_last_name, post.user_id)}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="capitalize px-2 py-0.5 bg-green-100 text-green-700 rounded">{post.author_role}</span>
              <span>·</span><span>{timeAgo(post.created_at)}</span>
            </div>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-1">
            {canEdit && <button onClick={() => onEdit(post)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit className="w-4 h-4" /></button>}
            <button onClick={() => onPin(post.id, post.is_pinned)} className={`p-2 rounded-lg transition ${post.is_pinned ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}><Pin className="w-4 h-4" /></button>
            <button onClick={() => onDelete(post.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <h3 className="font-semibold text-gray-900 mb-2" style={T.pageTitle}>{post.title}</h3>
        <p className="text-gray-700 whitespace-pre-wrap" style={T.body}>{display}</p>
        {isLong && <button onClick={() => setExpanded(e => !e)} className="mt-1 text-green-600 hover:text-green-700 text-sm font-medium">{expanded ? 'See less' : '…see more'}</button>}
      </div>

      {/* Audience badge */}
      {(post.target_group_name || post.target_heads_only) && (
        <div className="px-4 pb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium">
            {post.target_heads_only ? <><Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Heads Only</> : <><Filter className="w-3 h-3" /> {post.target_group_name}</>}
          </span>
        </div>
      )}

      {/* Images */}
      {images.length > 0 && (
        <div className={`grid gap-1 px-4 pb-3 ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {images.slice(0, 3).map((src, idx) => (
            <div key={idx} className="relative overflow-hidden rounded-lg bg-gray-100 cursor-pointer"
              style={{ aspectRatio: images.length === 1 ? '16/9' : '1' }} onClick={() => onSlideshow(idx)}>
              <img src={src} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-200" />
              {idx === 2 && images.length > 3 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg">
                  <span className="text-white font-bold text-lg">+{images.length - 3}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
        <button onClick={() => onLike(post.id)} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-gray-600 hover:text-red-600 hover:bg-red-50 transition">
          <Heart className="w-5 h-5" /><span className="text-sm font-medium">{post.likes_count}</span>
        </button>
        <button onClick={() => onToggleComments(post.id)} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-gray-600 hover:text-green-600 hover:bg-green-50 transition">
          <MessageSquare className="w-5 h-5" /><span className="text-sm font-medium">{post.comments_count}</span>
        </button>
        {images.length > 0 && (
          <button onClick={() => onSlideshow(0)} className="ml-auto text-xs text-gray-500 hover:text-green-600 transition px-2 py-1.5 rounded-lg hover:bg-green-50">
            {images.length} photo{images.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t border-gray-100 bg-gray-50">
          <div className="p-4 space-y-3">
            {comments.map(comment => (
              <div key={comment.id} className="flex gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {fullName(comment.user_first_name, comment.user_last_name, comment.user_id)[0].toUpperCase()}
                </div>
                <div className="flex-1 bg-white rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-700">{fullName(comment.user_first_name, comment.user_last_name, comment.user_id)}</p>
                  <p className="text-gray-600 mt-1" style={T.body}>{comment.content}</p>
                  <p className="text-gray-400 mt-1" style={T.meta}>{timeAgo(comment.created_at)}</p>
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <input type="text" value={newComment} onChange={e => onCommentChange(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && onAddComment(post.id)}
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                placeholder="Write a comment..." />
              <button onClick={() => onAddComment(post.id)} className="px-3 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl transition flex-shrink-0">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}