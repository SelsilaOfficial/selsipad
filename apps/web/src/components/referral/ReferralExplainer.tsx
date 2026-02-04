'use client';

import { Gift, TrendingUp, Shield, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';

export function ReferralExplainer() {
  return (
    <div className="space-y-4">
      {/* How It Works */}
      <Card className="border-gray-800">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold">How It Works</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div>
                <p className="text-sm text-gray-300">Share your referral code or link with friends</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <p className="text-sm text-gray-300">They sign up and make their first contribution</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div>
                <p className="text-sm text-gray-300">You earn rewards from their contribution fees!</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reward Breakdown */}
      <Card className="border-gray-800">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <h3 className="text-lg font-bold">Reward Breakdown</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Presale/Fairlaunch</span>
              <span className="text-sm font-bold text-green-400">30% of 5% fee</span>
            </div>
            <div className="border-t border-gray-800"></div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Bonding Curve</span>
              <span className="text-sm font-bold text-green-400">50% of 1.5% fee</span>
            </div>
            <div className="border-t border-gray-800"></div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Blue Check Badge</span>
              <span className="text-sm font-bold text-green-400">30% of $10</span>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-950/30 rounded-lg border border-blue-800/30">
            <p className="text-xs text-blue-300">
              <Gift className="w-3 h-3 inline mr-1" />
              Example: Your referral contributes $100 to a Fairlaunch.
              You earn: $100 × 5% × 30% = <strong>$1.50</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Claiming Requirements */}
      <Card className="border-gray-800 bg-gradient-to-br from-purple-950/30 to-pink-950/30">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-bold">Claiming Requirements</h3>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-purple-400 mt-2"></div>
              <p className="text-sm text-gray-300">Active Blue Check badge required</p>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-purple-400 mt-2"></div>
              <p className="text-sm text-gray-300">Minimum 1 active referral</p>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-purple-400 mt-2"></div>
              <p className="text-sm text-gray-300">Rewards auto-processed every 24h</p>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-purple-900/20 rounded-lg border border-purple-700/30">
            <p className="text-xs text-gray-400">
              💡 Get Blue Check badge to unlock reward claiming
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
