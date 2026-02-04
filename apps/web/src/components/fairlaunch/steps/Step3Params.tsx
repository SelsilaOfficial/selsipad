import { Coins, Calendar, DollarSign, Info } from 'lucide-react';

interface Step3Props {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
  errors: any;
}

export function Step3Params({ data, updateData, onNext, onBack, errors }: Step3Props) {
  const handleChange = (field: string, value: string) => {
    updateData({
      params: {
        ...data.params,
        [field]: value
      }
    });
  };

  // Helper to calculate price (Tokens per 1 BNB/ETH)
  const calculateInitialPrice = () => {
    // Sanitize inputs by removing commas (handle copy-paste values)
    const rawTokens = (data.params?.tokens_for_sale || '0').toString().replace(/,/g, '');
    const rawSoftcap = (data.params?.softcap || '0').toString().replace(/,/g, '');

    const tokens = parseFloat(rawTokens);
    const softcap = parseFloat(rawSoftcap);

    if (tokens > 0 && softcap > 0) {
      // Tokens per 1 BNB = Total Tokens / Softcap
      const price = tokens / softcap;
      
      // Format with appropriate decimals based on magnitude
      return price.toLocaleString(undefined, { 
        maximumFractionDigits: price < 1 ? 8 : 2 
      });
    }
    return '---';
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Sale Config */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Coins className="w-5 h-5 text-yellow-400" />
          Sale Configuration
        </h3>

        {/* Tokens for Sale */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Tokens for Sale</label>
          <div className="relative">
             <input
              type="text"
              value={data.params?.tokens_for_sale || ''}
              onChange={(e) => {
                // Allow digits, commas, and dots
                const val = e.target.value.replace(/[^0-9.,]/g, '');
                handleChange('tokens_for_sale', val);
              }}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-yellow-500 outline-none transition font-mono"
              placeholder="Amount"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                {data.step1?.token_symbol || 'Tokens'}
            </span>
          </div>
          {errors.tokens_for_sale && <p className="text-red-400 text-xs mt-1">{errors.tokens_for_sale}</p>}
        </div>

        {/* Softcap Only */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Softcap (Primary Target)</label>
          <div className="relative">
             <input
              type="number"
              value={data.params?.softcap || ''}
              onChange={(e) => handleChange('softcap', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-yellow-500 outline-none transition"
              placeholder="e.g. 10"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                {data.params?.payment_token === 'USDT' ? 'USDT' : (data.step1?.network === 'bnb' ? 'BNB' : 'ETH')}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Fairlaunch has no hardcap. The sale continues until time ends.</p>
          {errors.softcap && <p className="text-red-400 text-xs mt-1">{errors.softcap}</p>}
        </div>

        {/* Payment Token */}
        <div>
           <label className="block text-sm font-medium text-gray-400 mb-2">Raise Currency</label>
           <div className="flex gap-4">
              <button
                onClick={() => handleChange('payment_token', 'NATIVE')}
                className={`flex-1 py-3 rounded-lg border flex items-center justify-center gap-2 transition-all ${
                    data.params?.payment_token === 'NATIVE' 
                    ? 'bg-yellow-500/10 border-yellow-500 text-yellow-400' 
                    : 'bg-gray-800 border-gray-700 text-gray-400'
                }`}
              >
                 <DollarSign className="w-4 h-4" />
                 {data.step1?.network === 'bnb' ? 'BNB' : 'ETH'}
              </button>
              <button
                onClick={() => handleChange('payment_token', 'USDT')}
                className={`flex-1 py-3 rounded-lg border flex items-center justify-center gap-2 transition-all ${
                    data.params?.payment_token === 'USDT' 
                    ? 'bg-green-500/10 border-green-500 text-green-400' 
                    : 'bg-gray-800 border-gray-700 text-gray-400'
                }`}
              >
                 <DollarSign className="w-4 h-4" />
                 USDT
              </button>
           </div>
        </div>

         {/* Price Estimator */}
         <div className="p-4 bg-gray-950 rounded-xl border border-gray-800">
           <div className="flex justify-between items-center">
             <span className="text-gray-400 text-sm">Initial Price Estimate:</span>
             <span className="text-white font-mono font-bold">
               1 {data.params?.payment_token === 'USDT' ? 'USDT' : (data.step1?.network === 'bnb' ? 'BNB' : 'ETH')} = {calculateInitialPrice()} {data.step1?.token_symbol}
             </span>
           </div>
         </div>
      </div>

      {/* Timeline */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-400" />
            Timeline
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
               <label className="block text-sm font-medium text-gray-400 mb-1">Start Time (UTC)</label>
               <input
                type="datetime-local"
                value={data.params?.start_at || ''}
                onChange={(e) => handleChange('start_at', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-purple-500 outline-none transition"
               />
               {errors.start_at && <p className="text-red-400 text-xs mt-1">{errors.start_at}</p>}
            </div>
            <div>
               <label className="block text-sm font-medium text-gray-400 mb-1">End Time (UTC)</label>
               <input
                type="datetime-local"
                value={data.params?.end_at || ''}
                onChange={(e) => handleChange('end_at', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-purple-500 outline-none transition"
               />
               {errors.end_at && <p className="text-red-400 text-xs mt-1">{errors.end_at}</p>}
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
          Next Step →
        </button>
      </div>
    </div>
  );
}
