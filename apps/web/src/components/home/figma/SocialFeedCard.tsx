'use client';

import React, { useEffect, useState } from 'react';
import { Heart, MessageCircle, Share2, Loader2, BadgeCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { getFeedPosts, type Post } from '@/lib/data/feed';
import { formatDistance } from 'date-fns';
import Link from 'next/link';

export function SocialFeedCard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const data = await getFeedPosts();
        // Take only the first 5 posts for the homepage widget to save space/bandwidth
        setPosts(data.slice(0, 5));
      } catch (error) {
        console.error('Failed to load feed posts', error);
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
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
              <div className="rounded-[20px] bg-gradient-to-br from-[#39AEC4]/10 to-[#39AEC4]/5 border border-[#39AEC4]/20 p-4 hover:border-[#39AEC4]/40 hover:bg-[#39AEC4]/10 transition-all cursor-pointer">
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
