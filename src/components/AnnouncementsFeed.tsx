import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageSquare,
  Heart,
  Pin,
  Trash2,
  Send,
  FileText,
  Edit,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  X,
} from 'lucide-react';

import { T, C } from '../design/DesignTokens';
import { announcementAPI } from '../lib/api';

interface Announcement {
  id: number;
  user_id: string;
  title: string;
  content: string;
  image_urls?: string[] | string;
  image_url?: string;
  likes_count: number;
  comments_count: number;
  is_pinned: boolean;
  created_at: string;
  author_first_name?: string;
  author_last_name?: string;
  author_role?: string;
}

interface Comment {
  id: number;
  user_id: string;
  content: string;
  created_at: string;
  user_first_name?: string;
  user_last_name?: string;
}

interface Props {
  userRole: 'admin' | 'coordinator' | 'member';
  userId: string;
}

const parseImages = (raw: any): string[] => {
  if (!raw) return [];

  if (Array.isArray(raw)) return raw.filter(Boolean);

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;

      if (raw.startsWith('http') || raw.startsWith('data:')) {
        return [raw];
      }
    } catch {
      if (raw.startsWith('http') || raw.startsWith('data:')) {
        return [raw];
      }
    }
  }

  return [];
};

const fullName = (f?: string, l?: string, fallback?: string) =>
  `${f || ''} ${l || ''}`.trim() || fallback || 'Unknown';

const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(date).toLocaleDateString();
};

