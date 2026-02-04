'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  like_count: number;
  author: {
    id: string;
    username: string;
    avatar_url?: string;
    bluecheck: boolean;
  };
}

interface CommentModalProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CommentModal({ postId, isOpen, onClose }: CommentModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, postId]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/feed/comments/${postId}`);
      const data = await response.json();
      if (data.comments) {
        setComments(data.comments);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/feed/comments/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment }),
      });

      const data = await response.json();
      if (data.comment) {
        setComments([data.comment, ...comments]);
        setNewComment('');
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
      alert('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Comments</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-red-50 rounded-full transition-colors text-gray-700 hover:text-red-600"
            aria-label="Close comments"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comment Input */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex-shrink-0" />
            <div className="flex-1">
              <textarea
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="w-full resize-none border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                rows={2}
                maxLength={100}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-gray-500">{newComment.length}/100</span>
                <button
                  onClick={handleSubmit}
                  disabled={!newComment.trim() || submitting}
                  className="px-4 py-1.5 bg-blue-500 text-white text-sm font-semibold rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Posting...' : 'Comment'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="text-center text-gray-500 py-8">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No comments yet. Be the first!</div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {comment.author.avatar_url ? (
                    <img
                      src={comment.author.avatar_url}
                      alt={comment.author.username}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold text-sm">
                      {comment.author.username[0]?.toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Comment Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900">
                      {comment.author.username}
                    </span>
                    {comment.author.bluecheck && <span className="text-blue-500 text-xs">✓</span>}
                    <span className="text-gray-500 text-sm">·</span>
                    <span className="text-gray-500 text-sm">
                      {formatTimeAgo(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 mt-1">{comment.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
