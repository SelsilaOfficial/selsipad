'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { updateProfile, deleteAvatar } from './actions';
import { Card, CardContent } from '@/components/ui';

interface ProfileEditFormProps {
  initialNickname?: string;
  initialAvatarUrl?: string;
  initialBio?: string;
  initialBannerUrl?: string;
}

export function ProfileEditForm({
  initialNickname,
  initialAvatarUrl,
  initialBio,
  initialBannerUrl,
}: ProfileEditFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState(initialNickname || '');
  const [bio, setBio] = useState(initialBio || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  // Validate nickname on change
  const handleNicknameChange = (value: string) => {
    setNickname(value);
    setNicknameError(null);

    if (value && value.length < 3) {
      setNicknameError('Minimum 3 characters');
    } else if (value && value.length > 20) {
      setNicknameError('Maximum 20 characters');
    } else if (value && !/^[a-zA-Z0-9_]+$/.test(value)) {
      setNicknameError('Only letters, numbers, and underscores');
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only JPG, PNG, and WebP images are allowed');
      return;
    }

    // Validate file size (2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File size must be less than 2MB');
      return;
    }

    setError(null);
    setAvatarFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (nicknameError) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append('nickname', nickname);
    formData.append('bio', bio);
    if (avatarFile) {
      formData.append('avatar', avatarFile);
    }
    if (bannerFile) {
      formData.append('banner', bannerFile);
    }

    const result = await updateProfile(formData);

    if (result.success) {
      router.push('/profile');
      router.refresh();
    } else {
      setError(result.error || 'Failed to update profile');
      setIsSubmitting(false);
    }
  };

  // Handle avatar deletion
  const handleDeleteAvatar = async () => {
    if (!confirm('Are you sure you want to remove your avatar?')) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    const result = await deleteAvatar();

    if (result.success) {
      setPreviewUrl(null);
      setAvatarFile(null);
      router.refresh();
    } else {
      setError(result.error || 'Failed to delete avatar');
    }

    setIsDeleting(false);
  };

  const currentAvatarUrl = previewUrl || initialAvatarUrl;
  const hasAvatar = currentAvatarUrl || avatarFile;

  return (
    <div className="space-y-6">
      {/* Avatar Section */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">Profile Picture</h3>

        {/* Avatar Preview */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-32 h-32 rounded-full overflow-hidden bg-black border-2 border-white/10">
            {currentAvatarUrl ? (
              <Image src={currentAvatarUrl || ''} alt="Avatar" fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl text-gray-600">
                <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Upload/Remove Buttons */}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-gradient-to-r from-[#39AEC4] to-[#756BBA] text-white rounded-lg hover:opacity-90 transition-all text-sm font-bold shadow-lg shadow-[#756BBA]/20"
            >
              {hasAvatar ? 'Change Photo' : 'Upload Photo'}
            </button>

            {hasAvatar && (
              <button
                type="button"
                onClick={handleDeleteAvatar}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-bold disabled:opacity-50"
              >
                {isDeleting ? 'Removing...' : 'Remove'}
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500 text-center">JPG, PNG or WebP. Max 2MB</p>
        </div>
      </div>

      {/* Banner Section */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">Banner Image</h3>
        <div className="flex flex-col items-center gap-4">
          <div className="w-full h-32 rounded-xl overflow-hidden bg-gradient-to-r from-cyan-900/30 via-purple-900/20 to-blue-900/30 border border-white/10">
            {bannerPreviewUrl || initialBannerUrl ? (
              <img
                src={bannerPreviewUrl || initialBannerUrl || ''}
                alt="Banner"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                No banner set
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 3 * 1024 * 1024) {
                  setError('Banner file size must be less than 3MB');
                  return;
                }
                setError(null);
                setBannerFile(file);
                const reader = new FileReader();
                reader.onloadend = () => setBannerPreviewUrl(reader.result as string);
                reader.readAsDataURL(file);
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              className="px-4 py-2 bg-gradient-to-r from-[#39AEC4] to-[#756BBA] text-white rounded-lg hover:opacity-90 transition-all text-sm font-bold shadow-lg shadow-[#756BBA]/20"
            >
              {bannerPreviewUrl || initialBannerUrl ? 'Change Banner' : 'Upload Banner'}
            </button>
          </div>
          <p className="text-xs text-gray-500 text-center">
            JPG, PNG or WebP. Max 3MB. Recommended: 1500×500
          </p>
        </div>
      </div>

      {/* Nickname Section */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="nickname" className="block text-sm font-bold text-gray-300 mb-2">
              Username
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => handleNicknameChange(e.target.value)}
              placeholder="Enter your username"
              maxLength={20}
              className="w-full px-4 py-2 bg-black border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono"
            />
            {nicknameError && <p className="mt-1 text-xs text-red-400">{nicknameError}</p>}
            <p className="mt-1 text-xs text-gray-500">
              3-20 characters. Letters, numbers, and underscores only.
            </p>
          </div>

          {/* Bio Field */}
          <div className="mb-4">
            <label htmlFor="bio" className="block text-sm font-bold text-gray-300 mb-2">
              Bio
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
              placeholder="Tell everyone about yourself..."
              maxLength={160}
              rows={3}
              className="w-full px-4 py-2 bg-black border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all resize-none"
              style={{
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              }}
            />
            <p className="mt-1 text-xs text-gray-500">{bio.length}/160 characters</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg mb-4">
              <p className="text-sm text-red-400">❌ {error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push('/profile')}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-gray-300 rounded-lg hover:bg-white/10 transition-colors font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !!nicknameError}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-[#39AEC4] to-[#756BBA] text-white rounded-lg hover:opacity-90 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#756BBA]/20"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
