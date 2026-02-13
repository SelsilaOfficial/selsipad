'use client';

/**
 * AMALiveRoom Component
 *
 * Discord-style live chat room for AMA sessions
 * Premium glassmorphism dark theme
 */

import { useState, useRef, useEffect } from 'react';
import { useAMAChat, type AMAMessage } from '@/hooks/useAMAChat';
import { formatDistanceToNow } from 'date-fns';

interface AMALiveRoomProps {
  amaId: string;
  projectName: string;
  developerName?: string;
  developerId: string;
  isLive?: boolean;
  initialMessages?: any[];
}

export function AMALiveRoom({
  amaId,
  projectName,
  developerName = 'Developer',
  developerId,
  isLive = true,
  initialMessages,
}: AMALiveRoomProps) {
  const {
    messages,
    pinnedMessages,
    isConnected,
    isLoading,
    isSending,
    viewerCount,
    sendMessage,
    pinMessageById,
    deleteMessageById,
  } = useAMAChat(amaId);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    const content = input;
    setInput('');
    await sendMessage(content);
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-[#0a0a0f] rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border-b border-white/10">
        <div className="flex items-center gap-4">
          {/* Live Indicator */}
          <div className="flex items-center gap-2">
            {isLive ? (
              <>
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-400 font-bold text-sm tracking-wide">LIVE</span>
              </>
            ) : (
              <>
                <div className="w-3 h-3 bg-gray-500 rounded-full" />
                <span className="text-gray-400 font-medium text-sm">ENDED</span>
              </>
            )}
          </div>

          <div className="h-6 w-px bg-white/20" />

          {/* Title */}
          <div>
            <h2 className="text-white font-semibold">{projectName} AMA</h2>
            <p className="text-gray-400 text-sm">Hosted by SELSIPAD Team</p>
          </div>
        </div>

        {/* Viewer Count */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full">
          <span className="text-lg">👥</span>
          <span className="text-white font-medium">{viewerCount}</span>
          <span className="text-gray-400 text-sm">watching</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 flex flex-col">
          {/* Loading State */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-400">Loading messages...</span>
              </div>
            </div>
          ) : (
            <>
              {/* Messages List */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <span className="text-4xl mb-3">💬</span>
                    <p className="text-gray-400">No messages yet</p>
                    <p className="text-gray-500 text-sm">Be the first to say something!</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isDeveloperHost={msg.user_id === developerId}
                      onPin={() => pinMessageById(msg.id)}
                      onDelete={() => deleteMessageById(msg.id)}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="px-4 py-4 border-t border-white/10 bg-black/30">
                {isLive ? (
                  <div className="flex items-center gap-3">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type your question..."
                      className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isSending}
                      className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                      {isSending ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          Send
                          <span>→</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-3 text-gray-400">
                    🔒 This AMA has ended. Chat is now read-only.
                  </div>
                )}

                {/* Connection Status */}
                <div className="flex items-center justify-center gap-2 mt-2">
                  <div
                    className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
                  />
                  <span className="text-gray-500 text-xs">
                    {isConnected ? 'Connected' : 'Reconnecting...'}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sidebar - Pinned & Developer Info */}
        <div className="w-72 bg-black/20 border-l border-white/10 flex flex-col">
          {/* Pinned Messages */}
          {pinnedMessages.length > 0 && (
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📌</span>
                <span className="text-white font-medium text-sm">PINNED</span>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {pinnedMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg"
                  >
                    <p className="text-gray-200 text-sm">{msg.content}</p>
                    <p className="text-gray-500 text-xs mt-1">— @{msg.username}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Host & Developer Info */}
          <div className="p-4 flex-1">
            {/* Host Info */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🛡️</span>
              <span className="text-white font-medium text-sm">HOST</span>
            </div>

            <div className="p-3 bg-[#39AEC4]/5 rounded-xl border border-[#39AEC4]/20 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-[#39AEC4] to-[#756BBA] rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
                <div>
                  <p className="text-[#39AEC4] font-medium text-sm">SELSIPAD Team</p>
                  <p className="text-gray-500 text-xs">Moderator</p>
                </div>
              </div>
            </div>

            {/* Developer (Guest) Info */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">👨‍💻</span>
              <span className="text-white font-medium text-sm">GUEST</span>
            </div>

            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {developerName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">@{developerName}</p>
                  <p className="text-gray-400 text-sm">{projectName}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full border border-green-500/30">
                  ✓ Dev Verified
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== Message Bubble Component =====================

interface MessageBubbleProps {
  message: AMAMessage;
  isDeveloperHost: boolean;
  onPin: () => void;
  onDelete: () => void;
}

function MessageBubble({ message, isDeveloperHost, onPin, onDelete }: MessageBubbleProps) {
  const isSystem = message.message_type === 'SYSTEM';
  const isDeveloper = message.message_type === 'DEVELOPER';
  const isHost = message.message_type === 'HOST';
  const isHighlighted = isDeveloper || isHost;

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
          <span className="text-indigo-300 text-sm">{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group flex gap-3 ${
        isHost
          ? 'bg-[#39AEC4]/5 -mx-4 px-4 py-3 rounded-lg border-l-2 border-[#39AEC4]'
          : isDeveloper
            ? 'bg-indigo-500/5 -mx-4 px-4 py-3 rounded-lg border-l-2 border-indigo-500'
            : ''
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${
          isHost
            ? 'bg-gradient-to-br from-[#39AEC4] to-[#756BBA]'
            : isDeveloper
              ? 'bg-gradient-to-br from-indigo-500 to-purple-500'
              : 'bg-white/10'
        }`}
      >
        {message.avatar_url ? (
          <img
            src={message.avatar_url}
            alt=""
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <span className="text-white font-medium">
            {message.username?.charAt(0).toUpperCase() || '?'}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`font-medium ${
              isHost ? 'text-[#39AEC4]' : isDeveloper ? 'text-indigo-400' : 'text-gray-300'
            }`}
          >
            @{message.username || 'Anonymous'}
          </span>

          {isHost && (
            <span className="px-1.5 py-0.5 bg-[#39AEC4]/30 text-[#39AEC4] text-xs font-medium rounded">
              HOST
            </span>
          )}

          {isDeveloper && (
            <span className="px-1.5 py-0.5 bg-indigo-500/30 text-indigo-300 text-xs font-medium rounded">
              GUEST
            </span>
          )}

          {message.is_verified && !isHighlighted && (
            <span className="text-blue-400 text-xs">✓</span>
          )}

          <span className="text-gray-600 text-xs">
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </span>
        </div>

        <p className="text-gray-200 mt-1 break-words">{message.content}</p>
      </div>

      {/* Actions (visible on hover) */}
      <div className="opacity-0 group-hover:opacity-100 flex items-start gap-1 transition-opacity">
        {isDeveloperHost && !message.is_pinned_message && (
          <button
            onClick={onPin}
            className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-white/5 rounded transition-colors"
            title="Pin message"
          >
            📌
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded transition-colors"
          title="Delete message"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

export default AMALiveRoom;
