'use client';

import Link from 'next/link';

import { PageContainer } from '@/components/layout';
import { ArrowLeft, Rocket, Zap, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

const CREATE_OPTIONS = [
  {
    id: 'presale',
    title: 'Create Presale',
    description: 'Standard ICO with Softcap/Hardcap.',
    icon: <Rocket className="w-10 h-10 text-blue-500" />,
    href: '/create/presale',
    color: 'bg-blue-500/10 border-blue-500/20 hover:border-blue-500',
  },
  {
    id: 'fairlaunch',
    title: 'Create Fairlaunch',
    description: 'Fair distribution. No hardcap. 100% Liquidity.',
    icon: <Zap className="w-10 h-10 text-purple-500" />,
    href: '/create/fairlaunch',
    color: 'bg-purple-500/10 border-purple-500/20 hover:border-purple-500',
  },
  {
    id: 'bonding',
    title: 'Create Bonding Curve',
    description: 'Permissionless instant trading pools.',
    icon: <TrendingUp className="w-10 h-10 text-pink-500" />,
    href: '/create/bonding-curve',
    color: 'bg-pink-500/10 border-pink-500/20 hover:border-pink-500',
  },
];

export default function CreateHubPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-cyan-500/30">
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-white">Create Project</h1>
        </div>
      </div>

      <PageContainer className="py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">Choose Your Launch Path</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Select the best funding model for your project. From standard presales to fair launches
            and instant bonding curves.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CREATE_OPTIONS.map((option) => (
            <Link key={option.id} href={option.href} className="group">
              <div
                className={`h-full border border-white/10 rounded-2xl p-6 bg-white/5 hover:bg-white/10 transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] relative overflow-hidden`}
              >
                <div
                  className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity ${option.color.split(' ')[0]}`}
                />

                <div className="flex flex-col items-center text-center space-y-6 relative z-10">
                  <div className="p-4 rounded-full bg-black/50 border border-white/10 group-hover:border-white/20 transition-colors">
                    {option.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{option.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{option.description}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </PageContainer>
    </div>
  );
}
