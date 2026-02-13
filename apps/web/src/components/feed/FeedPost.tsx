'use client';

import { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Repeat2,
  Heart,
  BarChart3,
  Share2,
  MoreHorizontal,
  Link,
  Send,
} from 'lucide-react';
import { LikeButton } from './LikeButton';
import { PostMenu } from './PostMenu';
import { UserBadges } from '@/components/badges/UserBadges';
import { BadgeDisplay } from '@/components/badges/BadgeDisplay';
import { CommentModal } from './CommentModal';

import { type Post as FeedDataPost } from '@/lib/data/feed';

interface FeedPostProps {
  post: FeedDataPost;
  currentUserId?: string;
  onDelete?: () => void;
}

export function FeedPost({ post, currentUserId, onDelete }: FeedPostProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [commentCount, setCommentCount] = useState(post.replies || 0);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  const isAuthor = currentUserId === post.author.id;

  // Close share menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShowShareMenu(false);
      }
    };

    if (showShareMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showShareMenu]);

  // Prevent hydration mismatch for dates
  useEffect(() => {
    setMounted(true);
  }, []);

  // Track view on mount
  useEffect(() => {
    // Only track if we have a view counter/tracker
    const trackView = async () => {
      try {
        const { trackView: track } = await import('../../../app/feed/interactions');
        // Check if track exists before calling
        if (track) await track(post.id);
      } catch (error) {
        // Silently fail
      }
    };
    trackView();

    // Check follow status
    const checkFollow = async () => {
      if (!currentUserId || isAuthor) return;
      try {
        const response = await fetch(`/api/feed/follow/${post.author.id}`);
        const data = await response.json();
        setIsFollowing(data.following);
      } catch (error) {
        // Silently fail
      }
    };
    checkFollow();

    // Fetch comment count
    const fetchCommentCount = async () => {
      try {
        const response = await fetch(`/api/feed/comments/${post.id}`);
        const data = await response.json();
        setCommentCount(data.comments?.length || 0);
      } catch (error) {
        // Silently fail
      }
    };
    fetchCommentCount();
  }, [post.id, post.author.id, currentUserId, isAuthor]);

  const handleSaveEdit = async () => {
    if (!editContent.trim() || saving) return;

    setSaving(true);
    try {
      const { editPost } = await import('../../../app/feed/interactions');
      await editPost(post.id, editContent);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to edit post:', error);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleRepost = async () => {
    if (reposting) return;

    if (reposted) {
      if (!confirm('Remove this repost?')) return;
      setReposting(true);
      try {
        const response = await fetch(`/api/feed/repost/${post.id}`, { method: 'DELETE' });
        if (response.ok) setReposted(false);
        else alert('Failed to remove repost');
      } catch (error) {
        alert('Failed to remove repost');
      } finally {
        setReposting(false);
      }
    } else {
      if (!confirm('Repost this to your followers?')) return;
      setReposting(true);
      try {
        const response = await fetch(`/api/feed/repost/${post.id}`, { method: 'POST' });
        if (response.ok) setReposted(true);
        else {
          const data = await response.json();
          alert(data.error || 'Failed to repost');
        }
      } catch (error) {
        alert('Failed to repost');
      } finally {
        setReposting(false);
      }
    }
  };

  const handleFollow = async () => {
    if (!currentUserId || followLoading) return;

    setFollowLoading(true);
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const response = await fetch(`/api/feed/follow/${post.author.id}`, { method });

      if (response.ok) {
        setIsFollowing(!isFollowing);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update follow status');
      }
    } catch (error) {
      alert('Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      const postUrl = `${window.location.origin}/feed?post=${post.id}`;
      await navigator.clipboard.writeText(postUrl);
      alert('Post link copied to clipboard!');
      setShowShareMenu(false);
    } catch (error) {
      console.error('Failed to copy link:', error);
      alert('Failed to copy link');
    }
  };

  const handleShareTo = (platform: 'twitter' | 'telegram' | 'whatsapp') => {
    const postUrl = `${window.location.origin}/feed?post=${post.id}`;
    const text = `Check out this post: ${post.content.slice(0, 100)}${post.content.length > 100 ? '...' : ''}`;

    let shareUrl = '';
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(postUrl)}`;
        break;
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(text)}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + postUrl)}`;
        break;
    }

    window.open(shareUrl, '_blank');
    setShowShareMenu(false);
  };

  // Format time ago (Twitter style)
  const getTimeAgo = () => {
    if (!mounted) return '';
    const now = new Date();
    const postDate = new Date(post.created_at);
    const diffInSeconds = Math.floor((now.getTime() - postDate.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;

    return postDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Format counts (1000 -> 1K, 1000000 -> 1M)
  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] hover:border-cyan-500/30 transition-all group/post relative overflow-hidden backdrop-blur-sm shadow-lg mb-4">
      {/* Glow Effect on Hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover/post:animate-shimmer pointer-events-none" />

      <div className="flex gap-4 relative z-10">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {post.author.avatar_url ? (
            <img
              src={post.author.avatar_url}
              alt={post.author.username}
              className="w-12 h-12 rounded-full object-cover border-2 border-white/10 ring-2 ring-transparent group-hover/post:ring-cyan-500/30 transition-all"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10 flex items-center justify-center text-gray-400 font-semibold group-hover/post:text-white transition-colors">
              {post.author.username[0]?.toUpperCase()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="font-bold text-white hover:text-cyan-400 transition-colors cursor-pointer truncate">
                  {post.author.username}
                </span>
                {post.author.bluecheck && (
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 22 22" fill="none">
                    <circle cx="11" cy="11" r="11" fill="#39AEC4" />
                    <path
                      d="M6.5 11.5L9.5 14.5L15.5 8.5"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}

                <span className="text-gray-600">·</span>
                <span className="text-gray-500 text-sm">{getTimeAgo()}</span>

                {/* @ts-ignore - edit_count optional */}
                {post.edit_count && post.edit_count > 0 && (
                  <span className="text-gray-600 text-xs">(edited)</span>
                )}

                {!isAuthor && currentUserId && (
                  <button
                    onClick={handleFollow}
                    disabled={followLoading}
                    className={`ml-1 text-xs font-semibold px-2 py-0.5 rounded-full transition-colors flex-shrink-0 ${
                      isFollowing
                        ? 'text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-400'
                        : 'text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 hover:border-cyan-400/50 bg-cyan-500/10'
                    }`}
                  >
                    {followLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>

              <span className="text-gray-500 text-sm">
                @{post.author.username.toLowerCase().replace(/\s/g, '')}
              </span>
            </div>
            <PostMenu
              postId={post.id}
              isAuthor={isAuthor}
              onEdit={() => setIsEditing(true)}
              onDelete={onDelete}
            />
          </div>

          {/* Post Content */}
          {isEditing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-3 bg-black/50 border border-white/10 text-white rounded-xl focus:outline-none focus:border-cyan-500/50 transition-colors font-twitter"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editContent.trim()}
                  className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-bold rounded-full disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(post.content);
                  }}
                  className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-full transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-white text-[15px] leading-normal whitespace-pre-wrap break-words font-twitter">
              {/* Highlight hashtags */}
              {post.content.split(/(\s+)/).map((part, i) => {
                if (part.startsWith('#')) {
                  return (
                    <span key={i} className="text-cyan-400 hover:underline cursor-pointer">
                      {part}
                    </span>
                  );
                }
                return part;
              })}
            </div>
          )}

          {/* Image Grid */}
          {post.image_urls && post.image_urls.length > 0 && (
            <div
              className={`mt-3 grid gap-2 ${
                post.image_urls.length === 1
                  ? 'grid-cols-1'
                  : post.image_urls.length === 2
                    ? 'grid-cols-2'
                    : 'grid-cols-2'
              }`}
            >
              {post.image_urls.map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`Post image ${index + 1}`}
                  className={`rounded-xl border border-white/5 object-cover bg-black/50 ${
                    post.image_urls!.length === 1 ? 'max-h-96 w-full' : 'h-64 w-full'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Engagement Bar */}
          <div className="mt-4 flex items-center justify-between text-gray-500 max-w-sm">
            {/* Comments */}
            <button
              onClick={() => setCommentModalOpen(true)}
              className="group flex items-center gap-1.5 hover:text-cyan-400 transition-colors"
            >
              <div className="p-2 rounded-full group-hover:bg-cyan-500/10 transition-colors">
                <MessageCircle className="w-[18px] h-[18px]" />
              </div>
              <span className="text-sm font-medium">
                {commentCount > 0 ? formatCount(commentCount) : ''}
              </span>
            </button>

            {/* Repost */}
            <button
              onClick={handleRepost}
              disabled={reposting}
              className={`group flex items-center gap-1.5 transition-colors ${
                reposted ? 'text-green-500' : 'hover:text-green-500'
              }`}
            >
              <div
                className={`p-2 rounded-full transition-colors ${reposted ? 'bg-green-500/10' : 'group-hover:bg-green-500/10'}`}
              >
                <Repeat2 className="w-[18px] h-[18px]" />
              </div>
              <span className="text-sm font-medium">{reposting ? '...' : ''}</span>
            </button>

            {/* Like - Custom component needs similar styling update, but for now we rely on its internal styles or update wrapper */}
            <div className="group flex items-center gap-1.5 hover:text-pink-500 transition-colors">
              <LikeButton postId={post.id} initialLiked={post.is_liked} initialCount={post.likes} />
            </div>

            {/* Views */}
            <button className="group flex items-center gap-1.5 hover:text-cyan-400 transition-colors">
              <div className="p-2 rounded-full group-hover:bg-cyan-500/10 transition-colors">
                <BarChart3 className="w-[18px] h-[18px]" />
              </div>
              {/* @ts-ignore - view_count optional */}
              <span className="text-sm font-medium">
                {post.view_count && post.view_count > 0 ? formatCount(post.view_count) : ''}
              </span>
            </button>

            {/* Share */}
            <div className="relative" ref={shareMenuRef}>
              <button
                onClick={() => setShowShareMenu(!showShareMenu)}
                className="group p-2 rounded-full hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors"
              >
                <Share2 className="w-[18px] h-[18px]" />
              </button>

              {/* Share Menu Dropdown */}
              {showShareMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-[#1A1A1A] border border-white/10 rounded-xl shadow-xl py-2 w-48 z-50 backdrop-blur-md">
                  <button
                    onClick={() => handleShareTo('twitter')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    Share to Twitter
                  </button>
                  <button
                    onClick={() => handleShareTo('telegram')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-3"
                  >
                    <Send className="w-4 h-4" />
                    Share to Telegram
                  </button>
                  <button
                    onClick={() => handleShareTo('whatsapp')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    Share to WhatsApp
                  </button>
                  <div className="border-t border-white/5 my-1"></div>
                  <button
                    onClick={handleCopyLink}
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-3"
                  >
                    <Link className="w-4 h-4" />
                    Copy Link
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Comment Modal */}
      <CommentModal
        postId={post.id}
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
      />
    </div>
  );
}
