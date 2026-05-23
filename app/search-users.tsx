// app/search-users.tsx
/*TO DO LATER:

FIX DUPLICATE KEY ERROR WHEN The same user appears in both recentSearches and suggestedUsers arrays, causing duplicate keys when React renders the list.
// */ 

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import debounce from 'lodash.debounce';
import { Profile, FriendshipStatus } from '~/types/messaging';
import { useAuth } from '~/contexts/AuthProvider';
import { supabase } from '~/utils/supabase';

interface SearchResult extends Profile {
  friendship_status?: FriendshipStatus | null;
  mutual_friends_count?: number;
  mutual_plans_count?: number;
}

export default function SearchUsersScreen() {
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SearchResult[]>([]);

  useEffect(() => {
    fetchSuggestedUsers();
    loadRecentSearches();
  }, []);

  const fetchSuggestedUsers = async () => {
    if (!session?.user?.id) return;

    try {
      // Get users with mutual connections
      const { data } = await supabase
        .rpc('search_users_for_friends', {
          searcher_id: session.user.id,
          search_term: '',
          limit_count: 10
        });

      setSuggestedUsers((data || []) as unknown as SearchResult[]);
    } catch (error) {
      console.error('Error fetching suggested users:', error);
    }
  };

  const loadRecentSearches = async () => {
    // Load from AsyncStorage or local state management
    // This is a placeholder - implement actual storage
  };

  const performSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim() || !session?.user?.id) {
        setSearchResults([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .rpc('search_users_for_friends', {
            searcher_id: session.user.id,
            search_term: query,
            limit_count: 20
          });

        if (error) throw error;
        setSearchResults((data || []) as unknown as SearchResult[]);
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setLoading(false);
      }
    }, 300),
    [session]
  );

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    performSearch(text);
  };

  const handleUserPress = (user: SearchResult) => {
    // Save to recent searches
    setRecentSearches(prev => [user, ...prev.filter(u => u.id !== user.id)].slice(0, 5));
    
    // Navigate to profile
    router.push(`/profile/${user.id}`);
  };

  const sendFriendRequest = async (userId: string) => {
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
        // Update local state
        setSearchResults(prev =>
          prev.map(user =>
            user.id === userId ? { ...user, friendship_status: 'pending' } : user
          )
        );
        setSuggestedUsers(prev =>
          prev.map(user =>
            user.id === userId ? { ...user, friendship_status: 'pending' } : user
          )
        );
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  };

  const renderUser = ({ item }: { item: SearchResult }) => {
    const hasMutualConnections = 
      (item.mutual_friends_count || 0) > 0 || 
      (item.mutual_plans_count || 0) > 0;

    return (
      <Pressable 
        style={styles.userCard}
        onPress={() => handleUserPress(item)}
      >
        <Image
          source={{ uri: item.avatar_url || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
        
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.full_name || item.username || 'Unknown'}
          </Text>
          
          {item.bio && (
            <Text style={styles.userBio} numberOfLines={1}>
              {item.bio}
            </Text>
          )}
          
          {hasMutualConnections && (() => {
            const friendCount = item.mutual_friends_count ?? 0;
            const planCount = item.mutual_plans_count ?? 0;
            return (
              <View style={styles.mutualInfo}>
                {friendCount > 0 && (
                  <Text style={styles.mutualText}>
                    {friendCount} mutual friend{friendCount > 1 ? 's' : ''}
                  </Text>
                )}
                {planCount > 0 && (
                  <Text style={styles.mutualText}>
                    {planCount} mutual plan{planCount > 1 ? 's' : ''}
                  </Text>
                )}
              </View>
            );
          })()}
        </View>

        {/* Friend button */}
        {item.friendship_status === 'accepted' ? (
          <View style={styles.friendBadge}>
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
          </View>
        ) : item.friendship_status === 'pending' ? (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>Pending</Text>
          </View>
        ) : (
          <Pressable
            style={styles.addButton}
            onPress={(e) => {
              e.stopPropagation();
              sendFriendRequest(item.id);
            }}
          >
            <Ionicons name="person-add" size={18} color="#007AFF" />
          </Pressable>
        )}
      </Pressable>
    );
  };

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="search" size={48} color="#ccc" />
      <Text style={styles.emptyTitle}>Find people to connect with</Text>
      <Text style={styles.emptySubtitle}>
        Search by name or username to find friends
      </Text>
    </View>
  );

  const NoResults = () => (
    <View style={styles.emptyState}>
      <Ionicons name="person-outline" size={48} color="#ccc" />
      <Text style={styles.emptyTitle}>No users found</Text>
      <Text style={styles.emptySubtitle}>
        Try searching with a different name or username
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </Pressable>
          <Text style={styles.headerTitle}>Find People</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or username..."
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => {
              setSearchQuery('');
              setSearchResults([]);
            }}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </Pressable>
          )}
        </View>

        {/* Results */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : searchQuery.length > 0 ? (
          <FlatList
            data={searchResults}
            renderItem={renderUser}
            keyExtractor={(item) => item.id}
            contentContainerStyle={searchResults.length === 0 && styles.emptyContainer}
            ListEmptyComponent={<NoResults />}
          />
        ) : (
          <FlatList<
            | { kind: 'header'; title: string }
            | (SearchResult & { kind: 'user' })
          >
            data={[
              ...(recentSearches.length > 0
                ? [{ kind: 'header' as const, title: 'Recent' }]
                : []),
              ...recentSearches.map((u) => ({ ...u, kind: 'user' as const })),
              ...(suggestedUsers.length > 0
                ? [{ kind: 'header' as const, title: 'Suggested for You' }]
                : []),
              ...suggestedUsers.map((u) => ({ ...u, kind: 'user' as const })),
            ]}
            renderItem={({ item }) => {
              if (item.kind === 'header') return renderSectionHeader(item.title);
              return renderUser({ item });
            }}
            keyExtractor={(item, index) =>
              item.kind === 'header' ? `header-${index}` : item.id
            }
            contentContainerStyle={
              recentSearches.length === 0 && suggestedUsers.length === 0 && styles.emptyContainer
            }
            ListEmptyComponent={<EmptyState />}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  headerRight: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f8f8',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  userBio: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  mutualInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mutualText: {
    fontSize: 12,
    color: '#007AFF',
  },
  addButton: {
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
  },
  friendBadge: {
    padding: 4,
  },
  pendingBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
  },
  pendingText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
});