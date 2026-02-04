'use client';

import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { uploadFairlaunchImage } from '@/actions/fairlaunch/upload-image';

interface ImageUploadProps {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  type: 'logo' | 'banner';
  recommended: string;
}

export function ImageUpload({ label, value, onChange, type, recommended }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | undefined>(value);
  const [error, setError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset error
    setError('');

    // Client-side validation
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only PNG, JPG, and WebP files are allowed');
      return;
    }

    const maxSize = type === 'logo' ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      setError(`File too large. Maximum ${maxSizeMB}MB`);
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to server
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await uploadFairlaunchImage(formData, type);

      if (result.success && result.url) {
        onChange(result.url);
        setPreview(result.url);
      } else {
        setError(result.error || 'Upload failed');
        setPreview(undefined);
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setPreview(undefined);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(undefined);
    onChange('');
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label}
      </label>

      {preview ? (
        <div className="relative group">
          <div
            className={`relative border-2 border-gray-700 rounded-lg overflow-hidden ${
              type === 'logo' ? 'w-32 h-32' : 'w-full h-40'
            }`}
          >
            <img
              src={preview}
              alt={label}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
            id={`upload-${type}`}
          />
          <label
            htmlFor={`upload-${type}`}
            className={`flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-purple-500 transition-colors ${
              type === 'logo' ? 'w-32 h-32' : 'w-full h-40'
            } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-400">Uploading...</span>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-500 mb-2" />
                <span className="text-sm text-gray-400">Click to upload</span>
                <span className="text-xs text-gray-600 mt-1">{recommended}</span>
              </>
            )}
          </label>
        </div>
      )}

      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}
