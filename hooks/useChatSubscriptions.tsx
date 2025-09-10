// hooks/useChatSubscriptions.tsx
import { useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/app/contexts/AuthProvider';

interface UseChatSubscriptionsProps {
  conversationId?: number | string;
  eventId?: number | string;
  onNewMessage?: (message: any) => void;
  onTypingUpdate?: (typingUsers: any[]) => void;
  onConversationUpdate?: () => void;
}

export function useChatSubscriptions({
  conversationId,
  eventId,
  onNewMessage,
  onTypingUpdate,
  onConversationUpdate,
}: UseChatSubscriptionsProps) {
  const { session } = useAuth();
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const mountedRef = useRef(true);

  // Cleanup all subscriptions
  const cleanupSubscriptions = useCallback(() => {
    console.log('[ChatSub] Cleaning up all subscriptions');
    
    // Remove all channels
    channelsRef.current.forEach((channel, key) => {
      console.log(`[ChatSub] Removing channel: ${key}`);
      supabase.removeChannel(channel);
    });
    channelsRef.current.clear();
  }, []);

  // Setup message subscription
  const setupMessageSubscription = useCallback(() => {
    if (!session?.user?.id || !mountedRef.current) return;

    const channelKey = conversationId 
      ? `messages_conv_${conversationId}_${session.user.id}`
      : `messages_event_${eventId}_${session.user.id}`;

    // Clean up existing subscription for this key
    const existingChannel = channelsRef.current.get(channelKey);
    if (existingChannel) {
      console.log(`[ChatSub] Removing existing channel: ${channelKey}`);
      supabase.removeChannel(existingChannel);
      channelsRef.current.delete(channelKey);
    }

    console.log(`[ChatSub] Setting up message subscription: ${channelKey}`);

    const filter = conversationId
      ? `conversation_id=eq.${conversationId}`
      : `event_id=eq.${eventId}`;

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter,
        },
        async (payload) => {
          if (!mountedRef.current) return;
          
          console.log(`[ChatSub] New message received:`, payload);
          
          if (onNewMessage && payload.new) {
            // Don't process our own messages in realtime
            if (payload.new.user_id === session.user.id) {
              return;
            }

            // Fetch complete message with user details
            const { data, error } = await supabase
              .from('messages')
              .select(`
                *,
                user:profiles(*),
                reply_to:messages!reply_to_id(
                  *,
                  user:profiles(*)
                )
              `)
              .eq('id', payload.new.id)
              .single();

            if (data && mountedRef.current) {
              onNewMessage(data);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter,
        },
        async (payload) => {
          if (!mountedRef.current) return;
          console.log(`[ChatSub] Message updated:`, payload);
          // Handle message updates (edits, deletions)
        }
      )
      .subscribe((status) => {
        console.log(`[ChatSub] Message subscription status (${channelKey}):`, status);
        
        if (status === 'SUBSCRIBED') {
          channelsRef.current.set(channelKey, channel);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[ChatSub] Channel error for ${channelKey}`);
          channelsRef.current.delete(channelKey);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, conversationId, eventId, onNewMessage]);

  // Setup typing subscription
  const setupTypingSubscription = useCallback(() => {
    if (!conversationId || !session?.user?.id || !mountedRef.current) return;

    const channelKey = `typing_${conversationId}_${session.user.id}`;

    // Clean up existing subscription
    const existingChannel = channelsRef.current.get(channelKey);
    if (existingChannel) {
      console.log(`[ChatSub] Removing existing typing channel: ${channelKey}`);
      supabase.removeChannel(existingChannel);
      channelsRef.current.delete(channelKey);
    }

    console.log(`[ChatSub] Setting up typing subscription: ${channelKey}`);

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          if (!mountedRef.current) return;
          
          console.log(`[ChatSub] Typing update:`, payload);
          
          // Fetch all typing users for this conversation
          if (onTypingUpdate) {
            const { data } = await supabase
              .from('typing_indicators')
              .select('*, user:profiles(*)')
              .eq('conversation_id', conversationId)
              .neq('user_id', session.user.id);

            if (mountedRef.current) {
              onTypingUpdate(data?.map((t: any) => t.user) || []);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(`[ChatSub] Typing subscription status (${channelKey}):`, status);
        
        if (status === 'SUBSCRIBED') {
          channelsRef.current.set(channelKey, channel);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, conversationId, onTypingUpdate]);

  // Setup conversation list subscription
  const setupConversationListSubscription = useCallback(() => {
    if (!session?.user?.id || conversationId || eventId || !mountedRef.current) return;

    const channelKey = `conv_list_${session.user.id}`;

    // Clean up existing subscription
    const existingChannel = channelsRef.current.get(channelKey);
    if (existingChannel) {
      console.log(`[ChatSub] Removing existing conversation list channel: ${channelKey}`);
      supabase.removeChannel(existingChannel);
      channelsRef.current.delete(channelKey);
    }

    console.log(`[ChatSub] Setting up conversation list subscription: ${channelKey}`);

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          if (!mountedRef.current) return;
          console.log(`[ChatSub] Conversation list update`);
          if (onConversationUpdate) {
            onConversationUpdate();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${session.user.id}`,
        },
        () => {
          if (!mountedRef.current) return;
          console.log(`[ChatSub] Participant update`);
          if (onConversationUpdate) {
            onConversationUpdate();
          }
        }
      )
      .subscribe((status) => {
        console.log(`[ChatSub] Conversation list subscription status:`, status);
        
        if (status === 'SUBSCRIBED') {
          channelsRef.current.set(channelKey, channel);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, conversationId, eventId, onConversationUpdate]);

  // Main effect to manage subscriptions
  useEffect(() => {
    mountedRef.current = true;

    if (!session?.user?.id) {
      cleanupSubscriptions();
      return;
    }

    // Small delay to prevent race conditions
    const setupTimeout = setTimeout(() => {
      if (!mountedRef.current) return;

      // Setup appropriate subscriptions based on context
      if (conversationId || eventId) {
        // In a specific chat
        setupMessageSubscription();
        if (conversationId) {
          setupTypingSubscription();
        }
      } else {
        // In chat list
        setupConversationListSubscription();
      }
    }, 100);

    // Cleanup on unmount or when dependencies change
    return () => {
      mountedRef.current = false;
      clearTimeout(setupTimeout);
      cleanupSubscriptions();
    };
  }, [
    session?.user?.id,
    conversationId,
    eventId,
  ]);

  // Provide manual refresh function
  const refreshSubscriptions = useCallback(() => {
    cleanupSubscriptions();
    
    setTimeout(() => {
      if (!mountedRef.current) return;
      
      if (conversationId || eventId) {
        setupMessageSubscription();
        if (conversationId) {
          setupTypingSubscription();
        }
      } else {
        setupConversationListSubscription();
      }
    }, 100);
  }, [
    conversationId,
    eventId,
    setupMessageSubscription,
    setupTypingSubscription,
    setupConversationListSubscription,
    cleanupSubscriptions,
  ]);

  return {
    cleanupSubscriptions,
    refreshSubscriptions,
    activeChannels: channelsRef.current.size,
  };
}

// Export a singleton manager for global subscription management
class ChatSubscriptionManager {
  private static instance: ChatSubscriptionManager;
  private globalChannels: Map<string, RealtimeChannel> = new Map();

  private constructor() {}

  static getInstance(): ChatSubscriptionManager {
    if (!ChatSubscriptionManager.instance) {
      ChatSubscriptionManager.instance = new ChatSubscriptionManager();
    }
    return ChatSubscriptionManager.instance;
  }

  cleanupAllSubscriptions() {
    console.log('[ChatSubManager] Cleaning up all global subscriptions');
    this.globalChannels.forEach((channel, key) => {
      console.log(`[ChatSubManager] Removing global channel: ${key}`);
      supabase.removeChannel(channel);
    });
    this.globalChannels.clear();
  }

  registerChannel(key: string, channel: RealtimeChannel) {
    // Remove existing channel with same key
    const existing = this.globalChannels.get(key);
    if (existing) {
      supabase.removeChannel(existing);
    }
    this.globalChannels.set(key, channel);
  }

  unregisterChannel(key: string) {
    const channel = this.globalChannels.get(key);
    if (channel) {
      supabase.removeChannel(channel);
      this.globalChannels.delete(key);
    }
  }

  getActiveChannelCount(): number {
    return this.globalChannels.size;
  }
}

export const chatSubscriptionManager = ChatSubscriptionManager.getInstance();