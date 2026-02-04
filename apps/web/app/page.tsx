import Link from 'next/link';
import NextImage from 'next/image';
import { PageContainer } from '@/components/layout';
import { MultiChainConnectWallet } from '@/components/wallet/MultiChainConnectWallet';
import { HeroSection } from '@/components/home/HeroSection';
import { FeatureGrid } from '@/components/home/FeatureGrid';
import { TrendingBanner } from '@/components/home/TrendingBanner';
import { PageBackground } from '@/components/home/PageBackground';

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
    <div className="min-h-screen bg-bg-page relative font-sans selection:bg-indigo-500/30">
      <PageBackground />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-lg border-b border-white/5 safe-top transition-all duration-300">
        <PageContainer>
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="relative group">
               <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent group-hover:opacity-80 transition-opacity">
                SELSIPAD
              </h1>
            </Link>

            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="relative group overflow-hidden rounded-full border border-white/10 hover:border-indigo-500/50 transition-colors"
                aria-label="Profile"
              >
                <NextImage 
                  src="/assets/user-avatar-3d.png" 
                  alt="Profile" 
                  width={36} 
                  height={36} 
                  className="w-9 h-9 object-cover group-hover:scale-110 transition-transform duration-300"
                />
              </Link>
              <MultiChainConnectWallet />
            </div>
          </div>
        </PageContainer>
      </header>

      <main className="relative pb-24">
        <HeroSection />
        
        <PageContainer className="space-y-24">
          <div className="-mt-12 relative z-20">
             <TrendingBanner trendingToken={topTrending} trendingProject={trendingProject} />
          </div>
          
          <FeatureGrid />
          
          {/* Footer Disclaimer */}
          <div className="pt-10 border-t border-white/5 pb-10">
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
