/**
 * useAMAChat Hook
 *
 * Real-time chat for AMA sessions using Supabase Realtime
 * Discord-style live messaging
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { sendAMAMessage, getAMAMessages, pinMessage, deleteMessage } from '@/lib/data/ama';

export interface AMAMessage {
  id: string;
  ama_id: string;
  user_id: string;
  content: string;
  message_type: 'USER' | 'DEVELOPER' | 'HOST' | 'SYSTEM' | 'PINNED';
  username: string;
  avatar_url?: string;
  is_developer: boolean;
  is_host: boolean;
  is_verified: boolean;
  is_pinned_message: boolean;
  is_deleted: boolean;
  created_at: string;
}

interface UseAMAChatReturn {
  messages: AMAMessage[];
  pinnedMessages: AMAMessage[];
  isConnected: boolean;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  viewerCount: number;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  pinMessageById: (messageId: string) => Promise<void>;
  deleteMessageById: (messageId: string) => Promise<void>;
}

export function useAMAChat(amaId: string): UseAMAChatReturn {
  const [messages, setMessages] = useState<AMAMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);

  const channelRef = useRef<ReturnType<typeof createClient>['channel'] | null>(null);

  // Load initial messages
  useEffect(() => {
    if (!amaId) return;

    const loadMessages = async () => {
      console.log('[AMAChat] Loading messages for:', amaId);
      setIsLoading(true);
      try {
        const data = await getAMAMessages(amaId);
        console.log('[AMAChat] Loaded messages:', data.length, data);
        setMessages(data as AMAMessage[]);
      } catch (err) {
        console.error('[AMAChat] Failed to load messages:', err);
        setError('Failed to load messages');
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [amaId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!amaId) return;

    console.log('[AMAChat] Setting up realtime for:', amaId);
    const supabase = createClient();

    // Subscribe to new messages
    const channel = supabase
      .channel(`ama-chat:${amaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ama_messages',
          filter: `ama_id=eq.${amaId}`,
        },
        (payload) => {
          console.log('[AMAChat] New message:', payload.new);
          const newMessage = payload.new as AMAMessage;
          setMessages((prev) => [...prev, newMessage]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ama_messages',
          filter: `ama_id=eq.${amaId}`,
        },
        (payload) => {
          console.log('[AMAChat] Message updated:', payload.new);
          const updatedMessage = payload.new as AMAMessage;
          setMessages((prev) =>
            prev.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg))
          );
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        setViewerCount(count);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);

          // Track presence
          await channel.track({
            user: `user_${Date.now()}`,
            online_at: new Date().toISOString(),
          });
        } else {
          setIsConnected(false);
        }
      });

    channelRef.current = channel as any;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [amaId]);

  // Send a message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      setIsSending(true);
      setError(null);

      try {
        const result = await sendAMAMessage(amaId, content.trim());
        if (!result.success) {
          setError(result.error || 'Failed to send message');
        }
      } catch (err) {
        console.error('[AMAChat] Send error:', err);
        setError('Failed to send message');
      } finally {
        setIsSending(false);
      }
    },
    [amaId]
  );

  // Pin a message
  const pinMessageById = useCallback(
    async (messageId: string) => {
      try {
        const result = await pinMessage(messageId, amaId);
        if (!result.success) {
          setError(result.error || 'Failed to pin message');
        }
      } catch (err) {
        setError('Failed to pin message');
      }
    },
    [amaId]
  );

  // Delete a message
  const deleteMessageById = useCallback(async (messageId: string) => {
    try {
      const result = await deleteMessage(messageId);
      if (!result.success) {
        setError(result.error || 'Failed to delete message');
      }
    } catch (err) {
      setError('Failed to delete message');
    }
  }, []);

  // Filter pinned messages
  const pinnedMessages = messages.filter((msg) => msg.is_pinned_message && !msg.is_deleted);

  // Filter visible messages (not deleted)
  const visibleMessages = messages.filter((msg) => !msg.is_deleted);

  return {
    messages: visibleMessages,
    pinnedMessages,
    isConnected,
    isLoading,
    isSending,
    error,
    viewerCount,
    sendMessage,
    pinMessageById,
    deleteMessageById,
  };
}
