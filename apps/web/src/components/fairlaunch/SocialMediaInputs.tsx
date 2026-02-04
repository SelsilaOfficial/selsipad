'use client';

import { Globe, Twitter, Send, MessageCircle } from 'lucide-react';

interface SocialMediaInputsProps {
  values: {
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
  onChange: (values: SocialMediaInputsProps['values']) => void;
  errors?: Partial<Record<keyof SocialMediaInputsProps['values'], string>>;
}

const socialPlatforms = [
  { key: 'website', label: 'Website', icon: Globe, placeholder: 'https://yourproject.com' },
  { key: 'twitter', label: 'Twitter/X', icon: Twitter, placeholder: 'https://x.com/yourproject' },
  { key: 'telegram', label: 'Telegram', icon: Send, placeholder: 't.me/yourproject' },
  { key: 'discord', label: 'Discord', icon: MessageCircle, placeholder: 'https://discord.gg/yourproject' },
] as const;

export function SocialMediaInputs({ values, onChange, errors }: SocialMediaInputsProps) {
  const handleChange = (key: string, value: string) => {
    onChange({
      ...values,
      [key]: value,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 bg-blue-950/20 border border-blue-800/30 rounded-lg p-4">
        <Globe className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-blue-200 font-medium text-sm">Social Media Links (Optional)</p>
          <p className="text-blue-300/70 text-xs mt-1">
            These links will be displayed on your live fairlaunch page. All fields are optional but
            must be valid URLs if provided.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {socialPlatforms.map(({ key, label, icon: Icon, placeholder }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {label}
              </div>
            </label>
            <input
              type="url"
              value={values[key as keyof typeof values] || ''}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={placeholder}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 transition
                ${
                  errors?.[key as keyof typeof values]
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-gray-700 focus:border-purple-500'
                }
                focus:outline-none focus:ring-2 focus:ring-purple-500/20
              `}
            />
            {errors?.[key as keyof typeof values] && (
              <p className="text-red-400 text-xs mt-1">{errors[key as keyof typeof values]}</p>
            )}
          </div>
        ))}
      </div>

      {/* Filled Count */}
      <div className="text-sm text-gray-400">
        {Object.values(values).filter((v) => v && v.length > 0).length} of{' '}
        {socialPlatforms.length} platforms added
      </div>
    </div>
  );
}
