// app/(tabs)/chats.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
} from 'react-native';
import { AppImage } from '~/components/AppImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { InitialsAvatar } from '~/components/InitialsAvatar';
import { router, useFocusEffect } from 'expo-router';
import { format } from 'date-fns';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '~/contexts/AuthProvider';
import { supabase } from '~/utils/supabase';
import { EmptyChats, ChatSkeletons } from '~/components/EmptyChats';

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
  // Dev-only: force the empty state even when the account has active chats.
  const [previewEmpty, setPreviewEmpty] = useState(false);

  // Fetch conversations with proper error handling
  const fetchConversations = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      // Don't set loading if we're refreshing
      if (!refreshing) {
        setLoading(true);
      }

      // Use the RPC function to get all conversations
      const { data, error } = await supabase.rpc('get_user_conversations', {
        p_user_id: session.user.id,
      });

      if (error) {
        console.error('Error fetching conversations:', error);
        return;
      }

      // Store all data (RPC return shape doesn't include the strict ChatItem types)
      setChats((data || []) as unknown as ChatItem[]);
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

  // Refetch the chat list whenever something changes server-side. Channel is
  // only alive while the tab is focused — outside of focus we don't subscribe.
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      fetchConversations();
      fetchPendingRequests();
    }
  }, [session?.user?.id, fetchConversations, fetchPendingRequests]);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user?.id) return;

      fetchConversations();
      fetchPendingRequests();

      const channel = supabase
        .channel(`chat-list-${session.user.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, () =>
          fetchConversations()
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'conversation_participants',
            filter: `user_id=eq.${session.user.id}`,
          },
          () => fetchConversations()
        )
        .subscribe();

      channelRef.current = channel;

      return () => {
        channel.unsubscribe();
        supabase.removeChannel(channel);
        channelRef.current = null;
      };
    }, [session?.user?.id, fetchConversations, fetchPendingRequests])
  );

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

  // Filter chats based on active tab and search query
  const getFilteredChats = useCallback(() => {
    if (!chats) return [];

    let filtered = chats;

    // Filter by tab
    switch (activeTab) {
      case 'dms':
        filtered = chats.filter((item) => item.conversation_type === 'dm');
        break;
      case 'plans':
        filtered = chats.filter((item) => item.conversation_type === 'group');
        break;
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.conversation_name?.toLowerCase().includes(query) ||
          item.last_message_content?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [chats, activeTab, searchQuery]);

  // Navigate to chat
  const navigateToChat = useCallback((item: ChatItem) => {
    if (item.conversation_type === 'group' && item.event_id) {
      router.push(`/chat/${item.event_id}`);
    } else {
      router.push(`/chat/dm/${item.conversation_id}`);
    }
  }, []);

  // Render chat item
  const renderChatItem = ({ item }: { item: ChatItem }) => {
    const chatName = item.conversation_name || 'Unknown Chat';
    const avatarUrl = item.avatar_url;
    const lastMessageTime = item.last_message_at;
    const lastMessageContent = item.last_message_content || '';
    const unreadCount = item.unread_count || 0;

    return (
      <Pressable style={styles.chatItem} onPress={() => navigateToChat(item)}>
        {avatarUrl ? (
          <AppImage source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <InitialsAvatar
            name={chatName}
            id={String(item.conversation_id)}
            size={50}
            style={styles.avatar}
          />
        )}
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName} numberOfLines={1}>
              {chatName}
            </Text>
            {lastMessageTime && <Text style={styles.timestamp}>{formatTime(lastMessageTime)}</Text>}
          </View>
          <View style={styles.messagePreview}>
            <Text
              style={[styles.lastMessage, unreadCount > 0 && styles.unreadMessage]}
              numberOfLines={1}>
              {item.last_message_user_name &&
                item.conversation_type === 'group' &&
                `${item.last_message_user_name}: `}
              {lastMessageContent}
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  // Get filtered data
  const filteredChats = getFilteredChats();

  // Empty state: invite CTA + skeleton preview of future conversations.
  const renderEmptyState = () => <EmptyChats />;

  // Header component with friend request badge
  const renderHeader = () => (
    <>
      {pendingRequestsCount > 0 && filteredChats.length > 0 && !searchQuery.trim() && (
        <Pressable style={styles.friendRequestCard} onPress={() => router.push('/friend-requests')}>
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
    </>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chats</Text>
        </View>
        <View style={styles.skeletonWrap}>
          <ChatSkeletons />
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
          {/* Dev-only: preview the empty state on an account that has chats */}
          {__DEV__ && (
            <Pressable
              style={styles.headerButton}
              onPress={() => setPreviewEmpty((v) => !v)}
              accessibilityLabel="Preview empty chats">
              <Ionicons name="flask-outline" size={22} color={previewEmpty ? '#007AFF' : '#999'} />
            </Pressable>
          )}
          {/* Friend requests indicator */}
          <Pressable style={styles.requestsButton} onPress={() => router.push('/friend-requests')}>
            <Text style={styles.requestsButtonText}>{pendingRequestsCount} Requests</Text>
          </Pressable>

          {/* Search button */}
          <Pressable style={styles.headerButton} onPress={() => setShowSearch(!showSearch)}>
            <Ionicons name={showSearch ? 'close' : 'search'} size={24} color="#007AFF" />
          </Pressable>
        </View>
      </View>

      {/* Search bar */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search chats..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        <View style={styles.tabsContainer}>
          <Pressable
            style={[styles.tab, activeTab === 'all' && styles.activeTab]}
            onPress={() => setActiveTab('all')}>
            <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>All</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'dms' && styles.activeTab]}
            onPress={() => setActiveTab('dms')}>
            <Text style={[styles.tabText, activeTab === 'dms' && styles.activeTabText]}>DMs</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'plans' && styles.activeTab]}
            onPress={() => setActiveTab('plans')}>
            <Text style={[styles.tabText, activeTab === 'plans' && styles.activeTabText]}>
              Plans
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Chat list */}
      <FlatList
        data={previewEmpty ? [] : filteredChats}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.conversation_id.toString()}
        contentContainerStyle={
          previewEmpty || filteredChats.length === 0 ? styles.emptyListContent : undefined
        }
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#007AFF" />
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
  skeletonWrap: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  requestsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F2F2F7',
    borderRadius: 15,
  },
  requestsButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  headerButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 25,
    padding: 2,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 23,
    minWidth: 70,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#000000',
    fontWeight: '600',
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
  },
  chatContent: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  timestamp: {
    fontSize: 14,
    color: '#999',
    marginLeft: 8,
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
  },
  unreadMessage: {
    color: '#000',
    fontWeight: '500',
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
  friendRequestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#F8F9FA',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
    borderRadius: 12,
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
});
