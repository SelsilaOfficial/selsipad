import { Project } from '@/lib/data/projects';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'; // Integrating Recharts if user wants visual WOW, but I should check if installed.
// Recharts might be heavy or not installed. I'll stick to CSS bars for now as per "Vanila CSS" preference unless requested otherwise, but "modern web design" suggests charts.
// I'll use simple progress bars first to be safe and fast, or a detailed breakdown.
// Actually, simple circular chart or bars are better.

// Let's use a beautiful list with progress bars.

interface TokenomicsSectionProps {
  tokenomics: Project['tokenomics'];
  symbol: string;
  currency: string;
}

export default function TokenomicsSection({
  tokenomics,
  symbol,
  currency,
}: TokenomicsSectionProps) {
  if (!tokenomics || !tokenomics.total_supply) {
    return (
      <div className="p-8 text-center text-gray-500 bg-white/5 rounded-3xl border border-white/10">
        Tokenomics data not available.
      </div>
    );
  }

  const { total_supply, tokens_for_presale, tokens_for_liquidity, team_allocation } = tokenomics;

  // Calculate percentages
  const presalePercent = (tokens_for_presale / total_supply) * 100;
  const liquidityPercent = (tokens_for_liquidity / total_supply) * 100;
  const teamPercent = (team_allocation / total_supply) * 100;
  const otherPercent = 100 - (presalePercent + liquidityPercent + teamPercent);

  const items = [
    {
      label: 'Presale',
      value: tokens_for_presale,
      percent: presalePercent,
      color: 'bg-cyan-500',
      textColor: 'text-cyan-400',
    },
    {
      label: 'Liquidity',
      value: tokens_for_liquidity,
      percent: liquidityPercent,
      color: 'bg-purple-500',
      textColor: 'text-purple-400',
    },
    {
      label: 'Team Vesting',
      value: team_allocation,
      percent: teamPercent,
      color: 'bg-orange-500',
      textColor: 'text-orange-400',
    },
  ];

  if (otherPercent > 0.1) {
    items.push({
      label: 'Unlocked/Other',
      value: total_supply * (otherPercent / 100),
      percent: otherPercent,
      color: 'bg-gray-600',
      textColor: 'text-gray-400',
    });
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Visual Bar Representation */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-white mb-4">Allocation Breakdown</h3>
          <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden flex">
            {items.map((item, i) => (
              <div
                key={i}
                className={`h-full ${item.color}`}
                style={{ width: `${item.percent}%` }}
                title={`${item.label}: ${item.percent.toFixed(1)}%`}
              />
            ))}
          </div>

          <div className="space-y-3">
            {items.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-gray-300 font-medium">{item.label}</span>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${item.textColor}`}>
                    {item.value.toLocaleString()} {symbol}
                  </div>
                  <div className="text-xs text-gray-500">{item.percent.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="bg-[#0A0A0C]/40 border border-white/10 rounded-3xl p-6 space-y-6">
          <div>
            <div className="text-sm text-gray-500 uppercase tracking-wider mb-1">Total Supply</div>
            <div className="text-3xl font-bold text-white">
              {total_supply.toLocaleString()}{' '}
              <span className="text-lg text-gray-500">{symbol}</span>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10">
            <div className="text-sm text-gray-400 mb-2">Details</div>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex justify-between">
                <span>Soft Cap</span>
                <span className="text-white">
                  {(tokenomics as any).softcap || 'N/A'} {currency}
                </span>
              </li>
              <li className="flex justify-between">
                <span>Liquidity Percent</span>
                <span className="text-white">{tokenomics.liquidity_percent}%</span>
              </li>
              <li className="flex justify-between">
                <span>Lockup Time</span>
                <span className="text-white">
                  {(tokenomics as any).lp_lock_months || 12} Months
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
