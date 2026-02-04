'use client';

import { SocialMediaInputs } from '@/components/fairlaunch/SocialMediaInputs';
import { ImageUpload } from '@/components/fairlaunch/ImageUpload';
import { Image, FileText } from 'lucide-react';

interface ProjectInfoStepProps {
  data: {
    projectName: string;
    description: string;
    logoUrl?: string;
    socialLinks: {
      website?: string;
      twitter?: string;
      telegram?: string;
      discord?: string;
      medium?: string;
      github?: string;
      reddit?: string;
      youtube?: string;
    };
  };
  onChange: (data: Partial<ProjectInfoStepProps['data']>) => void;
  errors?: Record<string, string>;
}

export function ProjectInfoStep({ data, onChange, errors }: ProjectInfoStepProps) {
  const handleSocialLinksChange = (socialLinks: ProjectInfoStepProps['data']['socialLinks']) => {
    onChange({ socialLinks });
  };

  return (
    <div className="space-y-6">
      {/* Project Name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Project Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={data.projectName}
          onChange={(e) => onChange({ projectName: e.target.value })}
          placeholder="e.g., MetaMoon Finance"
          maxLength={100}
          className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 transition
            ${
              errors?.projectName
                ? 'border-red-500 focus:border-red-400'
                : 'border-gray-700 focus:border-purple-500'
            }
            focus:outline-none focus:ring-2 focus:ring-purple-500/20
          `}
        />
        {errors?.projectName && (
          <p className="text-red-400 text-sm mt-2">{errors.projectName}</p>
        )}
        <p className="text-gray-400 text-xs mt-1">{data.projectName.length}/100 characters</p>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Project Description <span className="text-red-400">*</span>
        </label>
        <textarea
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Describe your project, its vision, and what makes it unique..."
          rows={6}
          maxLength={500}
          className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 transition resize-none
            ${
              errors?.description
                ? 'border-red-500 focus:border-red-400'
                : 'border-gray-700 focus:border-purple-500'
            }
            focus:outline-none focus:ring-2 focus:ring-purple-500/20
          `}
        />
        {errors?.description && (
          <p className="text-red-400 text-sm mt-2">{errors.description}</p>
        )}
        <div className="flex items-center justify-between mt-1">
          <p className="text-gray-400 text-xs">{data.description.length}/500 characters</p>
          <p className="text-gray-500 text-xs">Minimum 10 characters</p>
        </div>
      </div>

      {/* Logo & Banner Upload */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Logo Upload */}
        <ImageUpload
          label="Project Logo"
          value={data.logoUrl}
          onChange={(url) => onChange({ logoUrl: url })}
          type="logo"
          recommended="Square, 200×200px min, max 2MB"
        />

        {/* Banner Upload - TODO: Add bannerUrl to data type */}
        {/* <ImageUpload
          label="Project Banner"
          value={data.bannerUrl}
          onChange={(url) => onChange({ bannerUrl: url })}
          type="banner"
          recommended="Wide, 1200×400px min, max 5MB"
        /> */}
      </div>

      {/* Social Media Links */}
      <div>
        <SocialMediaInputs
          values={data.socialLinks}
          onChange={handleSocialLinksChange}
          errors={errors as any}
        />
      </div>

      {/* Info Box */}
      <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <FileText className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-200 font-medium text-sm">Project Information</p>
            <p className="text-blue-300/70 text-xs mt-1">
              This information will be displayed on your live fairlaunch page. Make sure it's
              accurate and engaging to attract contributors.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
