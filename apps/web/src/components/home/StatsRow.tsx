'use client';

export function StatsRow() {
  const stats = [
    { label: 'MARKET CAP', value: '$1.2B' },
    { label: 'CIRCULATING SUPPLY', value: '450M' },
    { label: '24H VOLUME', value: '$84M' },
    { label: 'ACTIVE PROJECTS', value: '12' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className="bg-white/[0.02] backdrop-blur-xl border border-white/10 p-6 rounded-2xl"
        >
          <div className="text-xs font-semibold text-gray-500 mb-1 tracking-wider">
            {stat.label}
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{stat.value}</div>
        </div>
      ))}
    </div>
  );
}
