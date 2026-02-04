'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { TrendingUp, MessageSquare } from 'lucide-react';

interface TrendingBannerProps {
  trendingToken: any;
  trendingProject: any;
}

export function TrendingBanner({ trendingToken, trendingProject }: TrendingBannerProps) {
  if (!trendingToken) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/5 p-6 md:p-8 backdrop-blur-xl group hover:bg-white/[0.04] transition-colors"
      >
        <div className="flex flex-col items-center justify-center text-center gap-3">
          <div className="p-3 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
            <TrendingUp className="w-6 h-6 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-300">No Trending Tokens Yet</h3>
            <p className="text-sm text-gray-500 mt-1">Start a conversation on SelsiFeed to set the trend!</p>
          </div>
          <Link href="/feed">
            <button className="mt-2 px-4 py-2 text-sm font-medium text-indigo-400 bg-indigo-500/10 rounded-full hover:bg-indigo-500/20 transition-colors">
              Go to Feed
            </button>
          </Link>
        </div>
      </motion.div>
    );
  }

  const BannerContent = (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950/40 to-slate-950/40 border border-indigo-500/20 p-6 md:p-10 backdrop-blur-xl group hover:border-indigo-500/40 transition-all duration-500"
    >
      {/* Background Glow */}
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-indigo-500/20 rounded-full blur-[100px] group-hover:bg-indigo-500/30 transition-colors" />

      <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
        {/* Hashtag Block */}
        <div className="shrink-0 relative">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-2xl group-hover:scale-105 transition-transform duration-500">
            <span className="text-4xl md:text-5xl font-black text-white drop-shadow-lg">#</span>
          </div>
          <div className="absolute -bottom-3 -right-3 px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold shadow-lg flex items-center gap-1 animate-pulse">
            🔥 #1 Trending
          </div>
        </div>

        {/* Info & Stats */}
        <div className="flex-1 text-center md:text-left w-full space-y-4">
          <div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-2">
              {trendingToken.hashtag}
            </h2>
            <p className="text-indigo-200/80 font-medium text-lg">
              Dominated the conversation with <span className="text-white font-bold">{trendingToken.score}</span> buzz points.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
            <div className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-bold text-white">{trendingToken.post_count_24h}</span>
              <span className="text-xs text-gray-500 uppercase font-medium">Posts</span>
            </div>
            <div className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-sm font-bold text-white">#{trendingToken.rank}</span>
              <span className="text-xs text-gray-500 uppercase font-medium">Rank</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  if (trendingProject) {
    return <Link href={`/fairlaunch/${trendingProject.id}`} className="block w-full">{BannerContent}</Link>;
  }

  return BannerContent;
}
