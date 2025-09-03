// app/chat/dm/[conversationId].tsx

import React, { useState, useEffect, useRef } from 'react';
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

import { format, isToday, isYesterday } from 'date-fns';
import {
  Message,
  MessageWithDetails,
  Profile,
  Conversation,
  TypingIndicator,
} from '~/types/messaging';
import { useAuth } from '~/app/contexts/AuthProvider';
import { supabase } from '~/utils/supabase';

export default function DMChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { session } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  
  const [messages, setMessages] = useState<MessageWithDetails[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (session?.user?.id && conversationId) {
      fetchConversationDetails();
      fetchMessages();
      subscribeToMessages();
      subscribeToTyping();
      subscribeToPresence();
    }
  }, [session, conversationId]);

  const fetchConversationDetails = async () => {
    try {
      // Fetch conversation with participants
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select(`
          *,
          participants:conversation_participants(
            *,
            profile:profiles(*)
          )
        `)
        .eq('id', conversationId)
        .eq('type', 'dm')
        .single();

      if (convError) throw convError;
      
      setConversation(convData);

      // Find the other user
      const otherParticipant = convData.participants.find(
        p => p.user_id !== session?.user?.id
      );
      
      if (otherParticipant?.profile) {
        setOtherUser(otherParticipant.profile);
        
        // Check if they're online
        checkUserOnlineStatus(otherParticipant.user_id);
      }

      // Mark messages as read
      markMessagesAsRead();
    } catch (error) {
      console.error('Error fetching conversation:', error);
      Alert.alert('Error', 'Failed to load conversation');
      router.back();
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          user:profiles(*),
          reply_to:messages!reply_to_id(
            *,
            user:profiles(*)
          ),
          read_receipts:message_read_receipts(
            user:profiles(*)
          )
        `)
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    if (!session?.user?.id) return;

    try {
      // Update last read timestamp
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', session.user.id);

      // Mark individual messages as read
      await supabase.rpc('mark_conversation_as_read', {
        p_conversation_id: parseInt(conversationId),
        p_user_id: session.user.id
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const checkUserOnlineStatus = async (userId: string) => {
    // Check last activity or presence
    // This would integrate with your presence system
    const channel = supabase.channel('online-users');
    const presenceState = await channel.presenceState();
    
    const userPresence = Object.values(presenceState).flat().find(
      (presence: any) => presence.user_id === userId
    );
    
    setIsOnline(!!userPresence);
    if (!userPresence) {
      // Fetch last seen from database
      const { data } = await supabase
        .from('profiles')
        .select('last_seen_at')
        .eq('id', userId)
        .single();
      
      setLastSeen(data?.last_seen_at);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`dm_chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          // Fetch full message with user data
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
              markMessagesAsRead();
            }
            
            // Auto-scroll to bottom
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToTyping = () => {
    const channel = supabase
      .channel(`typing:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          if (payload.new && payload.new.user_id !== session?.user?.id) {
            setOtherUserTyping(true);
            // Auto-hide after 3 seconds
            setTimeout(() => setOtherUserTyping(false), 3000);
          } else if (payload.eventType === 'DELETE') {
            setOtherUserTyping(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToPresence = () => {
    if (!otherUser?.id) return;

    const channel = supabase
      .channel('online-users')
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const isUserOnline = Object.values(state).flat().some(
          (presence: any) => presence.user_id === otherUser.id
        );
        setIsOnline(isUserOnline);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !session?.user?.id || !conversation) return;

    setSending(true);
    const messageText = inputText.trim();
    setInputText('');

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: parseInt(conversationId),
          user_id: session.user.id,
          content: messageText,
          message_type: 'text',
        });

      if (error) throw error;

      // Stop typing indicator
      stopTyping();
    } catch (error) {
      console.error('Error sending message:', error);
      setInputText(messageText);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const startTyping = async () => {
    if (!conversation || !session?.user?.id || isTyping) return;

    setIsTyping(true);
    try {
      await supabase
        .from('typing_indicators')
        .upsert({
          conversation_id: parseInt(conversationId),
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
    if (!conversation || !session?.user?.id || !isTyping) return;

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

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, 'HH:mm')}`;
    } else {
      return format(date, 'MMM d, HH:mm');
    }
  };

  const getLastSeenText = () => {
    if (isOnline) return 'Online';
    if (!lastSeen) return 'Offline';
    
    const date = new Date(lastSeen);
    if (isToday(date)) {
      return `Last seen today at ${format(date, 'HH:mm')}`;
    } else if (isYesterday(date)) {
      return `Last seen yesterday at ${format(date, 'HH:mm')}`;
    } else {
      return `Last seen ${format(date, 'MMM d')}`;
    }
  };

  const renderMessage = ({ item, index }: { item: MessageWithDetails; index: number }) => {
    const isOwnMessage = item.user_id === session?.user?.id;
    const showReadReceipt = isOwnMessage && item.read_receipts?.length > 0;

    return (
      <View style={[styles.messageContainer, isOwnMessage && styles.ownMessageContainer]}>
        <View style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble]}>
          {item.reply_to && (
            <View style={styles.replyContainer}>
              <Text style={styles.replyName}>
                {item.reply_to.user?.full_name}
              </Text>
              <Text style={styles.replyText} numberOfLines={1}>
                {item.reply_to.content}
              </Text>
            </View>
          )}
          <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}>
              {formatMessageTime(item.created_at)}
            </Text>
            {showReadReceipt && (
              <Ionicons 
                name="checkmark-done" 
                size={14} 
                color={isOwnMessage ? 'rgba(255,255,255,0.7)' : '#007AFF'} 
              />
            )}
          </View>
        </View>
      </View>
    );
  };

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
          onPress={() => otherUser && router.push(`/profile/${otherUser.id}`)}
        >
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: otherUser?.avatar_url || 'https://via.placeholder.com/40' }}
              style={styles.headerAvatar}
            />
            {isOnline && <View style={styles.onlineIndicator} />}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {otherUser?.full_name || otherUser?.username || 'Unknown'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {otherUserTyping ? 'Typing...' : getLastSeenText()}
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
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>
                Start a conversation with {otherUser?.full_name}
              </Text>
            </View>
          }
        />

        {/* Typing indicator */}
        {otherUserTyping && (
          <View style={styles.typingContainer}>
            <View style={styles.typingBubble}>
              <View style={styles.typingDots}>
                <View style={[styles.dot, styles.dot1]} />
                <View style={[styles.dot, styles.dot2]} />
                <View style={[styles.dot, styles.dot3]} />
              </View>
            </View>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            value={inputText}
            onChangeText={handleTextChange}
            multiline
            maxLength={1000}
          />
          <Pressable 
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
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
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
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
  messageBubble: {
    maxWidth: '75%',
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    padding: 12,
  },
  ownMessageBubble: {
    backgroundColor: '#007AFF',
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
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    color: '#666',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyChatText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  typingBubble: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    padding: 12,
    alignSelf: 'flex-start',
    maxWidth: 80,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
    marginHorizontal: 2,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
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