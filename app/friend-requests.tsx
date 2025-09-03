// app/friend-requests.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { FriendRequest, Profile, Event } from '~/types/messaging';
import AuthProvider, { useAuth } from './contexts/AuthProvider';
import { supabase } from '~/utils/supabase';

export default function FriendRequestsScreen() {
  const { session } = useAuth();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (session?.user?.id) {
      fetchFriendRequests();
    }
  }, [session]);

  const fetchFriendRequests = async () => {
    if (!session?.user?.id) return;

    try {
      // Fetch pending friend requests
      const { data: friendshipData, error } = await supabase
        .from('friendships')
        .select(`
          *,
          requester:profiles!friendships_requester_id_fkey(*)
        `)
        .eq('addressee_id', session.user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform to FriendRequest format and fetch mutual data
      const requestsWithMutuals = await Promise.all(
        (friendshipData || []).map(async (friendship) => {
          // Fetch mutual friends
          const { data: mutualFriends } = await supabase
            .rpc('get_mutual_friends', {
              user1_id: session.user.id,
              user2_id: friendship.requester_id
            });

          // Fetch mutual plans (events both users are attending)
          const { data: mutualPlans } = await supabase
            .from('attendance')
            .select('event:events(*)')
            .eq('user_id', session.user.id)
            .in('event_id', 
              await supabase
                .from('attendance')
                .select('event_id')
                .eq('user_id', friendship.requester_id)
                .then(res => res.data?.map(a => a.event_id) || [])
            );

          return {
            id: friendship.id,
            from_user: friendship.requester,
            created_at: friendship.created_at,
            mutual_friends: mutualFriends || [],
            mutual_plans: mutualPlans?.map(a => a.event) || [],
          } as FriendRequest;
        })
      );

      setRequests(requestsWithMutuals);
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAccept = async (requestId: number, requesterId: string) => {
    setProcessingIds(prev => new Set(prev).add(requestId));

    try {
      const { error } = await supabase
        .from('friendships')
        .update({ 
          status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      // Remove from list
      setRequests(prev => prev.filter(r => r.id !== requestId));
      
      Alert.alert('Success', 'Friend request accepted!');
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Failed to accept friend request');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const handleDecline = async (requestId: number) => {
    Alert.alert(
      'Decline Request',
      'Are you sure you want to decline this friend request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setProcessingIds(prev => new Set(prev).add(requestId));

            try {
              const { error } = await supabase
                .from('friendships')
                .update({ 
                  status: 'declined',
                  updated_at: new Date().toISOString()
                })
                .eq('id', requestId);

              if (error) throw error;

              // Remove from list
              setRequests(prev => prev.filter(r => r.id !== requestId));
            } catch (error) {
              console.error('Error declining friend request:', error);
              Alert.alert('Error', 'Failed to decline friend request');
            } finally {
              setProcessingIds(prev => {
                const next = new Set(prev);
                next.delete(requestId);
                return next;
              });
            }
          },
        },
      ]
    );
  };

  const renderRequest = ({ item }: { item: FriendRequest }) => {
    const isProcessing = processingIds.has(item.id);
    
    return (
      <View style={styles.requestCard}>
        <Pressable 
          style={styles.profileSection}
          onPress={() => router.push(`/profile/${item.from_user.id}`)}
        >
          <Image
            source={{ uri: item.from_user.avatar_url || 'https://via.placeholder.com/60' }}
            style={styles.avatar}
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {item.from_user.full_name || item.from_user.username || 'Unknown User'}
            </Text>
            <Text style={styles.timeAgo}>
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            </Text>
            
            {/* Mutual connections */}
            {(item.mutual_friends?.length > 0 || item.mutual_plans?.length > 0) && (
              <View style={styles.mutualInfo}>
                {item.mutual_friends?.length > 0 && (
                  <Text style={styles.mutualText}>
                    <Ionicons name="people-outline" size={12} color="#666" />
                    {' '}{item.mutual_friends.length} mutual friend{item.mutual_friends.length > 1 ? 's' : ''}
                  </Text>
                )}
                {item.mutual_plans?.length > 0 && (
                  <Text style={styles.mutualText}>
                    <Ionicons name="calendar-outline" size={12} color="#666" />
                    {' '}{item.mutual_plans.length} mutual plan{item.mutual_plans.length > 1 ? 's' : ''}
                  </Text>
                )}
              </View>
            )}
          </View>
        </Pressable>

        {/* Action buttons */}
        <View style={styles.actionButtons}>
          <Pressable
            style={[styles.button, styles.acceptButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleAccept(item.id, item.from_user.id)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.acceptButtonText}>Accept</Text>
            )}
          </Pressable>
          
          <Pressable
            style={[styles.button, styles.declineButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleDecline(item.id)}
            disabled={isProcessing}
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No friend requests</Text>
      <Text style={styles.emptySubtitle}>
        When someone sends you a friend request, it will appear here
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Friend Requests</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Requests list */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderRequest}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={requests.length === 0 && styles.emptyContainer}
          ListEmptyComponent={<EmptyState />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchFriendRequests();
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profileSection: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  timeAgo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  mutualInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  mutualText: {
    fontSize: 12,
    color: '#666',
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  acceptButton: {
    backgroundColor: '#007AFF',
  },
  declineButton: {
    backgroundColor: '#f0f0f0',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  declineButtonText: {
    color: '#000',
    fontSize: 15,
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
    fontSize: 20,
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