// LandingPage.tsx
import { useState, useEffect } from 'react';
import { LogIn, Pin, Megaphone } from 'lucide-react';
import { T, C } from '../design/DesignTokens';

interface LandingPageProps {
  onGoToSignIn: () => void;
}

interface PublicPost {
  id: number;
  title: string;
  content: string;
  author_first_name?: string | null;
  author_last_name?: string | null;
  author_email: string;
  author_role: string;
  is_pinned: boolean;
  created_at: string;
}

const API_BASE =
  (import.meta.env.VITE_API_URL as string) ??
  (import.meta.env.VITE_PYTHON_API_URL as string) ??
  `${location.protocol}//${location.hostname}:5000`;

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m   = Math.floor(diff / 60000);
  const h   = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (m < 1)   return 'Just now';
  if (m < 60)  return `${m}m ago`;
  if (h < 24)  return `${h}h ago`;
  if (day < 7) return `${day}d ago`;
  return new Date(d).toLocaleDateString();
}

function authorName(post: PublicPost) {
  const v = `${post.author_first_name || ''} ${post.author_last_name || ''}`.trim();
  return v || post.author_email.split('@')[0];
}

function PostCard({ post }: { post: PublicPost }) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 40;
  const words = post.content.split(' ');
  const isLong = words.length > LIMIT;
  const display = isLong && !expanded ? words.slice(0, LIMIT).join(' ') + '…' : post.content;

  return (
    <div className={`bg-white rounded-xl shadow-sm border overflow-hidden ${post.is_pinned ? 'border-green-300' : 'border-gray-200'}`}>
      <div className="p-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold">
            {authorName(post)[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{authorName(post)}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="capitalize px-2 py-0.5 bg-green-100 text-green-700 rounded">
                {post.author_role}
              </span>
              <span>·</span>
              <span>{timeAgo(post.created_at)}</span>
            </div>
          </div>
        </div>
        {post.is_pinned && <Pin className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" />}
      </div>
      <div className="px-4 pb-4">
        <h3 className="font-semibold text-gray-900 mb-2" style={T.cardTitle}>{post.title}</h3>
        <p className="text-gray-700 whitespace-pre-wrap" style={T.body}>{display}</p>
        {isLong && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-1 text-green-600 hover:text-green-700 text-sm font-medium"
          >
            {expanded ? 'See less' : '…see more'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function LandingPage({ onGoToSignIn }: LandingPageProps) {
  const [posts,   setPosts]   = useState<PublicPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/announcements/public`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setPosts(Array.isArray(data) ? data : []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  const pinned  = posts.filter(p => p.is_pinned);
  const regular = posts.filter(p => !p.is_pinned);

  return (
    <div className="min-h-screen" style={{ background: C.surfacePage, fontFamily: 'var(--font-base)' }}>
      <header
        className="sticky top-0 z-30"
        style={{
          background: C.surfaceCard,
          borderBottom: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/Pathsafe1.png" alt="PathSafe logo" className="w-10 h-10 object-contain flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="truncate" style={T.pageTitle}>PathSafe</h1>
              <p className="truncate hidden sm:block" style={T.meta}>
                Disaster Risk Reduction & Management
              </p>
            </div>
          </div>
          <button
            onClick={onGoToSignIn}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl font-medium transition-all shadow-md flex-shrink-0"
          >
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline">Go to Sign In</span>
            <span className="sm:hidden">Sign In</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-start gap-4">
          <div className="w-11 h-11 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Megaphone className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <h2 style={T.sectionHeader}>Announcements</h2>
            <p className="mt-1" style={T.body}>
              Public updates and safety notices from your organization. Sign in to view full details,
              comment, and access the complete system.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p style={{ ...T.body, color: C.inkMuted }}>No public announcements yet</p>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 uppercase tracking-wider">
                  <Pin className="w-4 h-4" /><span>Pinned</span>
                </div>
                {pinned.map(post => <PostCard key={post.id} post={post} />)}
              </div>
            )}
            {regular.length > 0 && (
              <div className="space-y-4">
                {regular.map(post => <PostCard key={post.id} post={post} />)}
              </div>
            )}
          </>
        )}

        <div className="text-center py-6">
          <p style={{ ...T.meta, marginBottom: '0.75rem' }}>Ready to access the full system?</p>
          <button
            onClick={onGoToSignIn}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl font-medium transition-all shadow-md"
          >
            <LogIn className="w-4 h-4" />
            Go to Sign In Page
          </button>
        </div>
      </main>
    </div>
  );
}