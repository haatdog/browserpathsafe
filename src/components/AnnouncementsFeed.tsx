import { useState, useEffect } from 'react';
import { T, C } from '../design/DesignTokens';
import { AlertCircle, FileText, X, Filter } from 'lucide-react';
import { announcementAPI, organizationAPI } from '../lib/api';

interface Announcement {
  id: number;
  user_id: string;

  author_first_name?: string | null;
  author_last_name?: string | null;

  title: string;
  content: string;

  author_role: string;

  author_group_id?: number | null;
  author_group_name?: string | null;

  target_group_id?: number | null;
  target_group_name?: string | null;
  target_heads_only?: boolean;

  created_at: string;
  updated_at: string;
}

interface Group {
  id: number;
  name: string;
}

interface AnnouncementsFeedProps {
  userRole: 'admin' | 'coordinator' | 'member';
  userId: string;
}

function fullName(
  first?: string | null,
  last?: string | null,
  fallback?: string
): string {
  const value = `${first || ''} ${last || ''}`.trim();

  return value || fallback || 'Unknown';
}

export default function AnnouncementsFeed({
  userRole,
}: AnnouncementsFeedProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [postError, setPostError] = useState('');

  const [groups, setGroups] = useState<Group[]>([]);

  const [filterGroupId, setFilterGroupId] = useState<number | 'heads' | ''>(
    ''
  );

  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    target_group_id: '' as number | '',
    target_heads_only: false,
  });

  useEffect(() => {
    loadAnnouncements();
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const data = await organizationAPI.listGroups();

      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadAnnouncements = async () => {
    try {
      setAuthError(false);

      const data = await announcementAPI.getAll();

      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (e: any) {
      if (e.message?.includes('401')) {
        setAuthError(true);
      }

      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  };

  const createAnnouncement = async () => {
    setPostError('');

    if (!newPost.title.trim()) {
      setPostError('Title is required.');
      return;
    }

    if (!newPost.content.trim()) {
      setPostError('Content is required.');
      return;
    }

    try {
      await announcementAPI.create({
        title: newPost.title,
        content: newPost.content,
        target_group_id: newPost.target_group_id || null,
        target_heads_only: newPost.target_heads_only,
      });

      setNewPost({
        title: '',
        content: '',
        target_group_id: '',
        target_heads_only: false,
      });

      setShowCreateModal(false);

      loadAnnouncements();
    } catch (err: any) {
      setPostError(err.message || 'Failed to create announcement.');
    }
  };

  const filteredAnnouncements = announcements.filter((post) => {
    if (!filterGroupId) return true;

    if (filterGroupId === 'heads') {
      return post.target_heads_only === true;
    }

    return post.author_group_id === filterGroupId;
  });

  const resetModal = () => {
    setShowCreateModal(false);

    setPostError('');

    setNewPost({
      title: '',
      content: '',
      target_group_id: '',
      target_heads_only: false,
    });
  };

  return (
    <div className="space-y-4">
      {authError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />

          <div>
            <h3
              className="text-red-900"
              style={T.sectionHeader}
            >
              Authentication Required
            </h3>

            <p
              className="text-red-700 mt-1"
              style={T.body}
            >
              Your session has expired. Please refresh and log in again.
            </p>
          </div>
        </div>
      )}

      {(userRole === 'admin' || userRole === 'coordinator') && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-all"
          >
            <FileText className="w-5 h-5" />

            <span>Create New Announcement</span>
          </button>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />

            <select
              value={filterGroupId}
              onChange={(e) => {
                const v = e.target.value;

                setFilterGroupId(
                  v === ''
                    ? ''
                    : v === 'heads'
                    ? 'heads'
                    : Number(v)
                );
              }}
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All Members</option>

              <option value="heads">Heads Only</option>

              {groups.map((g) => (
                <option
                  key={g.id}
                  value={g.id}
                >
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
        </div>
      )}

      {!loading &&
        filteredAnnouncements.map((post) => (
          <div
            key={post.id}
            className="bg-white rounded-xl border border-gray-200 p-4"
          >
            <h2 className="font-bold text-lg">
              {post.title}
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              {fullName(
                post.author_first_name,
                post.author_last_name,
                post.user_id
              )}
            </p>

            <p className="mt-3 whitespace-pre-wrap">
              {post.content}
            </p>
          </div>
        ))}

      {!loading &&
        filteredAnnouncements.length === 0 &&
        !authError && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />

            <p
              style={{
                ...T.body,
                color: C.inkMuted,
              }}
            >
              No announcements yet
            </p>
          </div>
        )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl overflow-auto">
            <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 style={T.pageTitle}>
                Create Announcement
              </h2>

              <button
                onClick={resetModal}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Title
                </label>

                <input
                  type="text"
                  value={newPost.title}
                  onChange={(e) =>
                    setNewPost({
                      ...newPost,
                      title: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Content
                </label>

                <textarea
                  value={newPost.content}
                  onChange={(e) =>
                    setNewPost({
                      ...newPost,
                      content: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none"
                  rows={6}
                />
              </div>

              {postError && (
                <p className="text-red-600 text-sm">
                  {postError}
                </p>
              )}
            </div>

            <div className="p-4 sm:p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={resetModal}
                className="flex-1 px-4 py-2.5 text-gray-600 border border-gray-300 rounded-xl"
              >
                Cancel
              </button>

              <button
                onClick={createAnnouncement}
                className="flex-1 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl"
              >
                Post Announcement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}