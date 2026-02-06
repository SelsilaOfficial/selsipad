import Link from 'next/link';
import NextImage from 'next/image';
import { PageContainer } from '@/components/layout';
import { HomeHeader } from '@/components/home/HomeHeader';
import { PageBackground } from '@/components/home/PageBackground';
import { MainGrid } from '@/components/home/MainGrid';
import { PortfolioWidget } from '@/components/home/PortfolioWidget';
import { TrendingWidget } from '@/components/home/TrendingWidget';

export default async function HomePage() {
  // Fetch trending tokens server-side
  let topTrending = null;
  let trendingProject = null;

  try {
    const trendingResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/feed/trending`, {
      cache: 'no-store'
    });
    
    if (trendingResponse.ok) {
      const trendingData = await trendingResponse.json();
      const trendingTokens = trendingData?.trending || [];
      topTrending = trendingTokens.length > 0 ? trendingTokens[0] : null;

      // Try to find matching project if trending
      if (topTrending) {
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = createClient();
        const symbol = topTrending.hashtag.replace('#', '').toUpperCase();
        
        const { data: projects } = await supabase
          .from('launch_rounds')
          .select('id, params, round_type')
          .ilike('params->token_symbol', symbol)
          .limit(1);
        
        if (projects && projects.length > 0) {
          trendingProject = projects[0];
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch trending data:', err);
  }

  return (
    <div className="min-h-screen relative font-sans selection:bg-indigo-500/30">
      <PageBackground />
      
      {/* New Header (replaces old header) */}
      <HomeHeader />

      <main className="relative pt-20 pb-24">
        <PageContainer>
          
          {/* Hero / Welcome Section (Replaces 'Run Node') */}
          <div className="flex flex-col items-center justify-center mt-6 mb-12 relative z-10">
             <div className="relative group cursor-pointer">
               {/* 3D Logo Glow */}
               <div className="absolute -inset-4 bg-indigo-500/20 rounded-full blur-xl group-hover:bg-indigo-500/30 transition-all duration-500" />
               
               <NextImage 
                 src="/assets/selsipad-logo.png" 
                 alt="Selsipad Logo" 
                 width={96} 
                 height={96} 
                 className="w-24 h-24 object-contain relative z-10 drop-shadow-[0_0_25px_rgba(255,255,255,0.15)] group-hover:scale-105 transition-transform duration-500"
               />
             </div>
             
             <div className="mt-6 text-center space-y-1">
               <h1 className="text-3xl font-bold text-white tracking-tight">Selsipad</h1>
               <p className="text-sm text-indigo-400 font-medium">The Multi-Chain Launchpad</p>
             </div>
          </div>

          {/* Main Ecosystem Grid */}
          <div className="mb-8 relative z-10">
            <MainGrid />
          </div>

          {/* Widgets Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 px-4 relative z-10">
            <TrendingWidget trendingToken={topTrending} trendingProject={trendingProject} />
            <PortfolioWidget />
          </div>

          {/* Footer Disclaimer */}
          <div className="mt-16 pt-10 border-t border-white/5 pb-10 relative z-10">
            <p className="text-center text-xs text-gray-600 max-w-3xl mx-auto leading-relaxed">
              <span className="font-semibold text-gray-500">Disclaimer:</span> Selsipad provides a decentralized platform for project launches. 
              We do not endorse any specific project. All investments carry risk. 
              Please <a href="https://academy.binance.com/en" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-400 transition-colors">DYOR</a> before interacting with any protocol.
            </p>
          </div>

        </PageContainer>
      </main>
    </div>
  );
}
