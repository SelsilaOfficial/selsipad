'use client';

import { useState, useRef, useEffect } from 'react';
import { Image, Smile, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface PostComposerProps {
  userProfile?: {
    avatar_url?: string;
    username: string;
  };
  isEligible: boolean;
  onSubmit: (content: string, imageUrls?: string[]) => Promise<void>;
}

/**
 * Twitter-style inline post composer
 * Displays at the top of the feed for creating new posts
 */
export function PostComposer({ userProfile, isEligible, onSubmit }: PostComposerProps) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Extract hashtags for counting
  const extractHashtags = (text: string): string[] => {
    const matches = text.match(/#\w+/g);
    return matches ? [...new Set(matches.map(tag => tag.toLowerCase()))] : [];
  };

  const hashtags = extractHashtags(content);
  const hashtagCount = hashtags.length;

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showEmojiPicker]);

  // Common emojis
  const emojis = [
    '😀',
    '😃',
    '😄',
    '😁',
    '😅',
    '😂',
    '🤣',
    '😊',
    '😇',
    '🙂',
    '😉',
    '😌',
    '😍',
    '🥰',
    '😘',
    '😗',
    '😙',
    '😚',
    '🤗',
    '🤩',
    '🤔',
    '🤨',
    '😐',
    '😑',
    '😶',
    '🙄',
    '😏',
    '😣',
    '😥',
    '😮',
    '🤐',
    '😯',
    '😪',
    '😫',
    '🥱',
    '😴',
    '😌',
    '😛',
    '😜',
    '😝',
    '🤤',
    '😒',
    '😓',
    '😔',
    '😕',
    '🙃',
    '🤑',
    '😲',
    '☹️',
    '🙁',
    '😖',
    '😞',
    '😟',
    '😤',
    '😢',
    '😭',
    '😦',
    '😧',
    '😨',
    '😩',
    '🤯',
    '😬',
    '😰',
    '😱',
    '🥵',
    '🥶',
    '😳',
    '🤪',
    '😵',
    '🥴',
    '😠',
    '😡',
    '🤬',
    '😷',
    '🤒',
    '🤕',
    '🤢',
    '🤮',
    '🤧',
    '😇',
    '🥳',
    '🥺',
    '🤠',
    '🤡',
    '🤥',
    '🤫',
    '🤭',
    '🧐',
    '🤓',
    '😈',
    '👻',
    '💀',
    '☠️',
    '👽',
    '👾',
    '🤖',
    '🎃',
    '😺',
    '😸',
    '😹',
    '❤️',
    '🧡',
    '💛',
    '💚',
    '💙',
    '💜',
    '🖤',
    '🤍',
    '🤎',
    '💔',
    '❣️',
    '💕',
    '💞',
    '💓',
    '💗',
    '💖',
    '💘',
    '💝',
    '💟',
    '☮️',
    '✌️',
    '🤞',
    '🤟',
    '🤘',
    '🤙',
    '👈',
    '👉',
    '👆',
    '🖕',
    '👇',
    '☝️',
    '👍',
    '👎',
    '✊',
    '👊',
    '🤛',
    '🤜',
    '👏',
    '🙌',
    '👐',
    '🤲',
    '🤝',
    '🙏',
    '✍️',
    '💅',
    '🤳',
    '💪',
    '🦾',
    '🦿',
    '🦵',
    '🔥',
    '⭐',
    '🌟',
    '✨',
    '💫',
    '💥',
    '💯',
    '🎉',
    '🎊',
    '🎁',
  ];

  const handleEmojiSelect = (emoji: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const newContent = content.substring(0, start) + emoji + content.substring(end);
      setContent(newContent);

      // Set cursor position after emoji
      setTimeout(() => {
        if (textareaRef.current) {
          const newPosition = start + emoji.length;
          textareaRef.current.selectionStart = newPosition;
          textareaRef.current.selectionEnd = newPosition;
          textareaRef.current.focus();
        }
      }, 0);
    } else {
      setContent(content + emoji);
    }
    setShowEmojiPicker(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const supabase = createClient();
    const uploadedUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        // Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `posts/${fileName}`;

        console.log('[Upload] Starting upload:', { fileName, filePath, size: file.size, type: file.type });

        const { data, error } = await supabase.storage.from('public-files').upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

        if (error) {
          console.error('[Upload] Storage upload error:', error);
          console.error('[Upload] Error details:', JSON.stringify(error, null, 2));
          throw error;
        }

        console.log('[Upload] Upload success:', data);

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from('public-files').getPublicUrl(filePath);

        console.log('[Upload] Public URL:', publicUrl);
        uploadedUrls.push(publicUrl);
      }

      setImages([...images, ...uploadedUrls]);
    } catch (error: any) {
      console.error('[Upload] Error uploading images:', error);
      console.error('[Upload] Error name:', error?.name);
      console.error('[Upload] Error message:', error?.message);
      console.error('[Upload] Error details:', error?.details);
      alert(`Failed to upload images: ${error.message || 'Unknown error'}. Check console for details.`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if ((!content.trim() && images.length === 0) || submitting || !isEligible) return;

    setSubmitting(true);
    try {
      await onSubmit(content, images.length > 0 ? images : undefined);
      setContent('');
      setImages([]);
    } catch (error) {
      console.error('Failed to submit post:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const maxLength = 500;
  const charCount = content.length;
  const isOverLimit = charCount > maxLength;
  // Removed hashtag requirement - trending is based on aggregation across posts, not per-post
  const canPost = (content.trim() || images.length > 0) && !isOverLimit && isEligible;

  return (
    <div className="bg-bg-elevated rounded-xl shadow-sm border border-border-subtle p-4">
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {userProfile?.avatar_url ? (
            <img
              src={userProfile.avatar_url}
              alt={userProfile.username}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold">
              {userProfile?.username?.[0]?.toUpperCase() || '?'}
            </div>
          )}
        </div>

        {/* Composer Content */}
        <div className="flex-1 space-y-3">
          {/* Textarea */}
          <textarea
            placeholder="Apa yang sedang terjadi?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={!isEligible}
            className="w-full min-h-[80px] bg-transparent text-text-primary text-lg placeholder:text-text-secondary focus:outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            maxLength={maxLength + 50}
          />

          {/* Image Preview Grid */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {images.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Upload ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg border border-border-subtle"
                  />
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-black rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
            {/* Media Icons */}
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!isEligible || uploading}
                className="p-2 text-primary-main hover:bg-primary-main/10 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Add image"
              >
                <Image className="w-5 h-5" />
              </button>
              <div className="relative" ref={emojiPickerRef}>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  disabled={!isEligible}
                  className="p-2 text-primary-main hover:bg-primary-main/10 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Add emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>

                {/* Emoji Picker Dropdown */}
                {showEmojiPicker && (
                  <div className="absolute bottom-full left-0 mb-2 bg-bg-elevated border border-border-subtle rounded-xl shadow-lg p-3 w-64 max-h-64 overflow-y-auto z-50">
                    <div className="grid grid-cols-8 gap-1">
                      {emojis.map((emoji, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleEmojiSelect(emoji)}
                          className="p-2 hover:bg-bg-page rounded text-xl transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Character Count and Post Button */}
            <div className="flex items-center gap-3">
              {/* Hashtag Counter - Info Only */}
              {hashtagCount > 0 && (
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <span>#</span>
                  <span>{hashtagCount}</span>
                </div>
              )}
              {charCount > 0 && (
                <span
                  className={`text-sm ${
                    isOverLimit ? 'text-status-error-text font-semibold' : 'text-text-secondary'
                  }`}
                >
                  {charCount}/{maxLength}
                </span>
              )}
              <button
                onClick={handleSubmit}
                disabled={!canPost || submitting}
                className="px-5 py-2 bg-primary-main text-primary-text text-sm font-semibold rounded-full hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
