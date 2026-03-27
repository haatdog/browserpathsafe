// AnnouncementsFeed.tsx
import { useState, useEffect, useCallback } from 'react';
import { T, C } from '../design/DesignTokens';
import {
  MessageSquare, Heart, Pin, Trash2, Send, FileText,
  AlertCircle, Upload, X, ChevronLeft, ChevronRight, Images, Filter, Star
} from 'lucide-react';
import { announcementAPI, organizationAPI } from '../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────
interface Announcement {
  id: number;
  user_id: string;
  author_email: string;
  author_role: string;
  title: string;
  content: string;
  image_url?: string;
  image_urls?: string[] | string; // API may return raw JSON string
  is_pinned: boolean;
  likes_count: number;
  comments_count: number;
  author_group_id?: number | null;
  author_group_name?: string | null;
  author_is_head?: boolean;
  target_group_id?: number | null;
  target_group_name?: string | null;
  target_heads_only?: boolean;
  created_at: string;
  updated_at: string;
}

interface Comment {
  id: number;
  announcement_id: number;
  user_id: string;
  author_email: string;
  content: string;
  created_at: string;
}

interface Group {
  id: number;
  name: string;
}

interface AnnouncementsFeedProps {
  userRole: 'admin' | 'executive' | 'member';
  userId: string;
}

// ── Multi-image uploader ─────────────────────────────────────────────────────
interface MultiImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
  accentColor?: 'blue' | 'purple';
}

function MultiImageUploader({ images, onChange, max = 5, accentColor = 'blue' }: MultiImageUploaderProps) {
  const [dragOver, setDragOver] = useState(false);

  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = e => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const MAX = 800;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
            else { width = Math.round((width * MAX) / height); height = MAX; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.55));
        };
        img.src = e.target!.result as string;
      };
      reader.readAsDataURL(file);
    });

  const processFiles = (files: FileList | null) => {
    if (!files) return;
    const toProcess = Array.from(files)
      .filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024) // 10MB raw limit
      .slice(0, max - images.length);
    if (toProcess.length === 0) return;

    Promise.all(toProcess.map(compressImage))
      .then(compressed => onChange([...images, ...compressed]))
      .catch(err => console.error('Image compression failed:', err));
  };

  const removeImage = (idx: number) => onChange(images.filter((_, i) => i !== idx));

  const dropBg = dragOver
    ? 'border-blue-500 bg-blue-50'
    : accentColor === 'purple'
    ? 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50';

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {images.map((src, idx) => (
            <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-all">
                <X className="w-3 h-3" />
              </button>
              {idx === 0 && (
                <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-sm" style={T.bodyMedium}>Cover</span>
              )}
            </div>
          ))}
        </div>
      )}

      {images.length < max && (
        <label
          className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer transition ${dropBg}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); processFiles(e.dataTransfer.files); }}
        >
          <div className="flex flex-col items-center gap-1.5 ds-ink-muted pointer-events-none">
            <Upload className="w-6 h-6" />
            <span className="ds-body" style={{fontWeight:500}}>{images.length === 0 ? 'Upload photos' : 'Add more photos'}</span>
            <span className="ds-meta">{images.length}/{max} • PNG, JPG, WEBP up to 5MB each</span>
          </div>
          <input type="file" accept="image/*" multiple className="hidden"
            onChange={e => { processFiles(e.target.files); e.target.value = ''; }} />
        </label>
      )}
      {images.length >= max && (
        <p className="text-center ds-ink-disabled" style={T.meta}>Maximum {max} photos reached</p>
      )}
    </div>
  );
}

// ── Photo Slideshow Modal ─────────────────────────────────────────────────────
interface SlideshowModalProps {
  images: string[];
  initialIndex?: number;
  title?: string;
  onClose: () => void;
}

