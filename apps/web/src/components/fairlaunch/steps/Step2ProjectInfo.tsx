import { Info, Globe, Twitter, Send, Image as ImageIcon } from 'lucide-react';

interface Step2Props {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
  errors: any;
}

export function Step2ProjectInfo({ data, updateData, onNext, onBack, errors }: Step2Props) {
  const handleChange = (field: string, value: string) => {
    updateData({
      basics: {
        ...data.basics,
        [field]: value
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-400" />
          Project Details
        </h3>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Project Name *</label>
          <input
            type="text"
            value={data.basics?.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none transition"
            placeholder="e.g. Selsi Project"
          />
          {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Description *</label>
          <textarea
            value={data.basics?.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none transition h-32 resize-none"
            placeholder="Describe your project, utility, and roadmap..."
          />
          {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Logo URL */}
          <div>
            <label className="text-sm font-medium text-gray-400 mb-1 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Logo URL
            </label>
            <input
              type="url"
              value={data.basics?.logo_url || ''}
              onChange={(e) => handleChange('logo_url', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none transition"
              placeholder="https://..."
            />
            {errors.logo_url && <p className="text-red-400 text-xs mt-1">{errors.logo_url}</p>}
          </div>

          {/* Banner URL */}
          <div>
            <label className="text-sm font-medium text-gray-400 mb-1 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Banner URL
            </label>
            <input
              type="url"
              value={data.basics?.banner_url || ''}
              onChange={(e) => handleChange('banner_url', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none transition"
              placeholder="https://..."
            />
             {errors.banner_url && <p className="text-red-400 text-xs mt-1">{errors.banner_url}</p>}
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-purple-400" />
          Social Links
        </h3>

        <div className="space-y-4">
           {/* Website */}
           <div className="relative">
             <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
             <input
              type="url"
              value={data.basics?.website || ''}
              onChange={(e) => handleChange('website', e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-purple-500 outline-none transition"
              placeholder="Website URL"
            />
            {errors.website && <p className="text-red-400 text-xs mt-1">{errors.website}</p>}
           </div>

           {/* Twitter */}
           <div className="relative">
             <Twitter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
             <input
              type="url"
              value={data.basics?.twitter || ''}
              onChange={(e) => handleChange('twitter', e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-purple-500 outline-none transition"
              placeholder="Twitter URL"
            />
            {errors.twitter && <p className="text-red-400 text-xs mt-1">{errors.twitter}</p>}
           </div>

           {/* Telegram */}
           <div className="relative">
             <Send className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
             <input
              type="url"
              value={data.basics?.telegram || ''}
              onChange={(e) => handleChange('telegram', e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-purple-500 outline-none transition"
              placeholder="Telegram URL (t.me/...)"
            />
            {errors.telegram && <p className="text-red-400 text-xs mt-1">{errors.telegram}</p>}
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
