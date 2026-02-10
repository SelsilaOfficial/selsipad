'use client';

import React from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

const data = [
  { value: 30 },
  { value: 45 },
  { value: 38 },
  { value: 55 },
  { value: 48 },
  { value: 62 },
  { value: 58 },
  { value: 72 },
  { value: 68 },
  { value: 85 },
  { value: 78 },
  { value: 92 },
];

export function TrendingChart() {
  return (
    <div className="w-full" style={{ height: '200px' }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#39AEC4"
            strokeWidth={2}
            dot={false}
            animationDuration={1000}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
