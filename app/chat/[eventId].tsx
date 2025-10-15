// app/chat/[eventId].tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import {
  MessageWithDetails,
  Profile,
  Event,
  Conversation,
} from '~/types/messaging';
import { useAuth } from '../contexts/AuthProvider';
import { supabase } from '~/utils/supabase';
import { useChatSubscriptions } from '~/hooks/useChatSubscriptions';

export default function GroupChatScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { session } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<MessageWithDetails[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [participants, setParticipants] = useState<Profile[]>([]);
  const [typingUsers, setTypingUsers] = useState<Profile[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // ---------- Utils ----------
  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    });
  };

  const upsertMessage = (list: MessageWithDetails[], incoming: MessageWithDetails) => {
    const idx = list.findIndex((m) => m.id === incoming.id);
    if (idx === -1) return [...list, incoming];
    const next = [...list];
    next[idx] = { ...next[idx], ...incoming };
    return next;
  };

  // ✅ Add realtime subscriptions using centralized hook
  const { cleanupSubscriptions } = useChatSubscriptions({
    eventId: Number(eventId),
    onNewMessage: useCallback((newMessage: MessageWithDetails) => {
      setMessages(prev => upsertMessage(prev, newMessage));
      scrollToEnd();
    }, []),
    onTypingUpdate: useCallback((users: Profile[]) => {
      setTypingUsers(users);
    }, []),
  });

  // ---------- Initial data loading ----------
  useEffect(() => {
    if (session?.user?.id && eventId) {
      fetchEventAndConversation();
    }
  }, [session?.user?.id, eventId]);

  // Fetch messages once we know the conversation id
  useEffect(() => {
    if (conversation?.id) {
      fetchMessages(conversation.id);
    }
  }, [conversation?.id]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const fetchEventAndConversation = async () => {
    try {
      // Fetch event details
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select(
          `
          *,
          creator:profiles!events_user_id_fkey(*),
          attendees:attendance(
            user:profiles(*)
          )
        `
        )
        .eq('id', Number(eventId))
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      // Extract participants
      const attendeeProfiles = eventData.attendees?.map((a: any) => a.user) || [];
      setParticipants(attendeeProfiles);

      // Fetch conversation for this event
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('event_id', Number(eventId))
        .single();

      if (convError) throw convError;
      setConversation(convData);

      // Mark messages as read for this conversation
      if (convData) {
        markMessagesAsRead(convData.id);
      }
    } catch (error) {
      console.error('Error fetching event/conversation:', error);
      setLoading(false);
    }
  };

  const fetchMessages = async (convId: number) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(
          `
          *,
          user:profiles(*),
          reply_to:messages!reply_to_id(
            *,
            user:profiles(*)
          )
        `
        )
        .eq('conversation_id', convId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      scrollToEnd();
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async (conversationId: number) => {
    if (!session?.user?.id) return;
    try {
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', session.user.id);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // ---------- Typing ----------
  const startTyping = async () => {
    if (!conversation || !session?.user?.id || isTyping) return;
    setIsTyping(true);

    try {
      await supabase.from('typing_indicators').upsert({
        conversation_id: conversation.id,
        user_id: session.user.id,
        started_at: new Date().toISOString(),
      });

      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 10000);
    } catch (error) {
      console.error('Error setting typing indicator:', error);
    }
  };

  const stopTyping = async () => {
    if (!conversation || !session?.user?.id) return;

    setIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    try {
      await supabase
        .from('typing_indicators')
        .delete()
        .eq('conversation_id', conversation.id)
        .eq('user_id', session.user.id);
    } catch (error) {
      console.error('Error removing typing indicator:', error);
    }
  };

  const handleTextChange = (text: string) => {
    setInputText(text);

    if (text.length > 0 && !isTyping) {
      startTyping();
    } else if (text.length === 0 && isTyping) {
      stopTyping();
    }
  };

  // ---------- Send (Optimistic) ----------
  const sendMessage = async () => {
    if (!inputText.trim() || !session?.user?.id || !conversation) return;

    setSending(true);
    const messageText = inputText.trim();
    setInputText('');

    // Optimistic local message (negative temp id to avoid clash)
    const tempId = -Date.now();
    const optimistic: MessageWithDetails = {
      id: tempId as any,
      conversation_id: conversation.id,
      event_id: Number(eventId),
      user_id: session.user.id,
      content: messageText,
      message_type: 'text',
      created_at: new Date().toISOString(),
      is_deleted: false,
      user:
        participants.find((p) => p.id === session.user.id) ||
        ({} as any),
      reply_to: null as any,
    };

    setMessages((prev) => [...prev, optimistic]);
    scrollToEnd();

    try {
      // Insert and return the full row (including joined user)
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          event_id: Number(eventId),
          user_id: session.user.id,
          content: messageText,
          message_type: 'text',
        })
        .select(
          `
          *,
          user:profiles(*),
          reply_to:messages!reply_to_id(*, user:profiles(*))
        `
        )
        .single();

      if (error || !data) throw error || new Error('No data returned');

      // Replace optimistic with real
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        return upsertMessage(withoutTemp as any, data as any);
      });

      stopTyping();
    } catch (e) {
      // Rollback optimistic on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(messageText);
      Alert.alert('Error', 'Failed to send message');
      console.error('Error sending message:', e);
    } finally {
      setSending(false);
    }
  };

  // ---------- Renderers ----------
  const renderMessage = ({
    item,
    index,
  }: {
    item: MessageWithDetails;
    index: number;
  }) => {
    const isOwnMessage = item.user_id === session?.user?.id;
    const showAvatar =
      !isOwnMessage &&
      (index === 0 || messages[index - 1]?.user_id !== item.user_id);

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage && styles.ownMessageContainer,
        ]}
      >
        {!isOwnMessage && showAvatar && (
          <Pressable onPress={() => router.push(`/profile/${item.user_id}`)}>
            <Image
              source={{
                uri: item?.user?.avatar_url || 'https://via.placeholder.com/32',
              }}
              style={styles.messageAvatar}
            />
          </Pressable>
        )}
        {!isOwnMessage && !showAvatar && <View style={styles.avatarPlaceholder} />}

        <View
          style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble]}
        >
          {!isOwnMessage && showAvatar && (
            <Text style={styles.senderName}>
              {item?.user?.full_name || 'Unknown'}
            </Text>
          )}
          {item.reply_to?.content ? (
            <View style={styles.replyContainer}>
              <Text style={styles.replyName}>
                {item.reply_to.user?.full_name || 'Unknown'}
              </Text>
              <Text style={styles.replyText} numberOfLines={1}>
                {item.reply_to.content}
              </Text>
            </View>
          ) : null}
          <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}>
            {format(new Date(item.created_at), 'HH:mm')}
          </Text>
        </View>
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;

    const names = typingUsers
      .slice(0, 2)
      .map((u) => u.full_name?.split(' ')[0])
      .join(', ');
    const text =
      typingUsers.length > 2
        ? `${names} and ${typingUsers.length - 2} others are typing...`
        : `${names} ${typingUsers.length === 1 ? 'is' : 'are'} typing...`;

    return (
      <View style={styles.typingContainer}>
        <View style={styles.typingDots}>
          <View style={[styles.dot]} />
          <View style={[styles.dot]} />
          <View style={[styles.dot]} />
        </View>
        <Text style={styles.typingText}>{text}</Text>
      </View>
    );
  };

  // ---------- UI ----------
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>

        <Pressable
          style={styles.headerInfo}
          onPress={() => router.push(`/event/${eventId}`)}
        >
          <Image
            source={{ uri: event?.image_uri || 'https://via.placeholder.com/40' }}
            style={styles.headerAvatar}
          />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {event?.title || 'Group Chat'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {participants.length} members
            </Text>
          </View>
        </Pressable>

        <Pressable style={styles.moreButton}>
          <Ionicons name="ellipsis-vertical" size={24} color="#000" />
        </Pressable>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.messagesContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.messagesList}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToEnd}
          ListFooterComponent={renderTypingIndicator}
        />

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Type something..."
            value={inputText}
            onChangeText={handleTextChange}
            multiline
            maxLength={1000}
          />
          <Pressable
            style={[
              styles.sendButton,
              (!inputText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
          >
            <Ionicons
              name="send"
              size={20}
              color={inputText.trim() && !sending ? '#007AFF' : '#ccc'}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  moreButton: {
    marginLeft: 12,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    paddingVertical: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  avatarPlaceholder: {
    width: 32,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    padding: 12,
  },
  ownMessageBubble: {
    backgroundColor: '#007AFF',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  replyContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
    padding: 8,
    marginBottom: 8,
    borderRadius: 4,
  },
  replyName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  replyText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  messageText: {
    fontSize: 15,
    color: '#000',
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dateText: {
    fontSize: 12,
    color: '#666',
    paddingHorizontal: 12,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingDots: {
    flexDirection: 'row',
    marginRight: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
    marginHorizontal: 2,
  },
  typingText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});