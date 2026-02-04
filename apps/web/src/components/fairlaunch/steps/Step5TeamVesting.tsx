import { Users, Plus, Trash2, AlertCircle, Calculator, PieChart } from 'lucide-react';
import { useState } from 'react';
import { formatUnits } from 'viem';

interface Step5Props {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
  errors: any;
}

export function Step5TeamVesting({ data, updateData, onNext, onBack, errors }: Step5Props) {
  const vestingSchedule = data.team_vesting?.schedule || [];
  const [vestingMonths, setVestingMonths] = useState(1); // For calculator

  // Token Math
  // Sanitize supply (remove commas if present)
  const rawSupply = (data.step1?.token_supply || '0').toString().replace(/,/g, '');
  const totalSupply = parseFloat(rawSupply);
  
  const tokensForSale = parseFloat((data.params?.tokens_for_sale || '0').toString().replace(/,/g, ''));
  const liquidityPercent = data.liquidity?.liquidity_percent || 0;
  
  // Formula: Required = Sale + (Sale * Liq%)
  const tokensForLiquidity = tokensForSale * (liquidityPercent / 100);
  const totalRequiredForPresale = tokensForSale + tokensForLiquidity;
  const remainingTokens = Math.max(0, totalSupply - totalRequiredForPresale);

  const formatNumber = (num: number) => {
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const handleAddVesting = () => {
    updateData({
      team_vesting: {
        ...data.team_vesting,
        schedule: [...vestingSchedule, { month: 1, percentage: 0 }]
      }
    });
  };

  const handleAutoCaculate = () => {
    if (vestingMonths <= 0) return;
    
    // Distribute 100% evenly across months
    const perMonth = parseFloat((100 / vestingMonths).toFixed(2));
    const schedule = [];
    let currentTotal = 0;

    for (let i = 1; i <= vestingMonths; i++) {
        let pct = perMonth;
        // Adjust last month to ensure exactly 100%
        if (i === vestingMonths) {
            pct = parseFloat((100 - currentTotal).toFixed(2));
        }
        schedule.push({ month: i, percentage: pct });
        currentTotal += pct;
    }

    updateData({
        team_vesting: { ...data.team_vesting, schedule }
    });
  };

  const handleRemoveVesting = (index: number) => {
    const newSchedule = [...vestingSchedule];
    newSchedule.splice(index, 1);
    updateData({
      team_vesting: { ...data.team_vesting, schedule: newSchedule }
    });
  };

  const handleUpdateVesting = (index: number, field: string, value: number) => {
    const newSchedule = [...vestingSchedule];
    newSchedule[index] = { ...newSchedule[index], [field]: value };
    updateData({
      team_vesting: { ...data.team_vesting, schedule: newSchedule }
    });
  };

  const totalPercentage = vestingSchedule.reduce((sum: number, item: any) => sum + (item.percentage || 0), 0);
  // Allow small float error (99.99 - 100.01)
  const isValid = Math.abs(totalPercentage - 100) < 0.1;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="md:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              Team Vesting
            </h3>

            {/* Calculator Section */}
            <div className="bg-indigo-950/30 border border-indigo-900/50 rounded-xl p-4 mb-6">
                <h4 className="text-sm font-semibold text-indigo-300 flex items-center gap-2 mb-3">
                    <Calculator className="w-4 h-4" /> Quick Calculator
                </h4>
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-xs text-indigo-200 mb-1">Vest remaining tokens over:</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                value={vestingMonths}
                                onChange={(e) => setVestingMonths(parseInt(e.target.value))}
                                className="w-full px-3 py-2 bg-gray-900 border border-indigo-800/50 rounded text-white text-sm"
                                min={1}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">Months</span>
                        </div>
                    </div>
                    <button 
                        onClick={handleAutoCaculate}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition"
                    >
                        Auto-Fill Schedule
                    </button>
                </div>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {vestingSchedule.length === 0 && (
                  <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-800 rounded-lg">
                      No vesting periods defined. Use the calculator or add manually below.
                  </div>
              )}
              {vestingSchedule.map((item: any, index: number) => (
                <div key={index} className="flex gap-4 items-center bg-gray-800/50 p-4 rounded-lg border border-gray-700 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Release Month</label>
                      <div className="relative">
                          <input
                            type="number"
                            value={item.month}
                            onChange={(e) => handleUpdateVesting(index, 'month', parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white font-mono"
                            min={1}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">Month</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Percentage %</label>
                      <div className="relative">
                          <input
                            type="number"
                            value={item.percentage}
                            onChange={(e) => handleUpdateVesting(index, 'percentage', parseFloat(e.target.value))}
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white font-mono"
                            min={0}
                            max={100}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">%</span>
                      </div>
                    </div>
                    <div className="flex-1 text-right">
                         <label className="block text-xs font-medium text-gray-500 mb-1">Tokens Released</label>
                         <span className="text-sm font-mono text-indigo-300">
                             {formatNumber(remainingTokens * (item.percentage / 100))}
                         </span>
                    </div>
                    <button
                      onClick={() => handleRemoveVesting(index)}
                      className="p-2 text-red-400 hover:bg-red-900/20 rounded mb-0.5"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                </div>
              ))}
            </div>

            <button
              onClick={handleAddVesting}
              className="w-full py-3 border border-dashed border-gray-600 text-gray-400 hover:border-gray-500 hover:text-white rounded-lg transition flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Manual Period
            </button>

            <div className="flex justify-between items-center pt-4 border-t border-gray-800">
              <span className="text-gray-400">Total Allocation:</span>
              <span className={`font-bold text-lg ${isValid ? 'text-green-400' : 'text-red-400'}`}>
                  {totalPercentage.toFixed(2)}% / 100%
              </span>
            </div>
            {errors.vesting && <p className="text-red-400 text-sm text-right">{errors.vesting}</p>}
          </div>

          {/* Sidebar Stats */}
          <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 p-5 rounded-xl space-y-4">
                  <h4 className="text-white font-semibold flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-purple-400" /> Tokenomics
                  </h4>
                  
                  <div className="space-y-3">
                      <div>
                          <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-400">Total Supply</span>
                              <span className="text-white font-mono">{formatNumber(totalSupply)}</span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                              <div className="h-full bg-gray-600 w-full" />
                          </div>
                      </div>

                      <div>
                          <div className="flex justify-between text-xs mb-1">
                              <span className="text-yellow-400">Presale</span>
                              <span className="text-white font-mono">{formatNumber(tokensForSale)}</span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                               <div className="h-full bg-yellow-500" style={{ width: `${(tokensForSale/totalSupply)*100}%` }} />
                          </div>
                      </div>

                      <div>
                          <div className="flex justify-between text-xs mb-1">
                              <span className="text-cyan-400">Liquidity ({liquidityPercent}%)</span>
                              <span className="text-white font-mono">{formatNumber(tokensForLiquidity)}</span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                               <div className="h-full bg-cyan-500" style={{ width: `${(tokensForLiquidity/totalSupply)*100}%` }} />
                          </div>
                      </div>
                  </div>

                  <div className="pt-4 border-t border-gray-800">
                      <div className="flex justify-between text-sm mb-1">
                          <span className="text-indigo-400 font-bold">Remaining for Team</span>
                          <span className="text-white font-mono font-bold">{formatNumber(remainingTokens)}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                          These tokens must be fully vested in this schedule.
                      </p>
                  </div>
              </div>
          </div>
      </div>

      <div className="flex justify-between pt-6">
        <button
          onClick={onBack}
          className="px-6 py-3 bg-gray-800 text-gray-300 font-bold rounded-lg hover:bg-gray-700 transition"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-lg hover:shadow-lg transition-all"
        >
          Review →
        </button>
      </div>
    </div>
  );
}
