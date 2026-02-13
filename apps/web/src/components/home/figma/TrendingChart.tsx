'use client';

import React from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip } from 'recharts';

interface TrendingChartProps {
  data?: { value: number; label?: string }[];
}

const fallbackData = [
  { value: 0, label: 'Mon' },
  { value: 0, label: 'Tue' },
  { value: 0, label: 'Wed' },
  { value: 0, label: 'Thu' },
  { value: 0, label: 'Fri' },
  { value: 0, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black/80 backdrop-blur-sm border border-[#39AEC4]/30 rounded-lg px-3 py-2 text-xs">
        <p className="text-gray-400">{label || ''}</p>
        <p className="text-[#39AEC4] font-bold">{payload[0].value} posts</p>
      </div>
    );
  }
  return null;
}

export function TrendingChart({ data }: TrendingChartProps) {
  const chartData = data && data.length > 0 ? data : fallbackData;
  const hasData = chartData.some((d) => d.value > 0);

  if (!hasData) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height: '200px' }}>
        <p className="text-gray-500 text-sm">No activity data yet</p>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: '200px' }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={chartData}>
          <defs>
            <linearGradient id="trendingGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#39AEC4" />
              <stop offset="100%" stopColor="#756BBA" />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#6b7280' }}
          />
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="url(#trendingGradient)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: '#39AEC4', stroke: '#39AEC4', strokeWidth: 2 }}
            animationDuration={1000}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
