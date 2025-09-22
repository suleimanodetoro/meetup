// app/profile/[userId].tsx - FIXED VERSION WITH V3 FUNCTION
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
import { format } from 'date-fns';
import { Profile, FriendshipStatus } from '~/types/messaging';
import { useAuth } from '../contexts/AuthProvider';
import { supabase } from '~/utils/supabase';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus | null>(null);
  const [isRequester, setIsRequester] = useState(false);
  const [canMessage, setCanMessage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  const fetchUserData = async () => {
    if (!userId || !session?.user?.id) return;

    try {
      setLoading(true);
      
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Check friendship status if not viewing own profile
      if (userId !== session.user.id) {
        // Handle the array response from get_friendship_status
        const { data: friendshipData, error: friendshipError } = await supabase
          .rpc('get_friendship_status', {
            user1_id: session.user.id,
            user2_id: userId
          });

        // Debug log to see what we're getting
        console.log('Friendship data received:', friendshipData);

        // Check if array has data and access first element
        if (!friendshipError && friendshipData && friendshipData.length > 0) {
          const friendship = friendshipData[0];
          setFriendshipStatus(friendship.status as FriendshipStatus);
          setIsRequester(friendship.is_requester);
          console.log('Friendship status set:', friendship.status, 'Is requester:', friendship.is_requester);
        } else {
          // No friendship exists
          setFriendshipStatus(null);
          setIsRequester(false);
          console.log('No friendship found');
        }

        // Check if can message - this uses a different RPC that returns boolean
        const { data: messageCheck } = await supabase
          .rpc('can_users_message', {
            sender_id: session.user.id,
            receiver_id: userId
          });

        setCanMessage(messageCheck === true);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('Error', 'Failed to load user profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUserData();
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
        setIsRequester(false);
        Alert.alert('Friend request cancelled');
      }
      
      // Refresh data after action
      await fetchUserData();
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
      // UPDATED: Using the new v3 function with renamed columns
      const { data, error } = await supabase
        .rpc('get_or_create_dm_conversation_v3', {  // Changed to v3
          sender_id: session.user.id,
          recipient_id: userId
        });

      if (error) {
        console.error('RPC Error:', error);
        throw error;
      }

      console.log('DM creation response:', data);

      // The function returns an array with one object
      const result = Array.isArray(data) ? data[0] : data;
      
      // UPDATED: Using new column names from v3 function
      if (result?.can_msg_out && result?.conv_id_out) {
        // Navigate to DM chat
        router.push({
          pathname: '/chat/dm/[conversationId]',
          params: { conversationId: result.conv_id_out.toString() }
        });
      } else {
        // Show appropriate error message
        Alert.alert(
          'Cannot Message',
          result?.block_msg_out || 'Unable to start conversation'
        );
      }
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      
      // Handle specific error cases
      if (error.message?.includes('sender_id must equal auth.uid()')) {
        Alert.alert('Error', 'Authentication error. Please try logging in again.');
      } else if (error.code === '42501') {
        Alert.alert('Error', 'Permission denied. Please try again.');
      } else if (error.code === '42702') {
        Alert.alert('Error', 'Database configuration error. Please contact support.');
      } else {
        Alert.alert('Error', 'Failed to start conversation. Please try again.');
      }
    } finally {
      setProcessingAction(false);
    }
  };

  const handleBlock = () => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${profile?.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Block', 
          style: 'destructive',
          onPress: async () => {
            setProcessingAction(true);
            try {
              const { error } = await supabase
                .from('blocked_users')
                .insert({
                  blocker_id: session?.user?.id,
                  blocked_id: userId
                });

              if (error) throw error;
              Alert.alert('User blocked');
              router.back();
            } catch (error) {
              console.error('Error blocking user:', error);
              Alert.alert('Error', 'Failed to block user');
            } finally {
              setProcessingAction(false);
            }
          }
        }
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
            setProcessingAction(true);
            try {
              // Delete friendship (works for both requester and addressee)
              const { error } = await supabase
                .from('friendships')
                .delete()
                .or(`and(requester_id.eq.${session?.user?.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${session?.user?.id})`);

              if (error) throw error;
              
              setFriendshipStatus(null);
              setIsRequester(false);
              Alert.alert('Friend removed');
              
              // Refresh data
              await fetchUserData();
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert('Error', 'Failed to remove friend');
            } finally {
              setProcessingAction(false);
            }
          }
        }
      ]
    );
  };

  const getFriendButtonText = () => {
    if (!friendshipStatus) return 'Add Friend';
    if (friendshipStatus === 'pending') {
      return isRequester ? 'Cancel Request' : 'Accept Request';
    }
    if (friendshipStatus === 'accepted') return 'Friends';
    return 'Add Friend';
  };

  const getFriendButtonIcon = () => {
    if (!friendshipStatus) return 'person-add-outline';
    if (friendshipStatus === 'pending') {
      return isRequester ? 'close-outline' : 'checkmark-outline';
    }
    if (friendshipStatus === 'accepted') return 'checkmark-circle-outline';
    return 'person-add-outline';
  };

  const handleFriendButtonPress = () => {
    if (friendshipStatus === 'accepted') {
      // Show options for accepted friendship
      Alert.alert(
        'Friend Options',
        `${profile?.full_name} is your friend`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Remove Friend', 
            style: 'destructive',
            onPress: handleUnfriend
          }
        ]
      );
    } else {
      handleFriendRequest();
    }
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

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>User not found</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isOwnProfile = session?.user?.id === userId;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        {!isOwnProfile && (
          <Pressable onPress={handleBlock} style={styles.moreButton}>
            <Ionicons name="ellipsis-vertical" size={24} color="#000" />
          </Pressable>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.profileSection}>
          <Image
            source={{ 
              uri: profile.avatar_url || 'https://via.placeholder.com/100' 
            }}
            style={styles.avatar}
          />
          <Text style={styles.name}>{profile.full_name || 'Unknown User'}</Text>
          {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.trips_count || 0}</Text>
              <Text style={styles.statLabel}>Trips</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.friends_count || 0}</Text>
              <Text style={styles.statLabel}>Friends</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.plans_count || 0}</Text>
              <Text style={styles.statLabel}>Plans</Text>
            </View>
          </View>

          {!isOwnProfile && (
            <View style={styles.actionButtons}>
              <Pressable
                style={[
                  styles.actionButton,
                  friendshipStatus === 'accepted' && styles.acceptedButton,
                  processingAction && styles.disabledButton
                ]}
                onPress={handleFriendButtonPress}
                disabled={processingAction}
              >
                <Ionicons 
                  name={getFriendButtonIcon()} 
                  size={20} 
                  color={friendshipStatus === 'accepted' ? '#4CAF50' : '#fff'} 
                />
                <Text style={[
                  styles.actionButtonText,
                  friendshipStatus === 'accepted' && styles.acceptedButtonText
                ]}>
                  {getFriendButtonText()}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.actionButton,
                  styles.messageButton,
                  processingAction && styles.disabledButton,
                  !canMessage && friendshipStatus !== 'accepted' && styles.disabledMessageButton
                ]}
                onPress={handleMessage}
                disabled={processingAction}
              >
                <Ionicons name="chatbubble-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Message</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Additional sections can go here */}
      </ScrollView>
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
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    padding: 8,
  },
  moreButton: {
    padding: 8,
  },
  scrollView: {
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
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  profileSection: {
    alignItems: 'center',
    padding: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  messageButton: {
    backgroundColor: '#6C63FF',
  },
  disabledMessageButton: {
    backgroundColor: '#ccc',
  },
  acceptedButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  disabledButton: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptedButtonText: {
    color: '#4CAF50',
  },
});