// hooks/useChatSubscriptions.tsx - FIXED VERSION
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
  enabled?: boolean;
}

// Global counter for debugging
let globalSubscriptionCount = 0;
let globalEventCount = 0;

export function useChatSubscriptions({
  conversationId,
  eventId,
  onNewMessage,
  onTypingUpdate,
  onConversationUpdate,
  enabled = true,
}: UseChatSubscriptionsProps) {
  const { session } = useAuth();
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const mountedRef = useRef(true);
  const componentId = useRef(`Component-${Math.random().toString(36).substr(2, 9)}`);

  // Log component lifecycle
  useEffect(() => {
    console.log(`🔵 [${componentId.current}] Component MOUNTED`, {
      conversationId,
      eventId,
      hasOnConversationUpdate: !!onConversationUpdate,
      hasOnNewMessage: !!onNewMessage,
    });

    return () => {
      console.log(`🔴 [${componentId.current}] Component UNMOUNTED`);
    };
  }, []);

  // ✅ FIXED: Cleanup all subscriptions with proper unsubscribe
  const cleanupSubscriptions = useCallback(async () => {
    const channelCount = channelsRef.current.size;
    console.log(`🧹 [${componentId.current}] CLEANUP: Removing ${channelCount} subscriptions`);
    
    if (channelCount === 0) {
      console.log(`📊 Global subscription count: ${globalSubscriptionCount}`);
      return;
    }
    
    // Create array of promises for all unsubscribe operations
    const unsubscribePromises: Promise<void>[] = [];
    
    channelsRef.current.forEach((channel, key) => {
      console.log(`  ❌ Unsubscribing channel: ${key}`);
      
      const unsubscribePromise = new Promise<void>((resolve) => {
        channel.unsubscribe((status) => {
          console.log(`🔔 [${componentId.current}] Unsubscribe status: ${status} (${key})`);
          resolve();
        });
      });
      
      unsubscribePromises.push(unsubscribePromise);
      globalSubscriptionCount--;
    });
    
    // Wait for all channels to unsubscribe
    await Promise.all(unsubscribePromises);
    
    // Small delay to ensure DB connections are fully closed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Now remove the channels from Supabase
    channelsRef.current.forEach((channel, key) => {
      console.log(`  🗑️  Removing channel: ${key}`);
      supabase.removeChannel(channel);
    });
    
    channelsRef.current.clear();
    console.log(`📊 Global subscription count: ${globalSubscriptionCount}`);
  }, []);

  // ✅ FIXED: Made async and added proper cleanup for existing channels
  const setupMessageSubscription = useCallback(async () => {
    if (!session?.user?.id || !mountedRef.current) return;

    const channelKey = conversationId 
      ? `messages_conv_${conversationId}_${session.user.id}`
      : `messages_event_${eventId}_${session.user.id}`;

    // ✅ FIXED: Properly unsubscribe before replacing
    const existingChannel = channelsRef.current.get(channelKey);
    if (existingChannel) {
      console.log(`⚠️  [${componentId.current}] Replacing existing channel: ${channelKey}`);
      
      await new Promise<void>((resolve) => {
        existingChannel.unsubscribe(() => {
          console.log(`🔔 Replaced channel unsubscribed: ${channelKey}`);
          resolve();
        });
      });
      
      supabase.removeChannel(existingChannel);
      channelsRef.current.delete(channelKey);
      globalSubscriptionCount--;
    }

    console.log(`✅ [${componentId.current}] Creating MESSAGE subscription: ${channelKey}`);

    const filter = conversationId
      ? `conversation_id=eq.${conversationId}`
      : `event_id=eq.${eventId}`;

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter,
        },
        async (payload) => {
          globalEventCount++;
          console.log(`📨 [${componentId.current}] Message event #${globalEventCount}:`, {
            event: payload.eventType,
            messageId: payload.new?.id,
            channelKey,
          });
          
          if (!mountedRef.current) {
            console.log(`⚠️  Component unmounted, ignoring event`);
            return;
          }
          
          if (payload.eventType === 'INSERT' && onNewMessage) {
            const { data } = await supabase
              .from('messages')
              .select('*, user:profiles(*)')
              .eq('id', payload.new.id)
              .single();

            if (data && mountedRef.current) {
              onNewMessage(data);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(`🔔 [${componentId.current}] Message subscription status: ${status} (${channelKey})`);
        
        if (status === 'SUBSCRIBED') {
          channelsRef.current.set(channelKey, channel);
          globalSubscriptionCount++;
          console.log(`📊 Global subscription count: ${globalSubscriptionCount}`);
        }
      });
  }, [session, conversationId, eventId, onNewMessage]);

  // ✅ FIXED: Made async and added proper cleanup for existing channels
  const setupTypingSubscription = useCallback(async () => {
    if (!conversationId || !session?.user?.id || !mountedRef.current) {
      console.log(`⏭️  [${componentId.current}] Skipping typing subscription`, {
        noConversationId: !conversationId,
        noSession: !session?.user?.id,
        notMounted: !mountedRef.current,
      });
      return;
    }

    const channelKey = `typing_${conversationId}_${session.user.id}`;

    // ✅ FIXED: Properly unsubscribe before replacing
    const existingChannel = channelsRef.current.get(channelKey);
    if (existingChannel) {
      console.log(`⚠️  [${componentId.current}] Replacing existing typing channel: ${channelKey}`);
      
      await new Promise<void>((resolve) => {
        existingChannel.unsubscribe(() => {
          console.log(`🔔 Replaced typing channel unsubscribed: ${channelKey}`);
          resolve();
        });
      });
      
      supabase.removeChannel(existingChannel);
      channelsRef.current.delete(channelKey);
      globalSubscriptionCount--;
    }

    console.log(`✅ [${componentId.current}] Creating TYPING subscription: ${channelKey}`);

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
          globalEventCount++;
          console.log(`⌨️  [${componentId.current}] Typing event #${globalEventCount}:`, {
            event: payload.eventType,
            channelKey,
          });
          
          if (!mountedRef.current) return;
          
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
        console.log(`🔔 [${componentId.current}] Typing subscription status: ${status} (${channelKey})`);
        
        if (status === 'SUBSCRIBED') {
          channelsRef.current.set(channelKey, channel);
          globalSubscriptionCount++;
          console.log(`📊 Global subscription count: ${globalSubscriptionCount}`);
        }
      });
  }, [session, conversationId, onTypingUpdate]);

  // ✅ FIXED: Made async and added proper cleanup for existing channels
  const setupConversationListSubscription = useCallback(async () => {
    if (!session?.user?.id || conversationId || eventId || !mountedRef.current) {
      console.log(`⏭️  [${componentId.current}] Skipping conversation list subscription`, {
        noSession: !session?.user?.id,
        hasConversationId: !!conversationId,
        hasEventId: !!eventId,
        notMounted: !mountedRef.current,
      });
      return;
    }

    const channelKey = `conv_list_${session.user.id}`;

    // ✅ FIXED: Properly unsubscribe before replacing
    const existingChannel = channelsRef.current.get(channelKey);
    if (existingChannel) {
      console.log(`⚠️  [${componentId.current}] Replacing existing conv list channel: ${channelKey}`);
      
      await new Promise<void>((resolve) => {
        existingChannel.unsubscribe(() => {
          console.log(`🔔 Replaced conv list channel unsubscribed: ${channelKey}`);
          resolve();
        });
      });
      
      supabase.removeChannel(existingChannel);
      channelsRef.current.delete(channelKey);
      globalSubscriptionCount--;
    }

    console.log(`✅ [${componentId.current}] Creating CONVERSATION LIST subscription: ${channelKey}`);

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          globalEventCount++;
          console.log(`💬 [${componentId.current}] Conversation UPDATE event #${globalEventCount}:`, {
            conversationId: payload.new?.id,
            channelKey,
          });
          
          if (!mountedRef.current) {
            console.log(`⚠️  Component unmounted, ignoring event`);
            return;
          }
          
          console.log(`🔄 Triggering conversation refresh callback`);
          if (onConversationUpdate) {
            onConversationUpdate();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${session.user.id}`,
        },
        () => {
          globalEventCount++;
          console.log(`👥 [${componentId.current}] New PARTICIPANT event #${globalEventCount}`);
          
          if (!mountedRef.current) return;
          
          console.log(`🔄 Triggering conversation refresh callback`);
          if (onConversationUpdate) {
            onConversationUpdate();
          }
        }
      )
      .subscribe((status) => {
        console.log(`🔔 [${componentId.current}] Conversation list subscription status: ${status} (${channelKey})`);
        
        if (status === 'SUBSCRIBED') {
          channelsRef.current.set(channelKey, channel);
          globalSubscriptionCount++;
          console.log(`📊 Global subscription count: ${globalSubscriptionCount}`);
        }
      });
  }, [session, conversationId, eventId, onConversationUpdate]);

  // Main effect to manage subscriptions
  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      console.log(`⏸️  [${componentId.current}] Subscriptions DISABLED, cleaning up`);
      cleanupSubscriptions();
      return;
    }

    if (!session?.user?.id) {
      console.log(`⏭️  [${componentId.current}] No session, skipping subscription setup`);
      cleanupSubscriptions();
      return;
    }

    console.log(`🚀 [${componentId.current}] Setting up subscriptions in 100ms...`);

    const setupTimeout = setTimeout(async () => {
      if (!mountedRef.current) {
        console.log(`⚠️  [${componentId.current}] Component unmounted before timeout, aborting setup`);
        return;
      }

      if (conversationId || eventId) {
        console.log(`📱 [${componentId.current}] Setting up CHAT SCREEN subscriptions`, {
          hasConversationId: !!conversationId,
          hasEventId: !!eventId,
          willSetupTyping: !!conversationId,
        });
        await setupMessageSubscription();
        if (conversationId) {
          console.log(`⌨️  [${componentId.current}] ConversationId present, setting up typing`);
          await setupTypingSubscription();
        } else {
          console.log(`⏭️  [${componentId.current}] No conversationId, skipping typing setup`);
        }
      } else {
        console.log(`📋 [${componentId.current}] Setting up CHAT LIST subscriptions`);
        await setupConversationListSubscription();
      }
    }, 100);

    return () => {
      console.log(`🛑 [${componentId.current}] Effect cleanup triggered`);
      mountedRef.current = false;
      clearTimeout(setupTimeout);
      cleanupSubscriptions();
    };
  }, [
    session?.user?.id,
    conversationId,
    eventId,
    enabled,
  ]);

  const refreshSubscriptions = useCallback(async () => {
    console.log(`🔄 [${componentId.current}] Manual refresh requested`);
    await cleanupSubscriptions();
    
    setTimeout(async () => {
      if (!mountedRef.current) return;
      
      if (conversationId || eventId) {
        await setupMessageSubscription();
        if (conversationId) {
          await setupTypingSubscription();
        }
      } else {
        await setupConversationListSubscription();
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

// ✅ FIXED: ChatSubscriptionManager with async cleanup
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

  async cleanupAllSubscriptions() {
    console.log('[ChatSubManager] Cleaning up all global subscriptions');
    
    const unsubscribePromises: Promise<void>[] = [];
    
    this.globalChannels.forEach((channel, key) => {
      console.log(`[ChatSubManager] Unsubscribing global channel: ${key}`);
      const promise = new Promise<void>((resolve) => {
        channel.unsubscribe(() => {
          console.log(`[ChatSubManager] Unsubscribed: ${key}`);
          resolve();
        });
      });
      unsubscribePromises.push(promise);
    });
    
    await Promise.all(unsubscribePromises);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.globalChannels.forEach((channel, key) => {
      console.log(`[ChatSubManager] Removing global channel: ${key}`);
      supabase.removeChannel(channel);
    });
    
    this.globalChannels.clear();
  }

  async registerChannel(key: string, channel: RealtimeChannel) {
    const existing = this.globalChannels.get(key);
    if (existing) {
      await new Promise<void>((resolve) => {
        existing.unsubscribe(() => resolve());
      });
      supabase.removeChannel(existing);
    }
    this.globalChannels.set(key, channel);
  }

  async unregisterChannel(key: string) {
    const channel = this.globalChannels.get(key);
    if (channel) {
      await new Promise<void>((resolve) => {
        channel.unsubscribe(() => resolve());
      });
      supabase.removeChannel(channel);
      this.globalChannels.delete(key);
    }
  }

  getActiveChannelCount(): number {
    return this.globalChannels.size;
  }
}

export const chatSubscriptionManager = ChatSubscriptionManager.getInstance();