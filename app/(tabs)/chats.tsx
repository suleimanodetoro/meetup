// app/(tabs)/chats.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthProvider';
import { supabase } from '~/utils/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

type ChatItem = {
  conversation_id: number;
  conversation_type: 'dm' | 'group';
  conversation_name: string;
  avatar_url: string;
  last_message_content: string;
  last_message_at: string;
  last_message_user_name: string;
  unread_count: number;
  participant_count: number;
  event_id: number | null;
  event_country_code: string | null;
};

export default function ChatsScreen() {
  const { session } = useAuth();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'dms' | 'plans'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  
  // Store subscription reference to prevent multiple subscriptions
  const subscriptionRef = useRef<RealtimeChannel | null>(null);

  // Fetch conversations with proper error handling
  const fetchConversations = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      // Don't set loading if we're refreshing
      if (!refreshing) {
        setLoading(true);
      }
      
      // Use the RPC function to get all conversations
      const { data, error } = await supabase
        .rpc('get_user_conversations', {
          p_user_id: session.user.id
        });

      if (error) {
        console.error('Error fetching conversations:', error);
        return;
      }

      // Store all data
      setChats(data || []);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user?.id, refreshing]);

  // Fetch pending friend requests
  const fetchPendingRequests = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const { count } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('addressee_id', session.user.id)
        .eq('status', 'pending');

      setPendingRequestsCount(count || 0);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    }
  }, [session?.user?.id]);

  // Setup realtime subscription with proper cleanup
  const setupSubscription = useCallback(() => {
    if (!session?.user?.id) return;

    // Clean up existing subscription first
    if (subscriptionRef.current) {
      console.log('Cleaning up existing subscription');
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }

    console.log('Setting up new chat list subscription');
    
    // Create new subscription
    const channel = supabase
      .channel(`chat_list_${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          console.log('New message received, refreshing chat list');
          fetchConversations();
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
          console.log('Participant change, refreshing chat list');
          fetchConversations();
        }
      )
      .subscribe((status) => {
        console.log('Chat list subscription status:', status);
      });

    subscriptionRef.current = channel;
  }, [session?.user?.id, fetchConversations]);

  // Initial load effect
  useEffect(() => {
    if (session?.user?.id) {
      fetchConversations();
      fetchPendingRequests();
      setupSubscription();
    }

    // Cleanup function
    return () => {
      if (subscriptionRef.current) {
        console.log('Cleaning up subscription on unmount');
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [session?.user?.id]); // Only depend on session, not activeTab

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConversations();
    fetchPendingRequests();
  }, [fetchConversations, fetchPendingRequests]);

  // Format time helper
  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return format(date, 'HH:mm');
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else if (diffInHours < 168) {
      return format(date, 'EEEE');
    } else {
      return format(date, 'dd/MM/yyyy');
    }
  };

  // Filter chats based on active tab
  const getFilteredChats = useCallback(() => {
    if (!chats) return [];
    
    switch (activeTab) {
      case 'dms':
        return chats.filter(item => item.conversation_type === 'dm');
      case 'plans':
        return chats.filter(item => item.conversation_type === 'group');
      default:
        return chats;
    }
  }, [chats, activeTab]);

  // Render chat item
  const renderChatItem = ({ item }: { item: ChatItem }) => {
    const chatName = item.conversation_name || 'Unknown Chat';
    const avatarUrl = item.avatar_url || 'https://via.placeholder.com/50';
    const lastMessageTime = item.last_message_at;
    const lastMessageContent = item.last_message_content || '';
    const unreadCount = item.unread_count || 0;
    const conversationId = item.conversation_id;
    const eventId = item.event_id;
    const conversationType = item.conversation_type;
    
    return (
      <Pressable
        style={styles.chatItem}
        onPress={() => {
          if (conversationType === 'group' && eventId) {
            router.push(`/chat/${eventId}`);
          } else {
            router.push(`/chat/dm/${conversationId}`);
          }
        }}>
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName} numberOfLines={1}>
              {chatName}
            </Text>
            {lastMessageTime && (
              <Text style={styles.timestamp}>{formatTime(lastMessageTime)}</Text>
            )}
          </View>
          <View style={styles.messagePreview}>
            <Text 
              style={[
                styles.lastMessage,
                unreadCount > 0 && styles.unreadMessage
              ]} 
              numberOfLines={1}>
              {item.last_message_user_name && `${item.last_message_user_name}: `}
              {lastMessageContent}
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  // Get filtered data
  const filteredChats = getFilteredChats();

  // Empty state component
  const renderEmptyState = () => {
    let emptyMessage = '';
    let emptySubtext = '';

    switch (activeTab) {
      case 'dms':
        emptyMessage = 'No direct messages yet';
        emptySubtext = 'Start a conversation with someone!';
        break;
      case 'plans':
        emptyMessage = 'No plan chats yet';
        emptySubtext = 'Join or create a plan to start chatting';
        break;
      default:
        emptyMessage = 'No conversations yet';
        emptySubtext = 'Start chatting with other travelers!';
    }

    return (
      <View style={styles.emptyContainer}>
        {/* Friend Requests Card */}
        {pendingRequestsCount > 0 && activeTab === 'all' && (
          <Pressable 
            style={styles.friendRequestCard}
            onPress={() => router.push('/friend-requests')}>
            <View style={styles.friendRequestIcon}>
              <Ionicons name="person-add" size={24} color="#007AFF" />
              {pendingRequestsCount > 0 && (
                <View style={styles.requestBadge}>
                  <Text style={styles.requestBadgeText}>{pendingRequestsCount}</Text>
                </View>
              )}
            </View>
            <View style={styles.friendRequestContent}>
              <Text style={styles.friendRequestTitle}>Friend Requests</Text>
              <Text style={styles.friendRequestSubtitle}>
                {pendingRequestsCount} pending request{pendingRequestsCount !== 1 ? 's' : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </Pressable>
        )}

        <View style={styles.emptyState}>
          <Ionicons 
            name={activeTab === 'dms' ? 'chatbubbles-outline' : 'people-outline'} 
            size={60} 
            color="#ccc" 
          />
          <Text style={styles.emptyTitle}>{emptyMessage}</Text>
          <Text style={styles.emptySubtitle}>{emptySubtext}</Text>
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <View style={styles.headerActions}>
          <Pressable 
            style={styles.headerButton}
            onPress={() => setShowSearch(!showSearch)}>
            <Ionicons name="search" size={24} color="#000" />
          </Pressable>
          <Pressable 
            style={styles.headerButton}
            onPress={() => router.push('/search-users')}>
            <Ionicons name="person-add-outline" size={24} color="#000" />
          </Pressable>
        </View>
      </View>

      {/* Search Bar */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable 
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}>
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            All
          </Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, activeTab === 'dms' && styles.activeTab]}
          onPress={() => setActiveTab('dms')}>
          <Text style={[styles.tabText, activeTab === 'dms' && styles.activeTabText]}>
            DMs
          </Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, activeTab === 'plans' && styles.activeTab]}
          onPress={() => setActiveTab('plans')}>
          <Text style={[styles.tabText, activeTab === 'plans' && styles.activeTabText]}>
            Plans
          </Text>
        </Pressable>
      </View>

      {/* Chat List */}
      <FlatList
        data={filteredChats}
        renderItem={renderChatItem}
        keyExtractor={(item) => `${item.conversation_id}`}
        contentContainerStyle={filteredChats.length === 0 && styles.emptyListContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tab: {
    marginRight: 25,
    paddingBottom: 5,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    marginRight: 8,
  },
  unreadMessage: {
    fontWeight: '600',
    color: '#000',
  },
  unreadBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyListContent: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
  },
  friendRequestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#f8f8f8',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 10,
  },
  friendRequestIcon: {
    position: 'relative',
    marginRight: 15,
  },
  requestBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  friendRequestContent: {
    flex: 1,
  },
  friendRequestTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  friendRequestSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});