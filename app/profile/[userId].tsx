// app/profile/[userId].tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { LinearGradient } from 'expo-linear-gradient';
import { Profile, FriendshipStatus, Event } from '~/types/messaging';
import { useAuth } from '../contexts/AuthProvider';
import { supabase } from '~/utils/supabase';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus | null>(null);
  const [isRequester, setIsRequester] = useState(false);
  const [canMessage, setCanMessage] = useState(false);
  const [mutualFriends, setMutualFriends] = useState<Profile[]>([]);
  const [mutualPlans, setMutualPlans] = useState<Event[]>([]);
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
  const [processingAction, setProcessingAction] = useState(false);

  const isOwnProfile = userId === session?.user?.id;

  useEffect(() => {
    if (userId) {
      fetchProfileData();
    }
  }, [userId]);

  const fetchProfileData = async () => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      if (!isOwnProfile && session?.user?.id) {
        // Check friendship status
        const { data: friendshipData } = await supabase
          .rpc('get_friendship_status', {
            user1_id: session.user.id,
            user2_id: userId
          });

        if (friendshipData?.[0]) {
          setFriendshipStatus(friendshipData[0].status as FriendshipStatus);
          setIsRequester(friendshipData[0].is_requester);
        }

        // Check if can message
        const { data: canMsg } = await supabase
          .rpc('can_users_message', {
            sender_id: session.user.id,
            receiver_id: userId
          });
        setCanMessage(canMsg || false);

        // Fetch mutual friends
        const { data: mutuals } = await supabase
          .rpc('get_mutual_friends', {
            user1_id: session.user.id,
            user2_id: userId
          });
        setMutualFriends(mutuals || []);

        // Fetch mutual plans
        const { data: userEvents } = await supabase
          .from('attendance')
          .select('event_id')
          .eq('user_id', userId);

        if (userEvents && userEvents.length > 0) {
          const eventIds = userEvents.map(a => a.event_id);
          const { data: myAttendance } = await supabase
            .from('attendance')
            .select('event:events(*)')
            .eq('user_id', session.user.id)
            .in('event_id', eventIds);

          setMutualPlans(myAttendance?.map(a => a.event).filter(Boolean) || []);
        }
      }

      // Fetch upcoming trips
      const { data: visits } = await supabase
        .from('visits')
        .select('*')
        .eq('user_id', userId)
        .gte('end_date', new Date().toISOString().split('T')[0])
        .order('start_date', { ascending: true })
        .limit(3);

      setUpcomingTrips(visits || []);
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleFriendRequest = async () => {
    if (!session?.user?.id) {
      router.push('/auth');
      return;
    }

    setProcessingAction(true);
    try {
      if (!friendshipStatus) {
        // Send friend request
        const { error } = await supabase
          .from('friendships')
          .insert({
            requester_id: session.user.id,
            addressee_id: userId,
            status: 'pending'
          });

        if (error) throw error;
        setFriendshipStatus('pending');
        setIsRequester(true);
        Alert.alert('Success', 'Friend request sent!');
      } else if (friendshipStatus === 'pending' && !isRequester) {
        // Accept friend request
        const { error } = await supabase
          .from('friendships')
          .update({ 
            status: 'accepted',
            updated_at: new Date().toISOString()
          })
          .eq('requester_id', userId)
          .eq('addressee_id', session.user.id);

        if (error) throw error;
        setFriendshipStatus('accepted');
        setCanMessage(true);
        Alert.alert('Success', 'Friend request accepted!');
      } else if (friendshipStatus === 'pending' && isRequester) {
        // Cancel friend request
        const { error } = await supabase
          .from('friendships')
          .delete()
          .eq('requester_id', session.user.id)
          .eq('addressee_id', userId);

        if (error) throw error;
        setFriendshipStatus(null);
        Alert.alert('Friend request cancelled');
      }
    } catch (error) {
      console.error('Error handling friend request:', error);
      Alert.alert('Error', 'Failed to process friend request');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleMessage = async () => {
    if (!session?.user?.id) {
      router.push('/auth');
      return;
    }

    setProcessingAction(true);
    try {
      const { data } = await supabase
        .rpc('get_or_create_dm_conversation_enhanced', {
          sender_id: session.user.id,
          recipient_id: userId
        });

      if (data?.can_message && data?.conversation_id) {
        router.push(`/chat/dm/${data.conversation_id}`);
      } else {
        Alert.alert(
          'Cannot Message',
          data?.block_reason || 'Unable to start conversation'
        );
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Failed to start conversation');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleBlock = () => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${profile?.full_name}? They won't be able to message you or see your profile.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('blocked_users')
                .insert({
                  blocker_id: session?.user?.id,
                  blocked_id: userId
                });

              // Update friendship if exists
              if (friendshipStatus) {
                await supabase
                  .from('friendships')
                  .update({ status: 'blocked' })
                  .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
                  .or(`requester_id.eq.${session?.user?.id},addressee_id.eq.${session?.user?.id}`);
              }

              Alert.alert('User blocked');
              router.back();
            } catch (error) {
              console.error('Error blocking user:', error);
              Alert.alert('Error', 'Failed to block user');
            }
          },
        },
      ]
    );
  };

  const handleUnfriend = () => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${profile?.full_name} as a friend?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('friendships')
                .delete()
                .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
                .or(`requester_id.eq.${session?.user?.id},addressee_id.eq.${session?.user?.id}`);

              setFriendshipStatus(null);
              Alert.alert('Friend removed');
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert('Error', 'Failed to remove friend');
            }
          },
        },
      ]
    );
  };

  const getFriendButtonText = () => {
    if (!friendshipStatus) return 'Add Friend';
    if (friendshipStatus === 'pending' && isRequester) return 'Pending';
    if (friendshipStatus === 'pending' && !isRequester) return 'Accept Request';
    if (friendshipStatus === 'accepted') return 'Friends';
    if (friendshipStatus === 'blocked') return 'Blocked';
    return 'Add Friend';
  };

  const getFriendButtonIcon = () => {
    if (!friendshipStatus) return 'person-add';
    if (friendshipStatus === 'pending') return 'time';
    if (friendshipStatus === 'accepted') return 'checkmark-circle';
    if (friendshipStatus === 'blocked') return 'ban';
    return 'person-add';
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
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchProfileData} />
        }
      >
        {/* Header with cover image */}
        <View style={styles.header}>
          <LinearGradient
            colors={['#007AFF', '#00C6FF']}
            style={styles.coverImage}
          >
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            {!isOwnProfile && (
              <Pressable style={styles.moreButton} onPress={() => {
                Alert.alert(
                  'Options',
                  '',
                  [
                    friendshipStatus === 'accepted' && { text: 'Remove Friend', onPress: handleUnfriend },
                    { text: 'Block User', onPress: handleBlock, style: 'destructive' },
                    { text: 'Cancel', style: 'cancel' }
                  ].filter(Boolean)
                );
              }}>
                <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
              </Pressable>
            )}
          </LinearGradient>

          {/* Profile info */}
          <View style={styles.profileInfo}>
            <Image
              source={{ uri: profile?.avatar_url || 'https://via.placeholder.com/100' }}
              style={styles.avatar}
            />
            <Text style={styles.name}>{profile?.full_name || 'Unknown User'}</Text>
            {profile?.username && (
              <Text style={styles.username}>@{profile.username}</Text>
            )}
            {profile?.bio && (
              <Text style={styles.bio}>{profile.bio}</Text>
            )}

            {/* Action buttons */}
            {!isOwnProfile && (
              <View style={styles.actionButtons}>
                <Pressable
                  style={[
                    styles.actionButton,
                    friendshipStatus === 'accepted' && styles.friendButton
                  ]}
                  onPress={handleFriendRequest}
                  disabled={processingAction || friendshipStatus === 'blocked'}
                >
                  <Ionicons 
                    name={getFriendButtonIcon()} 
                    size={20} 
                    color={friendshipStatus === 'accepted' ? '#4CAF50' : '#007AFF'} 
                  />
                  <Text style={[
                    styles.actionButtonText,
                    friendshipStatus === 'accepted' && styles.friendButtonText
                  ]}>
                    {getFriendButtonText()}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.actionButton,
                    !canMessage && styles.disabledButton
                  ]}
                  onPress={handleMessage}
                  disabled={processingAction || !canMessage}
                >
                  <Ionicons 
                    name="chatbubble-ellipses" 
                    size={20} 
                    color={canMessage ? '#007AFF' : '#999'} 
                  />
                  <Text style={[
                    styles.actionButtonText,
                    !canMessage && styles.disabledButtonText
                  ]}>
                    Message
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* Mutual connections */}
        {!isOwnProfile && (mutualFriends.length > 0 || mutualPlans.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mutual Connections</Text>
            {mutualFriends.length > 0 && (
              <View style={styles.mutualItem}>
                <Ionicons name="people" size={16} color="#666" />
                <Text style={styles.mutualText}>
                  {mutualFriends.length} mutual friend{mutualFriends.length > 1 ? 's' : ''}
                </Text>
              </View>
            )}
            {mutualPlans.length > 0 && (
              <View style={styles.mutualItem}>
                <Ionicons name="calendar" size={16} color="#666" />
                <Text style={styles.mutualText}>
                  {mutualPlans.length} mutual plan{mutualPlans.length > 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Upcoming trips */}
        {upcomingTrips.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Trips</Text>
            {upcomingTrips.map((trip) => (
              <Pressable 
                key={trip.id}
                style={styles.tripCard}
                onPress={() => router.push(`/visit/${trip.id}`)}
              >
                <View style={styles.tripInfo}>
                  <Text style={styles.tripCity}>{trip.city}</Text>
                  <Text style={styles.tripCountry}>{trip.country}</Text>
                  <Text style={styles.tripDates}>
                    {new Date(trip.start_date).toLocaleDateString()} - {new Date(trip.end_date).toLocaleDateString()}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </Pressable>
            ))}
          </View>
        )}

        {/* Settings button for own profile */}
        {isOwnProfile && (
          <View style={styles.section}>
            <Pressable
              style={styles.settingsButton}
              onPress={() => router.push('/settings')}
            >
              <Ionicons name="settings" size={20} color="#007AFF" />
              <Text style={styles.settingsButtonText}>Settings</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
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
    marginBottom: 20,
  },
  coverImage: {
    height: 150,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 16,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
  },
  moreButton: {
    position: 'absolute',
    top: 20,
    right: 16,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
  },
  profileInfo: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: -50,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#fff',
    marginBottom: 12,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  bio: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  friendButton: {
    backgroundColor: '#E8F5E9',
  },
  disabledButton: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  friendButtonText: {
    color: '#4CAF50',
  },
  disabledButtonText: {
    color: '#999',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  mutualItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  mutualText: {
    fontSize: 14,
    color: '#666',
  },
  tripCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 8,
  },
  tripInfo: {
    flex: 1,
  },
  tripCity: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  tripCountry: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  tripDates: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  settingsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
});