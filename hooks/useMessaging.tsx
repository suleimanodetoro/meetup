// hooks/useMessaging.ts

import { useState, useEffect, useCallback, useRef } from 'react';

import {
  Message,
  Conversation,
  ConversationWithDetails,
  TypingIndicator,
  FriendshipStatus,
  UserPrivacySettings,
  ChatListItem,
} from '~/types/messaging';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/app/contexts/AuthProvider';

// =====================================================
// HOOK: useConversation - Manage a single conversation
// =====================================================
export function useConversation(conversationId: string | number) {
  const { session } = useAuth();
  const [conversation, setConversation] = useState<ConversationWithDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!session?.user?.id || !conversationId) return;

    fetchConversation();
    fetchMessages();
    subscribeToConversation();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [conversationId, session]);

  const fetchConversation = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          participants:conversation_participants(
            *,
            profile:profiles(*)
          ),
          event:events(*)
        `)
        .eq('id', conversationId)
        .single();

      if (error) throw error;
      setConversation(data);
    } catch (error) {
      console.error('Error fetching conversation:', error);
    }
  };

  const fetchMessages = async () => {
    setLoading(true);
    try {
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
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      
      // Mark as read
      markAsRead();
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToConversation = () => {
    channelRef.current = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        handleNewMessage
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversationId}`,
        },
        handleTypingUpdate
      )
      .subscribe();
  };

  const handleNewMessage = async (payload: any) => {
    // Fetch full message with relations
    const { data } = await supabase
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

    if (data) {
      setMessages(prev => [...prev, data]);
      
      // Mark as read if from other user
      if (data.user_id !== session?.user?.id) {
        markAsRead();
      }
    }
  };

  const handleTypingUpdate = async () => {
    const { data } = await supabase
      .from('typing_indicators')
      .select('*, user:profiles(*)')
      .eq('conversation_id', conversationId)
      .neq('user_id', session?.user?.id);

    setTypingUsers(data || []);
  };

  const sendMessage = async (content: string, replyToId?: number) => {
    if (!content.trim() || !session?.user?.id) return;

    setSending(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: session.user.id,
          content: content.trim(),
          reply_to_id: replyToId,
          message_type: 'text',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    } finally {
      setSending(false);
    }
  };

  const markAsRead = async () => {
    if (!session?.user?.id) return;

    try {
      await supabase.rpc('mark_conversation_as_read', {
        p_conversation_id: Number(conversationId),
        p_user_id: session.user.id,
      });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const deleteMessage = async (messageId: number) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ 
          is_deleted: true,
          deleted_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .eq('user_id', session?.user?.id);

      if (error) throw error;
      
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  };

  return {
    conversation,
    messages,
    loading,
    sending,
    typingUsers,
    sendMessage,
    deleteMessage,
    markAsRead,
    refetch: fetchMessages,
  };
}

// =====================================================
// HOOK: useChatList - Manage chat list
// =====================================================
export function useChatList(filter?: 'all' | 'dms' | 'plans') {
  const { session } = useAuth();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    fetchChats();
    subscribeToUpdates();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [session, filter]);

  const fetchChats = async () => {
    if (!session?.user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_user_conversations', {
          p_user_id: session.user.id
        });

      if (error) throw error;

      // Transform and filter based on type
      let chatItems = (data || []).map(conv => ({
        conversation: {
          id: conv.conversation_id,
          type: conv.conversation_type as 'dm' | 'group',
          name: conv.conversation_name,
          avatar_url: conv.avatar_url,
          last_message_at: conv.last_message_at,
          last_message_preview: conv.last_message_content,
          event_id: conv.event_id,
          event: conv.event_id ? { country_code: conv.event_country_code } : undefined,
        },
        last_message: conv.last_message_content ? {
          content: conv.last_message_content,
          created_at: conv.last_message_at,
          user: { full_name: conv.last_message_user_name }
        } : null,
        unread_count: Number(conv.unread_count) || 0,
        is_muted: false,
        participant_count: Number(conv.participant_count) || 0,
      })) as ChatListItem[];

      // Apply filter
      if (filter === 'dms') {
        chatItems = chatItems.filter(c => c.conversation.type === 'dm');
      } else if (filter === 'plans') {
        chatItems = chatItems.filter(c => c.conversation.type === 'group');
      }

      setChats(chatItems);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToUpdates = () => {
    channelRef.current = supabase
      .channel('chat_list_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Refresh chat list when new messages arrive
          fetchChats();
        }
      )
      .subscribe();
  };

  return {
    chats,
    loading,
    refetch: fetchChats,
  };
}

