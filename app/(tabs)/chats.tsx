// app/(tabs)/chats.tsx
import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (session?.user?.id) {
      fetchConversations();
      fetchPendingRequests();
      subscribeToMessages();
    }
  }, [session, activeTab]);

  const fetchConversations = async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      
      // Use the RPC function to get all conversations
      const { data, error } = await supabase
        .rpc('get_user_conversations', {
          p_user_id: session.user.id
        });

      if (error) {
        console.error('Error fetching conversations:', error);
        return;
      }

      // Filter based on active tab
      let filteredData = data || [];
      if (activeTab === 'dms') {
        filteredData = filteredData.filter(item => item.conversation_type === 'dm');
      } else if (activeTab === 'plans') {
        filteredData = filteredData.filter(item => item.conversation_type === 'group');
      }

      setChats(filteredData);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPendingRequests = async () => {
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
  };

  const subscribeToMessages = () => {
    // Subscribe to new messages to refresh the chat list
    const channel = supabase
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
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants',
        },
        () => {
          // Refresh when participants change
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

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
          } else if (conversationType === 'dm') {
            router.push(`/chat/dm/${conversationId}`);
          }
        }}
      >
        <Image
          source={{ uri: avatarUrl }}
          style={styles.avatar}
        />
        
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName} numberOfLines={1}>
              {chatName}
            </Text>
            {lastMessageTime && (
              <Text style={styles.timestamp}>
                {formatTime(lastMessageTime)}
              </Text>
            )}
          </View>
          
          <View style={styles.messagePreview}>
            <Text style={[styles.lastMessage, unreadCount > 0 && styles.unreadMessage]} numberOfLines={1}>
              {lastMessageContent || 'No messages yet'}
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

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'dms' 
          ? 'Start a conversation with a friend'
          : activeTab === 'plans'
          ? 'Join a plan to start chatting'
          : 'Your messages will appear here'}
      </Text>
    </View>
  );

  const filteredChats = chats.filter(chat => {
    if (!searchQuery) return true;
    const chatName = chat.conversation_name || '';
    return chatName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Chats</Text>
          <View style={styles.headerActions}>
            {pendingRequestsCount > 0 && (
              <Pressable
                style={styles.requestsBadge}
                onPress={() => router.push('/friend-requests')}
              >
                <Text style={styles.requestsText}>
                  {pendingRequestsCount} Request{pendingRequestsCount > 1 ? 's' : ''}
                </Text>
              </Pressable>
            )}
            <Pressable
              style={styles.searchButton}
              onPress={() => setShowSearch(!showSearch)}
            >
              <Ionicons name="search" size={24} color="#000" />
            </Pressable>
          </View>
        </View>

        {/* Search Bar */}
        {showSearch && (
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search conversations..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#666" />
              </Pressable>
            )}
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, activeTab === 'all' && styles.activeTab]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
              All
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'dms' && styles.activeTab]}
            onPress={() => setActiveTab('dms')}
          >
            <Text style={[styles.tabText, activeTab === 'dms' && styles.activeTabText]}>
              DMs
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'plans' && styles.activeTab]}
            onPress={() => setActiveTab('plans')}
          >
            <Text style={[styles.tabText, activeTab === 'plans' && styles.activeTabText]}>
              Plans
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Chat List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.conversation_id.toString()}
          contentContainerStyle={filteredChats.length === 0 && styles.emptyContainer}
          ListEmptyComponent={<EmptyState />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchConversations();
              }}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  requestsBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  requestsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 36,
    backgroundColor: '#f5f5f5',
    borderRadius: 18,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
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
  emptyContainer: {
    flex: 1,
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