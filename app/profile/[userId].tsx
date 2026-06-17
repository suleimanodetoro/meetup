// app/profile/[userId].tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { AppImage } from '~/components/AppImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { InitialsAvatar } from '~/components/InitialsAvatar';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { INTERESTS, LANGUAGES } from '~/utils/constants';
import { FounderBadge } from '~/components/FounderBadge';
import { PremiumBadge } from '~/components/PremiumBadge';
import { useAuth } from '~/contexts/AuthProvider';
import { supabase } from '~/utils/supabase';
import { getCountryFlag } from '~/utils/countryFlags';
import { getCityImageUrl } from '~/utils/cityImages';
import { authColors, authRadius, authSpace, authType } from '~/utils/authTheme';
import { presentUserSafetyActions } from '~/modules/safety';

const LANGUAGE_BY_CODE = new Map<string, (typeof LANGUAGES)[number]>(
  LANGUAGES.map((l) => [l.code, l])
);
function formatLanguages(codes: readonly string[] | undefined): string {
  if (!codes || codes.length === 0) return '';
  return codes.map((c) => LANGUAGE_BY_CODE.get(c)?.name ?? c).join(', ');
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type FriendshipStatus = 'pending' | 'accepted' | 'blocked' | null;

interface UserProfile {
  id: string;
  full_name: string;
  bio?: string;
  avatar_url?: string;
  birth_date?: string;
  nationality?: string;
  nationality_code?: string;
  location?: string;
  location_country?: string;
  location_country_code?: string;
  languages?: string[];
  interests?: string[];
  gender?: string;
  instagram_url?: string;
  tiktok_url?: string;
  youtube_url?: string;
  is_founder?: boolean | null;
  founder_year?: number | null;
}

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { session } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>(null);
  const [isRequester, setIsRequester] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState(false);

  // Travel stats
  const [travelStats, setTravelStats] = useState({
    totalTrips: 0,
    countriesVisited: 0,
  });

  // User's events/plans
  const [userEvents, setUserEvents] = useState<any[]>([]);

  useEffect(() => {
    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  const fetchUserData = async () => {
    if (!userId || !session?.user?.id) return;

    try {
      setLoading(true);

      // Fetch user profile with social media
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Profile error:', profileError);
        throw profileError;
      }

      setProfile(profileData as unknown as UserProfile);

      // Fire-and-forget premium check — the page renders fine without it,
      // and a stale `false` is preferable to blocking the profile on a
      // secondary RPC. Defaults to false on any failure. The cast bypasses
      // the generated Database types until they're regenerated against the
      // 20260524150000_add_is_premium_to_user_rpcs.sql migration.
      void (supabase.rpc as any)('is_user_premium', { uid: userId }).then(
        ({ data }: { data: boolean | null }) => setIsPremium(!!data)
      );

      // Fetch travel stats
      const { data: visits } = await supabase
        .from('visits')
        .select('country_code')
        .eq('user_id', userId);

      if (visits) {
        const uniqueCountries = new Set(visits.map((v) => v.country_code).filter(Boolean));
        setTravelStats({
          totalTrips: visits.length,
          countriesVisited: uniqueCountries.size,
        });
      }

      // Fetch user's events (both created and attending)
      const { data: attendance } = await supabase
        .from('attendance')
        .select('event_id')
        .eq('user_id', userId);

      if (attendance && attendance.length > 0) {
        const eventIds = attendance.map((a) => a.event_id);
        const { data: events } = await supabase
          .from('events')
          .select('*')
          .in('id', eventIds)
          .gte('date', new Date().toISOString())
          .order('date', { ascending: true })
          .limit(3);

        if (events) {
          setUserEvents(events);
        }
      }

      // Check friendship status if not viewing own profile
      if (userId !== session.user.id) {
        const { data: friendshipData } = await supabase.rpc('get_friendship_status', {
          user1_id: session.user.id,
          user2_id: userId,
        });

        if (friendshipData && friendshipData.length > 0) {
          const friendship = friendshipData[0];
          setFriendshipStatus(friendship.status as FriendshipStatus);
          setIsRequester(friendship.is_requester);
        }
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleFriendRequest = async () => {
    if (!session?.user?.id || !userId || processingAction) return;

    try {
      setProcessingAction(true);

      if (!friendshipStatus) {
        // Send friend request
        const { error } = await supabase.from('friendships').insert({
          requester_id: session.user.id,
          addressee_id: userId,
          status: 'pending',
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
            updated_at: new Date().toISOString(),
          })
          .eq('requester_id', userId)
          .eq('addressee_id', session.user.id);

        if (error) throw error;
        setFriendshipStatus('accepted');
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
        Alert.alert('Cancelled', 'Friend request cancelled');
      }

      await fetchUserData();
    } catch (error) {
      console.error('Error handling friend request:', error);
      Alert.alert('Error', 'Failed to process request');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleMessage = async () => {
    if (!session?.user?.id || !userId) return;

    setProcessingAction(true);
    try {
      const { data, error } = await supabase.rpc('get_or_create_dm_conversation_v3', {
        sender_id: session.user.id,
        recipient_id: userId,
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;

      if (result?.can_msg_out && result?.conv_id_out) {
        router.push({
          pathname: '/chat/dm/[conversationId]',
          params: { conversationId: result.conv_id_out.toString() },
        });
      } else {
        Alert.alert('Cannot Message', result?.block_msg_out || 'Unable to start conversation');
      }
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Failed to start conversation');
    } finally {
      setProcessingAction(false);
    }
  };

  const calculateAge = (birthDate: string): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const getFriendButtonText = () => {
    if (!friendshipStatus) return 'Add Friend';
    if (friendshipStatus === 'pending') {
      return isRequester ? 'Cancel Request' : 'Accept Request';
    }
    if (friendshipStatus === 'accepted') return 'Friends';
    return 'Add Friend';
  };

  const getInterestDetails = (interestId: string) => {
    return (
      INTERESTS.find((i) => i.id === interestId) || {
        id: interestId,
        label: interestId,
        emoji: '✨',
      }
    );
  };

  const extractSocialUsername = (
    url: string,
    platform: 'instagram' | 'tiktok' | 'youtube'
  ): string => {
    if (!url) return '';

    try {
      if (platform === 'instagram') {
        const match = url.match(/instagram\.com\/([a-zA-Z0-9._]+)/);
        return match ? match[1] : '';
      } else if (platform === 'tiktok') {
        const match = url.match(/tiktok\.com\/@([a-zA-Z0-9._]+)/);
        return match ? match[1] : '';
      } else if (platform === 'youtube') {
        const match = url.match(/youtube\.com\/(@|c\/|channel\/)([a-zA-Z0-9_-]+)/);
        return match ? match[2] : '';
      }
    } catch {
      return '';
    }
    return '';
  };

  const hasSocials = profile?.instagram_url || profile?.tiktok_url || profile?.youtube_url;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={authColors.accent} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>User not found</Text>
        <Pressable style={styles.errorButton} onPress={() => router.back()}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const isOwnProfile = session?.user?.id === userId;
  const age = profile.birth_date ? calculateAge(profile.birth_date) : null;

  return (
    <View style={styles.container}>
      {/* Fixed Header Buttons */}
      <SafeAreaView style={styles.fixedHeaderButtons}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        {!isOwnProfile && (
          <Pressable
            onPress={() => {
              if (!session?.user?.id || !userId) return;
              presentUserSafetyActions({
                currentUserId: session.user.id,
                targetUserId: userId,
                targetName: profile?.full_name,
                onBlocked: () => router.back(),
              });
            }}
            style={styles.headerButton}>
            <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
          </Pressable>
        )}
      </SafeAreaView>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}>
        {/* Header Image - Scrollable */}
        <View style={styles.headerImageContainer}>
          {profile.avatar_url ? (
            <AppImage source={{ uri: profile.avatar_url }} style={styles.headerImage} />
          ) : (
            <InitialsAvatar
              name={profile.full_name}
              id={profile.id}
              size={120}
              style={[styles.headerImage, { borderRadius: 0 }]}
            />
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.62)']}
            style={styles.headerScrim}
          />

          {profile.is_founder ? (
            <FounderBadge size={28} style={styles.premiumBadgeHeader} />
          ) : isPremium ? (
            <PremiumBadge size={28} style={styles.premiumBadgeHeader} />
          ) : null}

          {/* Name and Location Overlay */}
          <View style={styles.profileInfoOverlay}>
            <Text style={styles.profileName}>
              {profile.full_name}
              {age ? `, ${age}` : ''}
            </Text>
            {profile.is_founder ? (
              <FounderBadge
                showLabel
                year={profile.founder_year}
                style={styles.founderOverlayLabel}
              />
            ) : null}
            {profile.location && (
              <View style={styles.locationContainer}>
                <Text style={styles.locationFlag}>
                  {getCountryFlag(profile.location_country_code || '')}
                </Text>
                <Text style={styles.locationText}>
                  {[profile.location, profile.location_country].filter(Boolean).join(', ')}
                </Text>
              </View>
            )}
            {profile.nationality && (
              <View style={styles.locationContainer}>
                <Text style={styles.locationFlag}>
                  {getCountryFlag(profile.nationality_code || '')}
                </Text>
                <Text style={styles.locationText}>From {profile.nationality}</Text>
              </View>
            )}
          </View>
        </View>
        {/* Action Buttons */}
        {!isOwnProfile && (
          <View style={styles.actionButtons}>
            <Pressable
              onPress={handleFriendRequest}
              disabled={processingAction}
              style={[
                styles.actionButton,
                friendshipStatus === 'accepted' && styles.actionButtonAccepted,
              ]}>
              <Ionicons
                name={
                  friendshipStatus === 'accepted'
                    ? 'checkmark-circle'
                    : friendshipStatus === 'pending' && !isRequester
                      ? 'person-add'
                      : 'person-add-outline'
                }
                size={20}
                color={
                  friendshipStatus === 'accepted' ? authColors.success : authColors.textPrimary
                }
              />
              <Text
                style={[
                  styles.actionButtonText,
                  friendshipStatus === 'accepted' && styles.actionButtonTextAccepted,
                ]}>
                {getFriendButtonText()}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleMessage}
              disabled={processingAction}
              style={[styles.actionButton, styles.messageButton]}>
              <Ionicons name="chatbubble-outline" size={20} color={authColors.textPrimary} />
              <Text style={styles.actionButtonText}>Message</Text>
            </Pressable>
          </View>
        )}

        {/* About Me */}
        {profile.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About Me</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {/* Socials */}
        {hasSocials && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Socials</Text>
            <View style={styles.socialsContainer}>
              {profile.instagram_url && (
                <View style={styles.socialPill}>
                  <Ionicons name="logo-instagram" size={20} color={authColors.textPrimary} />
                  <Text style={styles.socialText}>
                    {extractSocialUsername(profile.instagram_url, 'instagram') || 'Not Set'}
                  </Text>
                </View>
              )}
              {profile.tiktok_url && (
                <View style={styles.socialPill}>
                  <Ionicons name="logo-tiktok" size={20} color={authColors.textPrimary} />
                  <Text style={styles.socialText}>
                    {extractSocialUsername(profile.tiktok_url, 'tiktok') || 'Not Set'}
                  </Text>
                </View>
              )}
              {profile.youtube_url && (
                <View style={styles.socialPill}>
                  <Ionicons name="logo-youtube" size={20} color={authColors.textPrimary} />
                  <Text style={styles.socialText}>
                    {extractSocialUsername(profile.youtube_url, 'youtube') || 'Not Set'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Travel Stats */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Travel Stats</Text>
          </View>
          <Text style={styles.travelStatsText}>
            <Text style={styles.travelStatsNumber}>{travelStats.totalTrips}</Text> Trips •{' '}
            <Text style={styles.travelStatsNumber}>{travelStats.countriesVisited}</Text> Countries
          </Text>
        </View>

        {/* Plans */}
        {userEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Plans</Text>
            <View style={styles.plansContainer}>
              {userEvents.map((event) => (
                <Pressable
                  key={event.id}
                  onPress={() => router.push(`/event/${event.id}`)}
                  style={styles.planCard}>
                  <AppImage
                    source={{ uri: event.image_uri || getCityImageUrl(event.city) }}
                    style={styles.planImage}
                  />
                  <View style={styles.planContent}>
                    <Text style={styles.planTitle} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <Text style={styles.planLocation} numberOfLines={1}>
                      📍 {event.city}
                    </Text>
                    {event.date && (
                      <Text style={styles.planDate}>
                        {new Date(event.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Interests */}
        {profile.interests && profile.interests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.interestsContainer}>
              {profile.interests.map((interestId, index) => {
                const interest = getInterestDetails(interestId);
                return (
                  <View key={index} style={styles.interestPill}>
                    <Text style={styles.interestEmoji}>{interest.emoji}</Text>
                    <Text style={styles.interestLabel}>{interest.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Languages */}
        {profile.languages && profile.languages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Languages</Text>
            <View style={styles.languagesPill}>
              <Text style={styles.languagesIcon}>aA</Text>
              <Text style={styles.languagesText}>{formatLanguages(profile.languages)}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: authColors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: authColors.bg,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: authColors.bg,
    padding: authSpace.xl,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: authColors.textPrimary,
    marginBottom: authSpace.lg,
  },
  errorButton: {
    backgroundColor: authColors.ctaPrimaryBg,
    paddingHorizontal: authSpace.xl,
    paddingVertical: authSpace.md,
    borderRadius: authRadius.pill,
  },
  errorButtonText: {
    color: authColors.ctaPrimaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  fixedHeaderButtons: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 40,
  },
  headerImageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
    position: 'relative',
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  premiumBadgeHeader: {
    position: 'absolute',
    top: 60,
    right: 20,
  },
  profileInfoOverlay: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
  },
  profileName: {
    fontSize: 36,
    fontWeight: '700',
    color: authColors.ctaPrimaryText,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  founderOverlayLabel: {
    marginTop: authSpace.sm,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  locationFlag: {
    fontSize: 24,
    marginRight: 8,
  },
  locationText: {
    fontSize: 18,
    color: authColors.ctaPrimaryText,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: authSpace.xl,
    paddingVertical: authSpace.xl,
    gap: authSpace.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: authColors.surface,
    paddingVertical: 14,
    borderRadius: authRadius.pill,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
    gap: authSpace.sm,
  },
  actionButtonAccepted: {
    borderColor: authColors.success,
    backgroundColor: '#F0FFF4',
  },
  messageButton: {
    backgroundColor: authColors.surface,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: authColors.textPrimary,
  },
  actionButtonTextAccepted: {
    color: authColors.success,
  },
  section: {
    paddingHorizontal: authSpace.xl,
    marginBottom: authSpace.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: authSpace.md,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: authColors.textPrimary,
    marginBottom: authSpace.md,
    letterSpacing: -0.3,
  },
  bioText: {
    fontSize: authType.body.fontSize,
    lineHeight: authType.body.lineHeight,
    color: authColors.textSecondary,
  },
  travelStatsText: {
    fontSize: 16,
    color: authColors.textSecondary,
    lineHeight: 24,
  },
  travelStatsNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: authColors.accent,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpace.sm,
  },
  interestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: authColors.surface,
    paddingHorizontal: authSpace.lg,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
    gap: 6,
  },
  interestEmoji: {
    fontSize: 16,
  },
  interestLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: authColors.textSecondary,
  },
  languagesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: authColors.accentSoft,
    paddingHorizontal: authSpace.lg,
    paddingVertical: authSpace.lg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: authColors.accentBorder,
    gap: authSpace.md,
  },
  languagesIcon: {
    fontSize: 18,
    fontWeight: '600',
    color: authColors.accent,
  },
  languagesText: {
    fontSize: 16,
    color: authColors.textSecondary,
    flex: 1,
  },
  socialsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpace.md,
  },
  socialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: authColors.surface,
    paddingHorizontal: authSpace.lg,
    paddingVertical: authSpace.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
    gap: authSpace.sm,
  },
  socialText: {
    fontSize: 15,
    fontWeight: '500',
    color: authColors.textPrimary,
  },
  plansContainer: {
    gap: authSpace.md,
  },
  planCard: {
    flexDirection: 'row',
    backgroundColor: authColors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
    overflow: 'hidden',
  },
  planImage: {
    width: 80,
    height: 80,
    backgroundColor: authColors.borderMuted,
  },
  planContent: {
    flex: 1,
    padding: authSpace.md,
    justifyContent: 'center',
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: authColors.textPrimary,
    marginBottom: 4,
  },
  planLocation: {
    fontSize: 14,
    color: authColors.textSecondary,
    marginBottom: 2,
  },
  planDate: {
    fontSize: 13,
    color: authColors.accent,
    fontWeight: '500',
  },
});
