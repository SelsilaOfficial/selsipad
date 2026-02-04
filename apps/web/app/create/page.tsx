'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui';
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
    <PageContainer className="py-8">
      <div className="mb-8">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-text-secondary hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <h1 className="text-3xl font-bold text-white">Create Project</h1>
        <p className="text-gray-400 mt-2">Choose the best launch method for your token.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {CREATE_OPTIONS.map((option) => (
          <Link key={option.id} href={option.href} className="group">
            <Card className={`h-full border transition-all duration-300 ${option.color} group-hover:scale-[1.02]`}>
              <CardContent className="flex flex-col items-center text-center p-8 h-full justify-center space-y-4">
                <div className="p-4 rounded-full bg-gray-900/50 group-hover:bg-gray-900 transition-colors">
                  {option.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">{option.title}</h3>
                  <p className="text-sm text-gray-400">{option.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}