// =====================================================
// HOOK: useFriendship - Manage friendship status
// =====================================================
export function useFriendship(userId: string) {
  const { session } = useAuth();
  const [status, setStatus] = useState<FriendshipStatus | null>(null);
  const [isRequester, setIsRequester] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id || !userId || userId === session.user.id) return;

    checkFriendshipStatus();
  }, [session, userId]);

  const checkFriendshipStatus = async () => {
    if (!session?.user?.id) return;

    try {
      const { data } = await supabase
        .rpc('get_friendship_status', {
          user1_id: session.user.id,
          user2_id: userId
        });

      if (data?.[0]) {
        setStatus(data[0].status as FriendshipStatus);
        setIsRequester(data[0].is_requester);
      } else {
        setStatus(null);
      }
    } catch (error) {
      console.error('Error checking friendship:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async () => {
    if (!session?.user?.id) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .insert({
          requester_id: session.user.id,
          addressee_id: userId,
          status: 'pending'
        });

      if (!error) {
        setStatus('pending');
        setIsRequester(true);
      }
      return !error;
    } catch (error) {
      console.error('Error sending friend request:', error);
      return false;
    }
  };

  const acceptRequest = async () => {
    if (!session?.user?.id) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .update({ 
          status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('requester_id', userId)
        .eq('addressee_id', session.user.id);

      if (!error) {
        setStatus('accepted');
      }
      return !error;
    } catch (error) {
      console.error('Error accepting friend request:', error);
      return false;
    }
  };

  const removeFriend = async () => {
    if (!session?.user?.id) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .or(`requester_id.eq.${session.user.id},addressee_id.eq.${session.user.id}`);

      if (!error) {
        setStatus(null);
        setIsRequester(false);
      }
      return !error;
    } catch (error) {
      console.error('Error removing friend:', error);
      return false;
    }
  };

  return {
    status,
    isRequester,
    loading,
    sendRequest,
    acceptRequest,
    removeFriend,
    refetch: checkFriendshipStatus,
  };
}

// =====================================================
// HOOK: useTyping - Manage typing indicators
// =====================================================
export function useTyping(conversationId: number) {
  const { session } = useAuth();
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const startTyping = useCallback(async () => {
    if (!session?.user?.id || isTyping) return;

    setIsTyping(true);
    try {
      await supabase
        .from('typing_indicators')
        .upsert({
          conversation_id: conversationId,
          user_id: session.user.id,
          started_at: new Date().toISOString(),
        });

      // Auto-stop after 10 seconds
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 10000);
    } catch (error) {
      console.error('Error setting typing:', error);
    }
  }, [conversationId, session, isTyping]);

  const stopTyping = useCallback(async () => {
    if (!session?.user?.id || !isTyping) return;

    setIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    try {
      await supabase
        .from('typing_indicators')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', session.user.id);
    } catch (error) {
      console.error('Error removing typing:', error);
    }
  }, [conversationId, session, isTyping]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Clean up on unmount
      if (isTyping) {
        stopTyping();
      }
    };
  }, []);

  return {
    isTyping,
    startTyping,
    stopTyping,
  };
}

// =====================================================
// HOOK: usePrivacySettings - Manage privacy settings
// =====================================================
export function usePrivacySettings() {
  const { session } = useAuth();
  const [settings, setSettings] = useState<UserPrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetchSettings();
  }, [session]);

  const fetchSettings = async () => {
    if (!session?.user?.id) return;

    try {
      const { data } = await supabase
        .from('user_privacy_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      setSettings(data);
    } catch (error) {
      console.error('Error fetching privacy settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<UserPrivacySettings>) => {
    if (!session?.user?.id) return false;

    try {
      const { error } = await supabase
        .from('user_privacy_settings')
        .upsert({
          user_id: session.user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        });

      if (!error) {
        setSettings(prev => prev ? { ...prev, ...updates } : null);
      }
      return !error;
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      return false;
    }
  };

  return {
    settings,
    loading,
    updateSettings,
    refetch: fetchSettings,
  };
}

// =====================================================
// UTILITY: Message formatting helpers
// =====================================================
export const formatMessageTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 1) {
    const diffInMinutes = Math.floor(diffInHours * 60);
    return `${diffInMinutes}m ago`;
  } else if (diffInHours < 24) {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  } else if (diffInHours < 48) {
    return 'Yesterday';
  } else if (diffInHours < 168) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  }
};

// =====================================================
// UTILITY: Check if users can message
// =====================================================
export async function canUsersMessage(
  senderId: string,
  receiverId: string
): Promise<{ canMessage: boolean; reason?: string }> {
  try {
    const { data } = await supabase
      .rpc('can_users_message', {
        sender_id: senderId,
        receiver_id: receiverId
      });

    if (!data) {
      // Check privacy settings
      const { data: settings } = await supabase
        .from('user_privacy_settings')
        .select('message_privacy')
        .eq('user_id', receiverId)
        .single();

      if (settings?.message_privacy === 'nobody') {
        return { canMessage: false, reason: 'User has disabled messaging' };
      } else if (settings?.message_privacy === 'friends_only') {
        return { canMessage: false, reason: 'Add as friend to message' };
      }
    }

    return { canMessage: data || false };
  } catch (error) {
    console.error('Error checking message permission:', error);
    return { canMessage: false, reason: 'Error checking permissions' };
  }
}