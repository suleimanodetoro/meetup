// app/chat/dm/[conversationId].tsx
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
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import { Message, Profile, Conversation } from '~/types/messaging';
import { useAuth } from '../../contexts/AuthProvider';
import { supabase } from '~/utils/supabase';
import { useChatSubscriptions } from '~/hooks/useChatSubscriptions';

interface MessageWithUser extends Message {
  user?: Profile;
  reply_to?: MessageWithUser;
}

export default function DMChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { session } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  
  const [messages, setMessages] = useState<MessageWithUser[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [typingUsers, setTypingUsers] = useState<Profile[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Use the subscription hook with proper callbacks
  const { cleanupSubscriptions } = useChatSubscriptions({
    conversationId: Number(conversationId),
    onNewMessage: useCallback((newMessage: MessageWithUser) => {
      setMessages(prev => {
        // Check if message already exists to prevent duplicates
        const exists = prev.some(m => m.id === newMessage.id);
        if (exists) return prev;
        return [...prev, newMessage];
      });
      
      // Scroll to bottom for new messages
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, []),
    onTypingUpdate: useCallback((users: Profile[]) => {
      setTypingUsers(users);
    }, []),
  });

  // Fetch conversation and participant details
  const fetchConversationDetails = async () => {
    if (!conversationId || !session?.user?.id) return;

    try {
      // Fetch conversation with participants
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select(`
          *,
          conversation_participants!inner(
            user_id,
            joined_at,
            last_read_at,
            profiles:user_id(*)
          )
        `)
        .eq('id', conversationId)
        .eq('type', 'dm')
        .single();

      if (convError) throw convError;
      setConversation(convData);

      // Find the other user in the conversation
      const otherParticipant = convData.conversation_participants.find(
        (p: any) => p.user_id !== session.user.id
      );
      
      if (otherParticipant?.profiles) {
        setOtherUser(otherParticipant.profiles);
      }
    } catch (error: any) {
      console.error('Error fetching conversation details:', error);
      Alert.alert(
        'Error',
        'Failed to load conversation. Please try again.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  };

  // Fetch messages
  const fetchMessages = async () => {
    if (!conversationId) return;

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

      if (error) {
        console.error('Error fetching messages:', error);
        throw error;
      }

      setMessages(data || []);
      
      // Mark messages as read
      await markMessagesAsRead();
      
      // Scroll to bottom after messages load
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Mark messages as read
  const markMessagesAsRead = async () => {
    if (!session?.user?.id || !conversationId) return;

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

  // Send message
  const sendMessage = async () => {
    if (!inputText.trim() || !conversation || !session?.user?.id || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);
    
    // Stop typing when sending
    await stopTyping();

    // Create optimistic message
    const optimisticMessage: MessageWithUser = {
      id: -Date.now(), // Temporary negative ID
      conversation_id: conversation.id,
      user_id: session.user.id,
      content: messageText,
      message_type: 'text',
      created_at: new Date().toISOString(),
      is_deleted: false,
      user: {
        id: session.user.id,
        full_name: session.user.user_metadata?.full_name || 'You',
        avatar_url: session.user.user_metadata?.avatar_url,
      } as Profile,
    };

    // Add optimistic message
    setMessages(prev => [...prev, optimisticMessage]);
    
    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);

    try {
      // Insert message
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          user_id: session.user.id,
          content: messageText,
          message_type: 'text',
        })
        .select(`
          *,
          user:profiles(*),
          reply_to:messages!reply_to_id(
            *,
            user:profiles(*)
          )
        `)
        .single();

      if (error) throw error;

      // Replace optimistic message with real one
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== optimisticMessage.id);
        return [...filtered, data];
      });
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
      setInputText(messageText); // Restore message on error
      
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Handle typing indicator
  const handleTextChange = (text: string) => {
    setInputText(text);
    
    if (text.length > 0 && !isTyping) {
      startTyping();
    } else if (text.length === 0 && isTyping) {
      stopTyping();
    }
  };

  const startTyping = async () => {
    if (!conversation || !session?.user?.id || isTyping) return;

    setIsTyping(true);
    
    try {
      await supabase
        .from('typing_indicators')
        .upsert({
          conversation_id: conversation.id,
          user_id: session.user.id,
          started_at: new Date().toISOString(),
        });

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Auto-stop after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 3000);
    } catch (error) {
      console.error('Error setting typing indicator:', error);
    }
  };

  const stopTyping = async () => {
    if (!conversation || !session?.user?.id) return;

    setIsTyping(false);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = undefined;
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

  // Initial load
  useEffect(() => {
    if (session?.user?.id && conversationId) {
      fetchConversationDetails();
      fetchMessages();
    }

    // Cleanup on unmount
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      stopTyping();
      cleanupSubscriptions();
    };
  }, [session?.user?.id, conversationId]);

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchMessages();
  };

  // Render message item
  const renderMessage = ({ item }: { item: MessageWithUser }) => {
    const isOwnMessage = item.user_id === session?.user?.id;
    const messageTime = format(new Date(item.created_at), 'HH:mm');

    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
      ]}>
        {!isOwnMessage && (
          <Pressable onPress={() => router.push(`/profile/${item.user_id}`)}>
            <Image
              source={{ uri: item.user?.avatar_url || 'https://via.placeholder.com/30' }}
              style={styles.messageAvatar}
            />
          </Pressable>
        )}
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble
        ]}>
          {item.reply_to?.content && (
            <View style={styles.replyContainer}>
              <Text style={styles.replyName}>{item.reply_to.user?.full_name}</Text>
              <Text style={styles.replyText} numberOfLines={1}>
                {item.reply_to.content}
              </Text>
            </View>
          )}
          <Text style={[
            styles.messageText,
            isOwnMessage ? styles.ownMessageText : styles.otherMessageText
          ]}>
            {item.content}
          </Text>
          <Text style={[
            styles.messageTime,
            isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
          ]}>
            {messageTime}
          </Text>
        </View>
      </View>
    );
  };

  // Render typing indicator
  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;

    return (
      <View style={styles.typingContainer}>
        <View style={styles.typingDots}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
        <Text style={styles.typingText}>
          {otherUser?.full_name || 'User'} is typing...
        </Text>
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Pressable 
          style={styles.headerCenter}
          onPress={() => otherUser && router.push(`/profile/${otherUser.id}`)}
        >
          <Image
            source={{ uri: otherUser?.avatar_url || 'https://via.placeholder.com/40' }}
            style={styles.headerAvatar}
          />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {otherUser?.full_name || 'Direct Message'}
          </Text>
        </Pressable>
        <Pressable style={styles.headerButton}>
          <Ionicons name="information-circle-outline" size={24} color="#000" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.messagesList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListFooterComponent={renderTypingIndicator}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            multiline
            maxHeight={100}
            editable={!sending}
          />
          <Pressable
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '70%',
    padding: 12,
    borderRadius: 16,
  },
  ownMessageBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  replyContainer: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  replyName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 12,
    opacity: 0.8,
  },
  messageText: {
    fontSize: 16,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#000',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherMessageTime: {
    color: 'rgba(0,0,0,0.5)',
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
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#999',
    marginHorizontal: 2,
    opacity: 0.6,
  },
  typingText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});