import { Droplets, Lock } from 'lucide-react';

interface Step4Props {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
  errors: any;
}

export function Step4Liquidity({ data, updateData, onNext, onBack, errors }: Step4Props) {
  const handleChange = (field: string, value: any) => {
    updateData({
      liquidity: {
        ...data.liquidity,
        [field]: value
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Droplets className="w-5 h-5 text-cyan-400" />
          Liquidity Configuration
        </h3>

        {/* Listing Platform */}
        <div>
           <label className="block text-sm font-medium text-gray-400 mb-2">Listing Platform</label>
           <select
             value={data.liquidity?.listing_platform || ''}
             onChange={(e) => handleChange('listing_platform', e.target.value)}
             className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 outline-none transition"
           >
             <option value="">Select Platform</option>
             {data.step1?.network === 'bnb' && <option value="PancakeSwap">PancakeSwap v2</option>}
             {data.step1?.network === 'ethereum' && <option value="Uniswap">Uniswap v2</option>}
             {data.step1?.network === 'base' && <option value="Uniswap">Uniswap v2 (Base)</option>}
           </select>
           {errors.listing_platform && <p className="text-red-400 text-xs mt-1">{errors.listing_platform}</p>}
        </div>

        {/* Liquidity Percent */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Liquidity Percentage (%)</label>
          <div className="relative">
             <input
              type="number"
              value={data.liquidity?.liquidity_percent || ''}
              onChange={(e) => handleChange('liquidity_percent', parseFloat(e.target.value))}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 outline-none transition"
              min={70}
              max={100}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Minimum 70% required for Fairlaunch.</p>
          {errors.liquidity_percent && <p className="text-red-400 text-xs mt-1">{errors.liquidity_percent}</p>}
        </div>

        {/* Lock Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Liquidity Lock (Months)</label>
          <div className="relative">
             <input
              type="number"
              value={data.liquidity?.lp_lock_months || ''}
              onChange={(e) => handleChange('lp_lock_months', parseFloat(e.target.value))}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 outline-none transition"
              min={12}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">Months</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Minimum 12 months required.</p>
          {errors.lp_lock_months && <p className="text-red-400 text-xs mt-1">{errors.lp_lock_months}</p>}
        </div>
      </div>

      <div className="bg-blue-950/20 border border-blue-900/30 rounded-xl p-4 flex gap-3">
        <Lock className="w-5 h-5 text-blue-400 flex-shrink-0" />
        <div className="text-sm">
           <p className="text-white font-semibold mb-1">Liquidity is Automatically Locked</p>
           <p className="text-gray-400">
             Once the fairlaunch ends successfully, the liquidity portion ({data.liquidity?.liquidity_percent || 0}%) 
             will be automatically added to the DEX and locked for {data.liquidity?.lp_lock_months || 0} months.
             You will receive the "Locked Liquidity" badge.
           </p>
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
          Next Step →
        </button>
      </div>
    </div>
  );
}
