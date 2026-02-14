'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, Avatar, EmptyState, EmptyIcon, Banner } from '@/components/ui';
import { PageHeader, PageContainer } from '@/components/layout';
import { type Post } from '@/lib/data/feed';
import { createPost } from './actions';
import { useToast } from '@/components/ui';
import { FeedPost } from '@/components/feed/FeedPost';
import { PostComposer } from '@/components/feed/PostComposer';
import { AnimatedBackground } from '@/components/home/figma/AnimatedBackground';

interface FeedClientContentProps {
  initialPosts: Post[];
  userEligible: boolean;
  userProfile?: any;
}

/**
 * Feed Client Content
 *
 * Handles interactive feed UI including post composer
 */
export default function FeedClientContent({
  initialPosts,
  userEligible,
  userProfile,
}: FeedClientContentProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const { showToast } = useToast();

  const handleSubmitPost = async (content: string, imageUrls?: string[]) => {
    try {
      const newPost = await createPost(content, imageUrls);
      setPosts([newPost, ...posts]);
      showToast('success', 'Post published successfully');
    } catch (error) {
      showToast('error', 'Failed to publish post');
      throw error; // Re-throw to let composer handle it
    }
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-cyan-500/30 relative overflow-hidden">
      {/* Animated Background Layer */}
      <AnimatedBackground />

      {/* Subtle Dark Overlay for Readability */}
      <div className="fixed inset-0 bg-black/30 pointer-events-none z-[1]" />

      {/* Content Layer */}
      <div className="relative z-10">
        {/* Custom Header */}
        <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/10">
          <div className="w-full max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 hover:text-white transition-colors">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-[#39AEC4] to-[#756BBA] bg-clip-text text-transparent">
                  Selsi Feed
                </h1>
                <p className="text-xs text-gray-500 font-medium">Community Updates</p>
              </div>
            </div>

            <Link
              href="/profile"
              className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group"
            >
              <span className="text-sm font-medium text-gray-300 group-hover:text-white">
                Profile
              </span>
            </Link>
          </div>
        </div>

        {/* Feed Container */}
        <div className="w-full max-w-4xl mx-auto min-h-screen">
          {/* Info Banner for non-eligible users */}
          {!userEligible && (
            <div className="border-b border-white/10 p-4 bg-white/5">
              <Banner
                type="info"
                message="Want to post on the feed?"
                submessage="Get Blue Check verification to start posting"
                action={{
                  label: 'Get Blue Check',
                  onClick: () => (window.location.href = '/profile/blue-check'),
                }}
              />
            </div>
          )}

          {/* Post Composer */}
          {userEligible && (
            <div className="p-4 md:p-6 border-b border-white/10 bg-black/40 backdrop-blur-sm sticky top-16 z-20">
              <PostComposer
                userProfile={userProfile}
                isEligible={userEligible}
                onSubmit={handleSubmitPost}
              />
            </div>
          )}

          {/* Posts List */}
          <div className="p-4 md:p-6 flex flex-col gap-0 pb-20">
            {posts.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                  <EmptyIcon className="w-8 h-8 text-gray-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">No posts yet</h3>
                <p className="text-gray-400 max-w-sm">
                  Be the first to share something with the community!
                </p>
              </div>
            ) : (
              posts.map((post) => (
                <FeedPost
                  key={post.id}
                  post={post}
                  currentUserId={userProfile?.id}
                  onDelete={async () => {
                    setPosts(posts.filter((p) => p.id !== post.id));
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
