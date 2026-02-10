'use client';

import React from 'react';
import { TrendingUp, ArrowUpRight } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface BondingCurveProject {
  id: number;
  name: string;
  symbol: string;
  currentPrice: string;
  priceChange: string;
  marketCap: string;
  progress: number;
  trend: 'up' | 'down';
  chartData: { value: number }[];
}

const mockProjects: BondingCurveProject[] = [];

export function TrendingBondingCurveCard() {
  const hasProjects = mockProjects.length > 0;

  return (
    <Card className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 shadow-xl shadow-[#756BBA]/10">
      <CardHeader className="flex flex-row items-center justify-between p-5 sm:p-8">
        <CardTitle className="text-xl sm:text-2xl font-semibold text-white">
          Trending Bonding Curves
        </CardTitle>
        <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-[#39AEC4]" />
      </CardHeader>

      {hasProjects && (
        <CardContent className="space-y-3 sm:space-y-4 p-5 sm:p-8 pt-0 sm:pt-0">
          {mockProjects.map((project, index) => (
            <div
              key={project.id}
              className="rounded-[20px] bg-gradient-to-br from-[#39AEC4]/10 to-[#39AEC4]/5 border border-[#39AEC4]/20 p-4 hover:border-[#39AEC4]/40 transition-all group"
            >
              <div className="flex items-start gap-3 sm:gap-4">
                {/* Rank Badge */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-[#39AEC4]/30 to-[#39AEC4]/10 border border-[#39AEC4]/40 flex items-center justify-center">
                  <span className="text-sm font-bold text-[#39AEC4]">#{index + 1}</span>
                </div>

                {/* Project Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-base sm:text-lg">{project.name}</h3>
                      <p className="text-xs sm:text-sm text-gray-400">${project.symbol}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm sm:text-base">{project.currentPrice}</p>
                      <p className="text-xs sm:text-sm text-green-400 flex items-center justify-end gap-1">
                        <ArrowUpRight className="w-3 h-3" />
                        {project.priceChange}
                      </p>
                    </div>
                  </div>

                  {/* Mini Chart */}
                  <div className="w-full" style={{ height: '48px' }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <AreaChart data={project.chartData}>
                        <defs>
                          <linearGradient id={`gradient-${project.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#39AEC4" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#39AEC4" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#39AEC4"
                          strokeWidth={2}
                          fill={`url(#gradient-${project.id})`}
                          animationDuration={1000}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs sm:text-sm text-gray-400 mb-1">
                      <span>Bonding Progress</span>
                      <span className="text-[#39AEC4] font-semibold">{project.progress}%</span>
                    </div>
                    <div className="h-2 bg-gray-800/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#39AEC4] to-[#756BBA] rounded-full transition-all duration-500"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Market Cap */}
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-gray-400">Market Cap</span>
                    <span className="text-gray-200 font-semibold">{project.marketCap}</span>
                  </div>
                </div>
              </div>

              {/* CTA Button - Shows on hover */}
              <Button
                variant="ghost"
                className="mt-3 w-full px-4 py-2 rounded-[20px] bg-gradient-to-r from-[#39AEC4]/20 to-[#756BBA]/20 border border-[#39AEC4]/30 hover:from-[#39AEC4] hover:to-[#756BBA] transition-all text-sm font-semibold opacity-0 group-hover:opacity-100 hover:text-white"
              >
                View Bonding Curve
              </Button>
            </div>
          ))}

          {/* View All Button */}
          <Button className="mt-4 sm:mt-6 w-full py-6 rounded-[20px] bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:from-[#4EABC8] hover:to-[#756BBA] transition-all shadow-lg shadow-[#756BBA]/50 font-semibold text-sm sm:text-base text-white border-0">
            Explore All Projects
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
