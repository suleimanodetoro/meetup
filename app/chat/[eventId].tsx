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
  Message,
  MessageWithDetails,
  Profile,
  Event,
  TypingIndicator,
  Conversation,
} from '~/types/messaging';
import { useAuth } from '../contexts/AuthProvider';
import { supabase } from '~/utils/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export default function GroupChatScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { session } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  
  // Store channel references for cleanup
  const messageChannelRef = useRef<RealtimeChannel | null>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  
  const [messages, setMessages] = useState<MessageWithDetails[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [participants, setParticipants] = useState<Profile[]>([]);
  const [typingUsers, setTypingUsers] = useState<Profile[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Cleanup function for subscriptions
  const cleanupSubscriptions = useCallback(() => {
    console.log('Cleaning up chat subscriptions');
    
    if (messageChannelRef.current) {
      supabase.removeChannel(messageChannelRef.current);
      messageChannelRef.current = null;
    }
    
    if (typingChannelRef.current) {
      supabase.removeChannel(typingChannelRef.current);
      typingChannelRef.current = null;
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = undefined;
    }
  }, []);

  // Main effect for setting up the chat
  useEffect(() => {
    let mounted = true;

    const setupChat = async () => {
      if (!session?.user?.id || !eventId) return;
      
      try {
        // Fetch initial data
        await fetchEventAndConversation();
        await fetchMessages();
        
        // Only setup subscriptions if component is still mounted
        if (mounted) {
          setupMessageSubscription();
          setupTypingSubscription();
        }
      } catch (error) {
        console.error('Error setting up chat:', error);
        if (mounted) {
          Alert.alert('Error', 'Failed to load chat. Please try again.');
        }
      }
    };

    setupChat();

    // Cleanup on unmount
    return () => {
      mounted = false;
      cleanupSubscriptions();
    };
  }, [session?.user?.id, eventId]);

  const fetchEventAndConversation = async () => {
    if (!eventId) return;
    
    try {
      // Fetch event details with proper error handling
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select(`
          *,
          creator:profiles!events_user_id_fkey(*),
          attendees:attendance(
            user:profiles(*)
          )
        `)
        .eq('id', eventId)
        .single();

      if (eventError) {
        console.error('Error fetching event:', eventError);
        
        // Check if it's a policy error
        if (eventError.code === '42P17') {
          throw new Error('Database permission error. Please contact support.');
        }
        throw eventError;
      }
      
      setEvent(eventData);

      // Extract participants safely
      const attendeeProfiles = eventData?.attendees?.map(a => a.user).filter(Boolean) || [];
      setParticipants(attendeeProfiles);

      // Fetch conversation
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('event_id', eventId)
        .single();

      if (convError) {
        console.error('Error fetching conversation:', convError);
        
        // If no conversation exists, it might not have been created yet
        if (convError.code === 'PGRST116') {
          // Try to create one (this should normally be done by triggers)
          console.log('No conversation found, attempting to create one');
          // You might want to call a function to create the conversation here
        } else if (convError.code === '42P17') {
          throw new Error('Database permission error. Please contact support.');
        }
      } else {
        setConversation(convData);
        
        // Mark messages as read
        if (convData) {
          await markMessagesAsRead(convData.id);
        }
      }
    } catch (error: any) {
      console.error('Error in fetchEventAndConversation:', error);
      Alert.alert(
        'Error Loading Chat',
        error.message || 'Failed to load chat details. Please try again.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  };

  const fetchMessages = async () => {
    if (!eventId) return;
    
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
        .eq('event_id', eventId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        
        if (error.code === '42P17') {
          throw new Error('Database permission error. Please contact support.');
        }
        throw error;
      }
      
      setMessages(data || []);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      // Don't show alert here as it might be triggered multiple times
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

  const setupMessageSubscription = () => {
    if (!eventId || messageChannelRef.current) return;
    
    console.log('Setting up message subscription for event:', eventId);
    
    const channel = supabase
      .channel(`event_chat:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          console.log('New message received:', payload);
          
          // Fetch complete message with user details
          const { data: newMessage } = await supabase
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

          if (newMessage) {
            setMessages(prev => [...prev, newMessage]);
            
            // Scroll to bottom if it's not our message
            if (newMessage.user_id !== session?.user?.id) {
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Message subscription status:', status);
      });

    messageChannelRef.current = channel;
  };

  const setupTypingSubscription = () => {
    if (!conversation?.id || typingChannelRef.current) return;
    
    console.log('Setting up typing subscription for conversation:', conversation.id);
    
    const channel = supabase
      .channel(`typing:${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        async (payload) => {
          if (payload.new?.user_id && payload.new.user_id !== session?.user?.id) {
            // Find the user who is typing
            const typingUser = participants.find(p => p.id === payload.new.user_id);
            if (typingUser) {
              setTypingUsers(prev => {
                const exists = prev.some(u => u.id === typingUser.id);
                if (!exists) return [...prev, typingUser];
                return prev;
              });

              // Remove after 3 seconds
              setTimeout(() => {
                setTypingUsers(prev => prev.filter(u => u.id !== typingUser.id));
              }, 3000);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Typing subscription status:', status);
      });

    typingChannelRef.current = channel;
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !conversation || !session?.user?.id || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          event_id: parseInt(eventId),
          user_id: session.user.id,
          content: messageText,
          message_type: 'text',
        });

      if (error) throw error;

      // Stop typing indicator
      stopTyping();
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      console.error('Error sending message:', error);
      setInputText(messageText); // Restore message on error
      
      if (error.code === '42P17') {
        Alert.alert('Error', 'Permission error. Please try rejoining the chat.');
      } else {
        Alert.alert('Error', 'Failed to send message. Please try again.');
      }
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
          conversation_id: conversation.id,
          user_id: session.user.id,
          started_at: new Date().toISOString(),
        });

      // Auto-stop typing after 10 seconds
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

  const handleTextChange = (text: string) => {
    setInputText(text);
    
    if (text.length > 0 && !isTyping) {
      startTyping();
    } else if (text.length === 0 && isTyping) {
      stopTyping();
    }
  };

  const renderMessage = ({ item, index }: { item: MessageWithDetails; index: number }) => {
    const isOwnMessage = item.user_id === session?.user?.id;
    const showAvatar = index === 0 || messages[index - 1]?.user_id !== item.user_id;
    const isFirstInGroup = showAvatar;
    const isLastInGroup = index === messages.length - 1 || messages[index + 1]?.user_id !== item.user_id;

    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage && styles.ownMessageContainer,
      ]}>
        {!isOwnMessage && showAvatar && (
          <Image
            source={{ uri: item.user?.avatar_url || 'https://via.placeholder.com/40' }}
            style={styles.messageAvatar}
          />
        )}
        {!isOwnMessage && !showAvatar && <View style={styles.avatarSpacer} />}
        
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
          isFirstInGroup && (isOwnMessage ? styles.firstOwnMessage : styles.firstOtherMessage),
          isLastInGroup && (isOwnMessage ? styles.lastOwnMessage : styles.lastOtherMessage),
        ]}>
          {!isOwnMessage && showAvatar && (
            <Text style={styles.senderName}>{item.user?.full_name || 'Unknown'}</Text>
          )}
          
          {item.reply_to && (
            <View style={styles.replyContainer}>
              <Text style={styles.replyText}>
                {item.reply_to.user?.full_name}: {item.reply_to.content}
              </Text>
            </View>
          )}
          
          <Text style={[
            styles.messageText,
            isOwnMessage && styles.ownMessageText,
          ]}>
            {item.content}
          </Text>
          
          <Text style={[
            styles.messageTime,
            isOwnMessage && styles.ownMessageTime,
          ]}>
            {format(new Date(item.created_at), 'HH:mm')}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Chat not found</Text>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </Pressable>
          
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>{event.title}</Text>
            <Text style={styles.headerSubtitle}>
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
            </Text>
          </View>
          
          <Pressable 
            onPress={() => router.push(`/event/${eventId}`)} 
            style={styles.headerButton}
          >
            <Ionicons name="information-circle-outline" size={24} color="#333" />
          </Pressable>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Typing Indicators */}
        {typingUsers.length > 0 && (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>
              {typingUsers.map(u => u.full_name).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </Text>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            multiline
            maxLength={1000}
            editable={!sending}
          />
          <Pressable
            onPress={sendMessage}
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
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
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#4A90E2',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  headerButton: {
    padding: 4,
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-end',
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
  avatarSpacer: {
    width: 40,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 18,
  },
  ownMessage: {
    backgroundColor: '#4A90E2',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  firstOwnMessage: {
    borderTopRightRadius: 18,
  },
  firstOtherMessage: {
    borderTopLeftRadius: 18,
  },
  lastOwnMessage: {
    borderBottomRightRadius: 18,
  },
  lastOtherMessage: {
    borderBottomLeftRadius: 18,
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '600',
  },
  replyContainer: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    marginBottom: 8,
  },
  replyText: {
    fontSize: 12,
    color: '#666',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f9f9f9',
  },
  typingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    fontSize: 16,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});