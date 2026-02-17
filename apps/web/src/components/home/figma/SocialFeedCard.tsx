'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Heart, MessageCircle, Share2, Loader2, BadgeCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { getFeedPosts, type Post } from '@/lib/data/feed';
import { createClient } from '@/lib/supabase/client';
import { formatDistance } from 'date-fns';
import Link from 'next/link';

const MAX_HOMEPAGE_POSTS = 5;

export function SocialFeedCard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);

  // Initial fetch
  useEffect(() => {
    const loadPosts = async () => {
      try {
        const data = await getFeedPosts();
        setPosts(data.slice(0, MAX_HOMEPAGE_POSTS));
      } catch (error) {
        console.error('Failed to load feed posts', error);
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, []);

  // Real-time subscription for new posts + comments
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('homepage-feed-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
        },
        async (payload) => {
          // A new post was created — fetch its author profile to display properly
          const newRow = payload.new as any;
          if (!newRow?.id || newRow.deleted_at) return;

          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('user_id, username, avatar_url, bluecheck_status')
              .eq('user_id', newRow.author_id)
              .single();

            const newPost: Post = {
              id: newRow.id,
              author: {
                id: newRow.author_id,
                username: profile?.username || 'Anonymous',
                avatar_url: profile?.avatar_url,
                bluecheck:
                  profile?.bluecheck_status === 'ACTIVE' ||
                  profile?.bluecheck_status === 'VERIFIED',
              },
              content: newRow.content || '',
              project_id: newRow.project_id,
              type: (newRow.type || 'TEXT').toLowerCase() as Post['type'],
              created_at: newRow.created_at,
              likes: 0,
              replies: 0,
              is_liked: false,
              image_urls: newRow.image_urls || [],
              hashtags: newRow.hashtags || [],
            };

            // Mark as new for animation, clear after 3s
            setNewPostIds((prev) => new Set(prev).add(newPost.id));
            setTimeout(() => {
              setNewPostIds((prev) => {
                const next = new Set(prev);
                next.delete(newPost.id);
                return next;
              });
            }, 3000);

            // Prepend and keep max 5
            setPosts((prev) => {
              if (prev.some((p) => p.id === newPost.id)) return prev;
              return [newPost, ...prev].slice(0, MAX_HOMEPAGE_POSTS);
            });
          } catch (err) {
            console.error('[SocialFeedCard] Failed to process new post:', err);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_comments',
        },
        (payload) => {
          // A new comment was created — increment reply count on matching post
          const newComment = payload.new as any;
          if (!newComment?.post_id) return;

          setPosts((prev) =>
            prev.map((p) =>
              p.id === newComment.post_id ? { ...p, replies: (p.replies || 0) + 1 } : p
            )
          );
        }
      )
      .subscribe();

    channelRef.current = channel as any;

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Card className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 shadow-xl shadow-[#756BBA]/10">
      <CardHeader className="flex flex-row items-center justify-between mb-0 pb-2 sm:mb-2 sm:pb-4 p-5 sm:p-8">
        <CardTitle className="text-xl sm:text-2xl font-semibold text-white">Selsi Feed</CardTitle>
        <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-[#39AEC4]" />
      </CardHeader>

      <CardContent className="space-y-3 sm:space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#39AEC4]/30 scrollbar-track-transparent p-5 sm:p-8 pt-0 sm:pt-0">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 text-[#39AEC4] animate-spin" />
          </div>
        ) : posts.length > 0 ? (
          posts.map((post) => (
            <Link key={post.id} href={`/feed/post/${post.id}`} className="block">
              <div
                className={`rounded-[20px] bg-gradient-to-br from-[#39AEC4]/10 to-[#39AEC4]/5 border p-4 hover:border-[#39AEC4]/40 hover:bg-[#39AEC4]/10 transition-all cursor-pointer ${
                  newPostIds.has(post.id)
                    ? 'border-[#39AEC4]/60 shadow-[0_0_12px_rgba(57,174,196,0.3)] animate-pulse'
                    : 'border-[#39AEC4]/20'
                }`}
              >
                {/* User Info */}
                <div className="flex items-center gap-3 mb-2">
                  {post.author.avatar_url ? (
                    <img
                      src={post.author.avatar_url}
                      alt={post.author.username}
                      className="w-10 h-10 rounded-full object-cover border border-[#39AEC4]/30"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#39AEC4]/20 flex items-center justify-center text-[#39AEC4] font-bold border border-[#39AEC4]/30">
                      {post.author.username.substring(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-bold text-[#39AEC4] font-twitter">
                        @{post.author.username}
                      </p>
                      {post.author.bluecheck && (
                        <BadgeCheck className="w-4 h-4 text-[#39AEC4] fill-[#39AEC4]/20 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatDistance(new Date(post.created_at), new Date(), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {/* Content */}
                <p className="text-gray-100 mb-3 whitespace-pre-wrap line-clamp-3 text-[15px] leading-normal font-twitter">
                  {post.content}
                </p>

                {/* Project Tag */}
                {post.project_name && (
                  <div className="mb-3">
                    <span className="text-xs bg-[#39AEC4]/10 text-[#39AEC4] px-2 py-1 rounded-full border border-[#39AEC4]/20">
                      🏷️ {post.project_name}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-4 text-xs sm:text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Heart className="w-4 h-4" fill={post.is_liked ? 'currentColor' : 'none'} />
                    <span>{post.likes}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-4 h-4" />
                    <span>{post.replies}</span>
                  </span>
                  <span className="flex items-center gap-1 ml-auto">
                    <Share2 className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center py-10 text-gray-400">No posts yet. Be the first to post!</div>
        )}

        {/* View All Button */}
        <Link href="/feed" className="block mt-4 sm:mt-6">
          <Button className="w-full py-6 rounded-[20px] bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:from-[#4EABC8] hover:to-[#756BBA] transition-all shadow-lg shadow-[#756BBA]/50 font-semibold text-sm sm:text-base text-white border-0">
            View All Posts
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