export default function AnnouncementsFeed({ userRole, userId }: Props) {
  const [posts, setPosts] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);

  const [comments, setComments] = useState<Record<number, Comment[]>>({});
  const [showComments, setShowComments] = useState<Record<number, boolean>>({});
  const [commentInput, setCommentInput] = useState<Record<number, string>>({});

  const [slideshow, setSlideshow] = useState<{
    images: string[];
    index: number;
  } | null>(null);

  const [form, setForm] = useState({
    title: '',
    content: '',
    images: [] as string[],
  });

  const knownIds = useRef(new Set<number>());

  const loadPosts = async () => {
    try {
      setError(false);

      const data = await announcementAPI.getAll();

      const announcements = Array.isArray(data) ? data : [];

      knownIds.current = new Set(announcements.map((p) => p.id));

      setPosts(announcements);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();

    const interval = setInterval(loadPosts, 30000);

    return () => clearInterval(interval);
  }, []);

  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;

      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );
    });
  }, [posts]);

  const uploadImages = async (files: FileList | null) => {
    if (!files) return;

    const convert = (file: File) =>
      new Promise<string>((resolve) => {
        const reader = new FileReader();

        reader.onload = (e) => {
          resolve(e.target?.result as string);
        };

        reader.readAsDataURL(file);
      });

    const images = await Promise.all(
      Array.from(files)
        .slice(0, 5)
        .map(convert)
    );

    setForm((p) => ({
      ...p,
      images,
    }));
  };

  const createPost = async () => {
    if (!form.title.trim() || !form.content.trim()) return;

    try {
      await announcementAPI.create({
        title: form.title,
        content: form.content,
        image_url: form.images[0],
        image_urls: form.images,
      });

      setForm({
        title: '',
        content: '',
        images: [],
      });

      setShowCreate(false);

      loadPosts();
    } catch (e) {
      console.error(e);
    }
  };

  const updatePost = async () => {
    if (!editing) return;
  
    try {
      const safeImages =
        Array.isArray(editing.image_urls)
          ? editing.image_urls
          : typeof editing.image_urls === 'string'
            ? JSON.parse(editing.image_urls)
            : [];
  
      await announcementAPI.update(editing.id, {
        title: editing.title,
        content: editing.content,
        image_url: editing.image_url,
        image_urls: safeImages,
        target_group_id: editing.target_group_id,
        target_heads_only: editing.target_heads_only,
      });
  
      setEditing(null);
  
      loadPosts();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleLike = async (id: number) => {
    try {
      await announcementAPI.toggleLike(id);

      setPosts((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                likes_count: p.likes_count + 1,
              }
            : p
        )
      );
    } catch {}
  };

  const togglePin = async (id: number, pinned: boolean) => {
    try {
      await announcementAPI.togglePin(id, !pinned);
      loadPosts();
    } catch {}
  };

  const deletePost = async (id: number) => {
    if (!confirm('Delete this announcement?')) return;

    try {
      await announcementAPI.delete(id);

      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch {}
  };

  const toggleCommentSection = async (id: number) => {
    setShowComments((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));

    if (!comments[id]) {
      try {
        const data = await announcementAPI.getComments(id);

        setComments((prev) => ({
          ...prev,
          [id]: data,
        }));
      } catch {}
    }
  };

  const addComment = async (id: number) => {
    const content = commentInput[id]?.trim();

    if (!content) return;

    try {
      await announcementAPI.addComment(id, content);

      const data = await announcementAPI.getComments(id);

      setComments((prev) => ({
        ...prev,
        [id]: data,
      }));

      setCommentInput((prev) => ({
        ...prev,
        [id]: '',
      }));
    } catch {}
  };

  const canManage = (post: Announcement) =>
    userRole === 'admin' ||
    userRole === 'coordinator' ||
    post.user_id === userId;

  return (
    <>
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p style={T.body}>Failed to load announcements.</p>
          </div>
        )}

        {(userRole === 'admin' || userRole === 'coordinator') && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <button
              onClick={() => setShowCreate(true)}
              className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-3 px-4 flex items-center justify-center gap-2"
            >
              <FileText className="w-5 h-5" />
              Create Announcement
            </button>
          </div>
        )}

        {sortedPosts.map((post) => {
          const images = parseImages(post.image_urls || post.image_url);

          return (
            <div
              key={post.id}
              className={`bg-white rounded-xl border overflow-hidden ${
                post.is_pinned
                  ? 'border-green-300'
                  : 'border-gray-200'
              }`}
            >
              <div className="p-4 flex justify-between items-start">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
                    {fullName(
                      post.author_first_name,
                      post.author_last_name,
                      post.user_id
                    )[0].toUpperCase()}
                  </div>

                  <div>
                    <p className="font-semibold text-gray-900 text-sm">
                      {fullName(
                        post.author_first_name,
                        post.author_last_name,
                        post.user_id
                      )}
                    </p>

                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded capitalize">
                        {post.author_role}
                      </span>

                      <span>•</span>

                      <span>{timeAgo(post.created_at)}</span>
                    </div>
                  </div>
                </div>

                {canManage(post) && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditing(post)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() =>
                        togglePin(post.id, post.is_pinned)
                      }
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <Pin className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => deletePost(post.id)}
                      className="p-2 hover:bg-red-50 text-red-600 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="px-4 pb-4">
                <h2 className="font-semibold text-lg mb-2">
                  {post.title}
                </h2>

                <p
                  className="text-gray-700 whitespace-pre-wrap"
                  style={T.body}
                >
                  {post.content}
                </p>
              </div>

              {images.length > 0 && (
                <div
                  className={`grid gap-1 px-4 pb-4 ${
                    images.length === 1
                      ? 'grid-cols-1'
                      : images.length === 2
                      ? 'grid-cols-2'
                      : 'grid-cols-3'
                  }`}
                >
                  {images.slice(0, 3).map((img, i) => (
                    <div
                      key={i}
                      className="rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
                      onClick={() =>
                        setSlideshow({
                          images,
                          index: i,
                        })
                      }
                    >
                      <img
                        src={img}
                        loading="lazy"
                        alt=""
                        className="w-full h-full object-cover hover:scale-105 transition"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-4">
                <button
                  onClick={() => toggleLike(post.id)}
                  className="flex items-center gap-2 text-gray-600 hover:text-red-600"
                >
                  <Heart className="w-5 h-5" />
                  <span>{post.likes_count}</span>
                </button>

                <button
                  onClick={() => toggleCommentSection(post.id)}
                  className="flex items-center gap-2 text-gray-600 hover:text-green-600"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span>{post.comments_count}</span>
                </button>

                {images.length > 0 && (
                  <button
                    onClick={() =>
                      setSlideshow({
                        images,
                        index: 0,
                      })
                    }
                    className="ml-auto flex items-center gap-2 text-gray-600"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>{images.length}</span>
                  </button>
                )}
              </div>

              {showComments[post.id] && (
                <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                  {(comments[post.id] || []).map((comment) => (
                    <div key={comment.id} className="bg-white rounded-lg p-3">
                      <p className="font-semibold text-sm text-gray-700">
                        {fullName(
                          comment.user_first_name,
                          comment.user_last_name,
                          comment.user_id
                        )}
                      </p>

                      <p className="mt-1 text-gray-700">
                        {comment.content}
                      </p>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <input
                      value={commentInput[post.id] || ''}
                      onChange={(e) =>
                        setCommentInput((prev) => ({
                          ...prev,
                          [post.id]: e.target.value,
                        }))
                      }
                      className="flex-1 border border-gray-300 rounded-xl px-3 py-2"
                      placeholder="Write a comment..."
                    />

                    <button
                      onClick={() => addComment(post.id)}
                      className="bg-green-600 hover:bg-green-700 text-white rounded-xl px-4"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-center py-10">
            <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-green-600" />
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 text-center py-12">
            <AlertCircle className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <p style={{ ...T.body, color: C.inkMuted }}>
              No announcements yet
            </p>
          </div>
        )}
      </div>

      {(showCreate || editing) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center">
              <h2 style={T.pageTitle}>
                {editing ? 'Edit Announcement' : 'Create Announcement'}
              </h2>

              <button
                onClick={() => {
                  setShowCreate(false);
                  setEditing(null);
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <input
                value={editing ? editing.title : form.title}
                onChange={(e) => {
                  if (editing) {
                    setEditing({
                      ...editing,
                      title: e.target.value,
                    });
                  } else {
                    setForm((p) => ({
                      ...p,
                      title: e.target.value,
                    }));
                  }
                }}
                placeholder="Title"
                className="w-full border border-gray-300 rounded-xl px-4 py-3"
              />

              <textarea
                rows={6}
                value={editing ? editing.content : form.content}
                onChange={(e) => {
                  if (editing) {
                    setEditing({
                      ...editing,
                      content: e.target.value,
                    });
                  } else {
                    setForm((p) => ({
                      ...p,
                      content: e.target.value,
                    }));
                  }
                }}
                placeholder="Content"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none"
              />

              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => uploadImages(e.target.files)}
              />

              {form.images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {form.images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      className="rounded-lg aspect-square object-cover"
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowCreate(false);
                  setEditing(null);
                }}
                className="px-5 py-2.5 border border-gray-300 rounded-xl"
              >
                Cancel
              </button>

              <button
                onClick={editing ? updatePost : createPost}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl"
              >
                {editing ? 'Save Changes' : 'Post Announcement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {slideshow && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center">
          <button
            onClick={() => setSlideshow(null)}
            className="absolute top-4 right-4 text-white"
          >
            <X className="w-7 h-7" />
          </button>

          {slideshow.images.length > 1 && (
            <button
              onClick={() =>
                setSlideshow((p) =>
                  p
                    ? {
                        ...p,
                        index:
                          (p.index - 1 + p.images.length) %
                          p.images.length,
                      }
                    : null
                )
              }
              className="absolute left-4 text-white"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          <img
            src={slideshow.images[slideshow.index]}
            className="max-w-full max-h-full object-contain"
          />

          {slideshow.images.length > 1 && (
            <button
              onClick={() =>
                setSlideshow((p) =>
                  p
                    ? {
                        ...p,
                        index: (p.index + 1) % p.images.length,
                      }
                    : null
                )
              }
              className="absolute right-4 text-white"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