function SlideshowModal({ images, initialIndex = 0, title, onClose }: SlideshowModalProps) {
  const [current, setCurrent] = useState(initialIndex);

  const prev = useCallback(() => setCurrent(c => (c - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setCurrent(c => (c + 1) % images.length), [images.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prev, next, onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex flex-col"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Images className="w-5 h-5 text-white/60" />
          {title && <span className="text-white truncate max-w-xs" style={T.sectionHeader}>{title}</span>}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/60 tabular-nums" style={T.body}>
            {current + 1} / {images.length}
          </span>
          <button onClick={onClose} className="text-white/70 hover:text-white transition p-1 rounded-lg hover:bg-white/10">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main image area */}
      <div className="flex-1 flex items-center justify-center px-4 min-h-0 relative">
        {/* Prev arrow */}
        {images.length > 1 && (
          <button onClick={prev}
            className="absolute left-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition backdrop-blur-sm">
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Image */}
        <div className="relative max-w-5xl max-h-full flex items-center justify-center w-full h-full">
          <img
            key={current}
            src={images[current]}
            alt={`Photo ${current + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            style={{ maxHeight: 'calc(100vh - 220px)' }}
          />
        </div>

        {/* Next arrow */}
        {images.length > 1 && (
          <button onClick={next}
            className="absolute right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition backdrop-blur-sm">
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex-shrink-0 py-4 px-6">
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1">
            {images.map((src, idx) => (
              <button
                key={idx}
                onClick={() => setCurrent(idx)}
                className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                  idx === current
                    ? 'border-white scale-110 shadow-lg'
                    : 'border-transparent opacity-50 hover:opacity-80'
                }`}
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrent(idx)}
                className={`rounded-full transition-all ${
                  idx === current ? 'bg-white w-4 h-2' : 'bg-white/40 w-2 h-2'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper: normalise image list from a post ─────────────────────────────────
// image_urls can come back from psycopg2 as a raw JSON string instead of a
// parsed array — handle both cases so nothing renders blank.
function parseImageUrls(raw: string[] | string | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getImages(post: Announcement): string[] {
  const fromArray = parseImageUrls(post.image_urls);
  if (fromArray.length > 0) return fromArray;
  if (post.image_url) {
    const fromUrlField = parseImageUrls(post.image_url);
    if (fromUrlField.length > 0) return fromUrlField;
    if (post.image_url.startsWith("data:") || post.image_url.startsWith("http")) {
      return [post.image_url];
    }
  }
  return [];
}

// ── Main Feed ────────────────────────────────────────────────────────────────
export default function AnnouncementsFeed({ userRole, userId }: AnnouncementsFeedProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '', target_group_id: '' as number | '', target_heads_only: false });
  const [newImages, setNewImages] = useState<string[]>([]);
  const [comments, setComments] = useState<Record<number, Comment[]>>({});
  const [newComment, setNewComment] = useState<Record<number, string>>({});
  const [showComments, setShowComments] = useState<Record<number, boolean>>({});

  // Slideshow state
  const [slideshow, setSlideshow] = useState<{ images: string[]; index: number; title: string } | null>(null);

  // Filter state (executive only)
  const [groups, setGroups] = useState<Group[]>([]);
  const [filterGroupId, setFilterGroupId] = useState<number | 'heads' | ''>('');

  useEffect(() => { loadAnnouncements(); loadGroups(); }, []);

  const loadGroups = async () => {
    try {
      const data = await organizationAPI.listGroups();
      setGroups(Array.isArray(data) ? data : []);
    } catch {}
  };
  
  const loadAnnouncements = async () => {
    try {
      setAuthError(false);
      const data = await announcementAPI.getAll();
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (e: any) {
      if (e.message?.includes('401')) setAuthError(true);
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  };
  
  const createAnnouncement = async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) { alert('Please fill in title and content'); return; }
    try {
      await announcementAPI.create({
        title: newPost.title,
        content: newPost.content,
        image_url: newImages[0] || '',
        image_urls: newImages,
        target_group_id: newPost.target_group_id || null,
        target_heads_only: newPost.target_heads_only,
      });
      setNewPost({ title: '', content: '', target_group_id: '', target_heads_only: false });
      setNewImages([]);
      setShowCreateModal(false);
      loadAnnouncements();
    } catch { alert('Failed to create announcement'); }
  };
  
  const togglePin = async (id: number, currentlyPinned: boolean) => {
    try {
      await announcementAPI.togglePin(id, !currentlyPinned);
      loadAnnouncements();
    } catch {}
  };
  
  const toggleLike = async (id: number) => {
    try {
      await announcementAPI.toggleLike(id);
      loadAnnouncements();
    } catch {}
  };
  
  const deleteAnnouncement = async (id: number) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await announcementAPI.delete(id);
      loadAnnouncements();
    } catch {}
  };
  
  const loadComments = async (id: number) => {
    try {
      const data = await announcementAPI.getComments(id);
      setComments(prev => ({ ...prev, [id]: data as Comment[] }));
    } catch {}
  };
  
  const addComment = async (id: number) => {
    const content = newComment[id]?.trim();
    if (!content) return;
    try {
      await announcementAPI.addComment(id, content);
      setNewComment(prev => ({ ...prev, [id]: '' }));
      loadComments(id);
      loadAnnouncements();
    } catch {}
  };

  const toggleComments = (id: number) => {
    const showing = showComments[id];
    setShowComments(prev => ({ ...prev, [id]: !showing }));
    if (!showing && !comments[id]) loadComments(id);
  };

  const formatTimeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), day = Math.floor(diff / 86400000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    if (day < 7) return `${day}d ago`;
    return new Date(d).toLocaleDateString();
  };

  const canManagePost = (post: Announcement) =>
    userRole === 'admin' || userRole === 'executive' || post.user_id === userId;

  // Apply group / heads filter (executive only)
  const filteredAnnouncements = announcements.filter(post => {
    if (!filterGroupId) return true;
    if (filterGroupId === 'heads') return post.author_is_head === true;
    return post.author_group_id === filterGroupId;
  });

  const pinnedPosts = filteredAnnouncements.filter(a => a.is_pinned);
  const regularPosts = filteredAnnouncements.filter(a => !a.is_pinned);

  return (
    <>
      <div className="space-y-4">
        {authError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-red-900" style={T.sectionHeader}>Authentication Required</h3>
              <p className="text-red-700 mt-1" style={T.body}>Your session has expired. Please refresh and log in again.</p>
            </div>
          </div>
        )}

        {(userRole === 'executive' || userRole === 'admin') && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
            <button onClick={() => setShowCreateModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-medium transition-all shadow-md">
              <FileText className="w-5 h-5" />
              <span>Create New Announcement</span>
            </button>

            {/* Filter bar */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 ds-ink-disabled flex-shrink-0" />
              <select
                value={filterGroupId}
                onChange={e => {
                  const v = e.target.value;
                  setFilterGroupId(v === '' ? '' : v === 'heads' ? 'heads' : Number(v));
                }}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">All Members</option>
                <option value="heads">⭐ Heads Only</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              {filterGroupId !== '' && (
                <button onClick={() => setFilterGroupId('')}
                  className="text-xs ds-ink-muted hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition">
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {pinnedPosts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 ds-section-header">
              <Pin className="w-4 h-4" /><span>Pinned Announcements</span>
            </div>
            {pinnedPosts.map(post => (
              <PostCard key={post.id} post={post} canManage={canManagePost(post)}
                onTogglePin={togglePin} onToggleLike={toggleLike} onDelete={deleteAnnouncement}
                onToggleComments={toggleComments} showComments={showComments[post.id]}
                comments={comments[post.id] || []} newComment={newComment[post.id] || ''}
                onCommentChange={(v: string) => setNewComment(prev => ({ ...prev, [post.id]: v }))}
                onAddComment={addComment} formatTimeAgo={formatTimeAgo}
                onOpenSlideshow={(idx) => setSlideshow({ images: getImages(post), index: idx, title: post.title })}
              />
            ))}
          </div>
        )}

        <div className="space-y-4">
          {regularPosts.map(post => (
            <PostCard key={post.id} post={post} canManage={canManagePost(post)}
              onTogglePin={togglePin} onToggleLike={toggleLike} onDelete={deleteAnnouncement}
              onToggleComments={toggleComments} showComments={showComments[post.id]}
              comments={comments[post.id] || []} newComment={newComment[post.id] || ''}
              onCommentChange={(v: string) => setNewComment(prev => ({ ...prev, [post.id]: v }))}
              onAddComment={addComment} formatTimeAgo={formatTimeAgo}
              onOpenSlideshow={(idx) => setSlideshow({ images: getImages(post), index: idx, title: post.title })}
            />
          ))}
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}

        {!loading && announcements.length === 0 && !authError && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <AlertCircle className="w-12 h-12 ds-ink-disabled mx-auto mb-3" />
            <p style={{...T.body, color: C.inkMuted}}>No announcements yet</p>
            <p className="ds-ink-muted mt-1" style={T.body}>Check back later for updates</p>
          </div>
        )}

        {/* ── Create Post Modal ─────────────────────────────────────────── */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="ds-page-title">Create Announcement</h2>
                <button onClick={() => { setShowCreateModal(false); setNewPost({ title: '', content: '', target_group_id: '', target_heads_only: false }); setNewImages([]); }}
                  className="text-gray-400 hover:text-gray-600 transition">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block ds-body mb-2" style={{fontWeight:500}}>Title</label>
                  <input type="text" value={newPost.title}
                    onChange={e => setNewPost({ ...newPost, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter announcement title..." />
                </div>

                <div>
                  <label className="block ds-body mb-2" style={{fontWeight:500}}>Content</label>
                  <textarea value={newPost.content}
                    onChange={e => setNewPost({ ...newPost, content: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={6} placeholder="What would you like to announce?" />
                </div>

                {/* Audience targeting */}
                <div>
                  <label className="block ds-body mb-2" style={{fontWeight:500}}>
                    Audience
                  </label>
                  <div className="space-y-2">
                    <select
                      value={newPost.target_heads_only ? 'heads' : (newPost.target_group_id || '')}
                      onChange={e => {
                        const v = e.target.value;
                        if (v === 'heads') {
                          setNewPost(p => ({ ...p, target_heads_only: true, target_group_id: '' }));
                        } else if (v === '') {
                          setNewPost(p => ({ ...p, target_heads_only: false, target_group_id: '' }));
                        } else {
                          setNewPost(p => ({ ...p, target_heads_only: false, target_group_id: Number(v) }));
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="">🌐 Everyone</option>
                      <option value="heads">⭐ Heads Only</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>👥 {g.name}</option>
                      ))}
                    </select>
                    <p className="ds-meta">
                      {newPost.target_heads_only
                        ? 'Only group heads will see this announcement.'
                        : newPost.target_group_id
                        ? `Only members of the selected group will see this.`
                        : 'All members will see this announcement.'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block ds-body mb-2" style={{fontWeight:500}}>
                    Photos (Optional, up to 5)
                  </label>
                  <MultiImageUploader images={newImages} onChange={setNewImages} max={5} accentColor="blue" />
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button onClick={() => { setShowCreateModal(false); setNewPost({ title: '', content: '', target_group_id: '', target_heads_only: false }); setNewImages([]); }}
                  className="px-4 py-2 ds-ink-secondary hover:bg-gray-100 rounded-lg transition">
                  Cancel
                </button>
                <button onClick={createAnnouncement}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition">
                  Post Announcement
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Slideshow overlay ───────────────────────────────────────────────── */}
      {slideshow && slideshow.images.length > 0 && (
        <SlideshowModal
          images={slideshow.images}
          initialIndex={slideshow.index}
          title={slideshow.title}
          onClose={() => setSlideshow(null)}
        />
      )}
    </>
  );
}

// ── Post Card ────────────────────────────────────────────────────────────────
interface PostCardProps {
  post: Announcement;
  canManage: boolean;
  onTogglePin: (id: number, isPinned: boolean) => void;
  onToggleLike: (id: number) => void;
  onDelete: (id: number) => void;
  onToggleComments: (id: number) => void;
  showComments: boolean;
  comments: Comment[];
  newComment: string;
  onCommentChange: (value: string) => void;
  onAddComment: (id: number) => void;
  formatTimeAgo: (date: string) => string;
  onOpenSlideshow: (index: number) => void;
}

function PostCard({
  post, canManage, onTogglePin, onToggleLike, onDelete,
  onToggleComments, showComments, comments, newComment,
  onCommentChange, onAddComment, formatTimeAgo, onOpenSlideshow
}: PostCardProps) {
  const images = getImages(post);

  return (
    <div className={`bg-white rounded-xl shadow-sm border ${post.is_pinned ? 'border-blue-300' : 'border-gray-200'} overflow-hidden`}>
      {/* Header */}
      <div className="p-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
            {post.author_email[0].toUpperCase()}
          </div>
          <div>
            <p className="ds-card-title">{post.author_email}</p>
            <div className="flex items-center gap-2 ds-meta">
              <span className="capitalize px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{post.author_role}</span>
              <span>•</span>
              <span>{formatTimeAgo(post.created_at)}</span>
            </div>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-1">
            <button onClick={() => onTogglePin(post.id, post.is_pinned)}
              className={`p-2 rounded-lg transition ${post.is_pinned ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-100'}`}
              title={post.is_pinned ? 'Unpin' : 'Pin'}>
              <Pin className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(post.id)}
              className="p-2 ds-ink-disabled hover:text-red-600 hover:bg-red-50 rounded-lg transition">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <h3 className="ds-ink-primary mb-2" style={T.pageTitle}>{post.title}</h3>
        <p className="ds-body whitespace-pre-wrap">{post.content}</p>
      </div>

      {/* Audience badge */}
      {(post.target_group_name || post.target_heads_only) && (
        <div className="px-4 pb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200" style={T.bodyMedium}>
            {post.target_heads_only
              ? <><Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Heads Only</>
              : <><Filter className="w-3 h-3" /> {post.target_group_name}</>
            }
          </span>
        </div>
      )}

      {/* Photo grid */}
      {images.length > 0 && (
        <div className={`grid gap-1 px-4 pb-3 ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {images.slice(0, 3).map((src, idx) => {
            const isLast = idx === 2 && images.length > 3;
            return (
              <div key={idx} className="relative overflow-hidden rounded-lg bg-gray-100 cursor-pointer"
                style={{ aspectRatio: images.length === 1 ? '16/9' : '1' }}
                onClick={() => onOpenSlideshow(idx)}>
                <img src={src} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-200" />
                {isLast && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg">
                    <span className="text-white ds-page-title">+{images.length - 3}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-4">
        <button onClick={() => onToggleLike(post.id)}
          className="flex items-center gap-2 text-gray-600 hover:text-red-600 transition">
          <Heart className="w-5 h-5" />
          <span className="ds-body" style={{fontWeight:500}}>{post.likes_count}</span>
        </button>
        <button onClick={() => onToggleComments(post.id)}
          className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition">
          <MessageSquare className="w-5 h-5" />
          <span className="ds-body" style={{fontWeight:500}}>{post.comments_count}</span>
        </button>
        {images.length > 0 && (
          <button onClick={() => onOpenSlideshow(0)}
            className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition ml-auto">
            <Images className="w-4 h-4" />
            <span style={T.body}>{images.length} photo{images.length !== 1 ? 's' : ''}</span>
          </button>
        )}
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t border-gray-100 bg-gray-50">
          <div className="p-4 space-y-3">
            {comments.map((comment: Comment) => (
              <div key={comment.id} className="flex gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white ds-section-header flex-shrink-0">
                  {comment.author_email[0].toUpperCase()}
                </div>
                <div className="flex-1 bg-white rounded-lg p-3">
                  <p className="ds-section-header">{comment.author_email}</p>
                  <p className="ds-ink-secondary mt-1" style={T.body}>{comment.content}</p>
                  <p className="ds-ink-muted mt-1" style={T.meta}>{formatTimeAgo(comment.created_at)}</p>
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <input type="text" value={newComment}
                onChange={e => onCommentChange(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && onAddComment(post.id)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Write a comment..." />
              <button onClick={() => onAddComment(post.id)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}