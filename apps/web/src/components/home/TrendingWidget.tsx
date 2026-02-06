'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { TrendingUp, ExternalLink, Activity } from 'lucide-react';

interface TrendingWidgetProps {
  trendingToken: any;
  trendingProject: any;
}

export function TrendingWidget({ trendingToken, trendingProject }: TrendingWidgetProps) {
  // If no trending data, show generic "Market Active" state or placeholder
  if (!trendingToken) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        className="glass-card rounded-2xl p-5 relative overflow-hidden group min-h-[140px] flex flex-col justify-between"
      >
        <div className="flex justify-between items-start">
           <div>
             <h3 className="text-gray-400 text-sm font-medium mb-1">Trending Presale</h3>
             <span className="text-white font-bold text-lg">Market Quiet</span>
           </div>
           <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
             <Activity className="w-4 h-4 text-gray-500" />
           </div>
        </div>
        
        <p className="text-xs text-gray-500 mt-2">No active trends right now. Be the first!</p>
        
        <Link href="/feed" className="mt-4 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
          Check Feed <ExternalLink className="w-3 h-3" />
        </Link>
      </motion.div>
    );
  }

  const tokenSymbol = trendingToken.hashtag.replace('#', '').toUpperCase();
  const buzzScore = trendingToken.score || 0;
  
  const CardContent = (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5 }}
      className="glass-card rounded-2xl p-5 relative overflow-hidden group min-h-[140px] flex flex-col justify-between hover:border-indigo-500/20 transition-colors"
    >
      <div className="flex justify-between items-start z-10 relative">
        <div className="flex items-center gap-3">
          {/* Token Icon Placeholder */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
             {tokenSymbol[0]}
          </div>
          <div>
            <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-0.5">Trending #1</h3>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-lg">{trendingToken.hashtag}</span>
              {/* Fake Graph Line if we wanted, or just status */}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end">
           <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
             <TrendingUp className="w-3 h-3" />
             Hot
           </div>
        </div>
      </div>

      <div className="mt-4 z-10 relative">
         <div className="flex justify-between items-end">
            <div>
               <div className="text-xs text-gray-500 mb-1">Buzz Score</div>
               <div className="text-indigo-300 font-mono font-medium">{buzzScore.toLocaleString()}</div>
            </div>
            
            {/* Soft CTA */}
            <span className="text-xs text-white/50 group-hover:text-white transition-colors flex items-center gap-1">
              View Details <ExternalLink className="w-3 h-3" />
            </span>
         </div>
         
         {/* Progress Bar Simulation */}
         <div className="mt-3 w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 w-[85%]" />
         </div>
      </div>

      {/* Decorative Chart BG */}
      <svg className="absolute bottom-0 right-0 w-full h-24 opacity-10 pointer-events-none text-indigo-500" viewBox="0 0 100 40" preserveAspectRatio="none">
        <path d="M0 40 L0 30 Q10 25 20 32 T40 25 T60 15 T80 20 T100 5 L100 40 Z" fill="currentColor" />
      </svg>
    </motion.div>
  );

  if (trendingProject) {
    return <Link href={`/fairlaunch/${trendingProject.id}`} className="block h-full">{CardContent}</Link>;
  }

  return (
      <Link href="/feed" className="block h-full">
         {CardContent}
      </Link>
  );
}
