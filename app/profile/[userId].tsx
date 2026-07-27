// app/profile/[userId].tsx
import React, { useState, useEffect, useRef } from 'react';
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
import { shareContent } from '~/utils/share';
import { LinearGradient } from 'expo-linear-gradient';
import { INTERESTS, LANGUAGES } from '~/utils/constants';
import { FounderBadge } from '~/components/FounderBadge';
import { PremiumBadge } from '~/components/PremiumBadge';
import { PulseChip } from '~/components/PulseChip';
import { TravelStatsCard } from '~/components/TravelStatsCard';
import { SocialLinks } from '~/components/SocialLinks';
import { GradientButton } from '~/components/GradientButton';
import { display } from '~/utils/fonts';
import { useAuth } from '~/contexts/AuthProvider';
import { supabase } from '~/utils/supabase';
import { getCountryFlag } from '~/utils/countryFlags';
import { getCityImageUrl } from '~/utils/cityImages';
import { authColors, authRadius, authSpace, authType } from '~/utils/authTheme';
import { presentUserSafetyActions } from '~/modules/safety';
import {
  cancelFriendRequest,
  respondToFriendRequest,
  sendFriendRequest,
} from '~/utils/friendRequests';

const LANGUAGE_BY_CODE = new Map<string, (typeof LANGUAGES)[number]>(
  LANGUAGES.map((l) => [l.code, l])
);
function formatLanguages(codes: readonly string[] | undefined): string {
  if (!codes || codes.length === 0) return '';
  return codes.map((c) => LANGUAGE_BY_CODE.get(c)?.name ?? c).join(', ');
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked' | null;

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
  const { userId, preview } = useLocalSearchParams<{ userId: string; preview?: string }>();
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
    countryCodes: [] as string[],
  });

  // User's events/plans
  const [userEvents, setUserEvents] = useState<any[]>([]);

  // Pairwise "sidequests together" count from quest_ledger (0 = hidden).
  const [questsTogether, setQuestsTogether] = useState(0);

  // Pulse Monitor state for the pair. Only hot/warm/cooling are kept — cold
  // (or no row) is the default state of strangers and stays hidden.
  const [pulseState, setPulseState] = useState<'hot' | 'warm' | 'cooling' | null>(null);

  // Confidence Layer graduation prompt: set when get_graduation_prompts lists
  // this profile as a warm_pair_add target (post_quest_add has its own moment
  // in the completion sheet). The ref keeps prompt_shown at one emission per
  // screen visit even though fetchUserData re-runs after friend actions.
  const [warmPrompt, setWarmPrompt] = useState<{ context: string } | null>(null);
  const warmShownLogged = useRef(false);

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
          countryCodes: Array.from(uniqueCountries) as string[],
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

        // Pairwise sidequest ledger. quest_ledger is keyed on the canonical
        // unordered pair (user_lo < user_hi), matching the RPC's LEAST/GREATEST
        // — so order the two ids the same way here. Lowercase UUID strings sort
        // identically to Postgres' uuid ordering. RLS only exposes pairs the
        // viewer is in, so this read is scoped to us + them. Silent on error/0.
        const me = session.user.id;
        const lo = me < userId ? me : userId;
        const hi = me < userId ? userId : me;
        const { data: ledger } = await supabase
          .from('quest_ledger')
          .select('quest_count')
          .eq('user_lo', lo)
          .eq('user_hi', hi)
          .maybeSingle();
        setQuestsTogether(ledger?.quest_count ?? 0);

        // Pulse Monitor state, same canonical lo/hi keying as the ledger.
        const { data: pulse } = await supabase
          .from('pair_pulse')
          .select('state')
          .eq('user_lo', lo)
          .eq('user_hi', hi)
          .maybeSingle();
        setPulseState(
          pulse?.state === 'hot' || pulse?.state === 'warm' || pulse?.state === 'cooling'
            ? pulse.state
            : null
        );

        // Confidence Layer: is this pair suggested for graduation? The RPC
        // applies every gate server-side (blocks, privacy, dismissals,
        // any existing friendship row). Silent on error — the profile
        // renders fine without a prompt.
        const { data: prompts } = await supabase.rpc('get_graduation_prompts', { p_limit: 12 });
        const warm = prompts?.find(
          (pr) => pr.prompt_type === 'warm_pair_add' && pr.target_id === userId
        );
        setWarmPrompt(warm ? { context: warm.context } : null);
        if (warm && !warmShownLogged.current) {
          warmShownLogged.current = true;
          void supabase.rpc('log_engine_event', {
            p_event_key: 'confidence.prompt_shown',
            p_payload: { type: 'warm_pair_add', target_id: userId },
          });
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
        // Send friend request (shared write path — utils/friendRequests)
        await sendFriendRequest(userId);
        setFriendshipStatus('pending');
        setIsRequester(true);
        Alert.alert('Success', 'Friend request sent!');
      } else if (friendshipStatus === 'pending' && !isRequester) {
        // Accept friend request
        await respondToFriendRequest(userId, true);
        setFriendshipStatus('accepted');
        Alert.alert('Success', 'Friend request accepted!');
      } else if (friendshipStatus === 'pending' && isRequester) {
        // Cancel friend request
        await cancelFriendRequest(userId);
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

  // Warm-pair graduation prompt — accept: the normal request flow plus the
  // accepted engine event. The card disappears because a pending friendship
  // row now exists (and the RPC stops suggesting the pair).
  const acceptWarmPrompt = async () => {
    if (!session?.user?.id || !userId || processingAction) return;
    try {
      setProcessingAction(true);
      await sendFriendRequest(userId);
      setWarmPrompt(null);
      setFriendshipStatus('pending');
      setIsRequester(true);
      void supabase.rpc('log_engine_event', {
        p_event_key: 'confidence.prompt_accepted',
        p_payload: { type: 'warm_pair_add', target_id: userId },
      });
      Alert.alert('Success', 'Friend request sent!');
    } catch (error) {
      console.error('Error accepting warm-pair prompt:', error);
      Alert.alert('Error', 'Failed to process request');
    } finally {
      setProcessingAction(false);
    }
  };

  // Dismiss: hide immediately, then record it so the engine never re-asks
  // this pairing. Both writes are non-blocking best-effort.
  const dismissWarmPrompt = async () => {
    if (!session?.user?.id || !userId) return;
    setWarmPrompt(null);
    try {
      await supabase.from('prompt_dismissals').upsert(
        { user_id: session.user.id, target_id: userId, prompt_type: 'warm_pair_add' },
        { onConflict: 'user_id,target_id,prompt_type', ignoreDuplicates: true }
      );
      void supabase.rpc('log_engine_event', {
        p_event_key: 'confidence.prompt_dismissed',
        p_payload: { type: 'warm_pair_add', target_id: userId },
      });
    } catch (error) {
      console.warn('prompt dismissal failed (non-blocking):', error);
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
    if (friendshipStatus === 'declined' || friendshipStatus === 'blocked') return 'Unavailable';
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
        <GradientButton
          label="Go Back"
          onPress={() => router.back()}
          style={{ alignSelf: 'center' }}
        />
      </View>
    );
  }

  const isOwnProfile = session?.user?.id === userId;
  // Tapping your own avatar opens this screen with ?preview=1 so you can see
  // your profile as a stranger would (action buttons shown, but inert).
  const previewAsStranger = preview === '1' && isOwnProfile;
  const age = profile.birth_date ? calculateAge(profile.birth_date) : null;

  return (
    <View style={styles.container}>
      {/* Fixed Header Buttons */}
      <SafeAreaView style={styles.fixedHeaderButtons}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => userId && shareContent('profile', userId, profile?.full_name)}
            style={styles.headerButton}>
            <Ionicons name="share-outline" size={24} color="#fff" />
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
        </View>
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

        {/* Content sheet — a rounded card that overlaps the photo, inspo-style */}
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          {/* Action Buttons (or a "viewing as a stranger" preview banner) */}
          {(!isOwnProfile || previewAsStranger) && (
            <>
              {previewAsStranger && (
                <View style={styles.previewBanner}>
                  <Ionicons name="eye-outline" size={16} color={authColors.accent} />
                  <Text style={styles.previewBannerText}>
                    Preview — this is how others see your profile
                  </Text>
                </View>
              )}
              <View style={styles.actionButtons}>
                <Pressable
                  onPress={handleFriendRequest}
                  disabled={
                    processingAction ||
                    previewAsStranger ||
                    friendshipStatus === 'accepted' ||
                    friendshipStatus === 'declined' ||
                    friendshipStatus === 'blocked'
                  }
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
                  disabled={processingAction || previewAsStranger}
                  style={[styles.actionButton, styles.messageButton]}>
                  <Ionicons name="chatbubble-outline" size={20} color={authColors.textPrimary} />
                  <Text style={styles.actionButtonText}>Message</Text>
                </Pressable>
              </View>
            </>
          )}

          {/* Pairwise sidequest count — the "you two, together" retention hook
              — plus the Pulse Monitor state chip. Hidden at 0/cold/own profile. */}
          {(questsTogether > 0 || pulseState) && (
            <View style={styles.questsTogetherRow}>
              {questsTogether > 0 && (
                <View style={styles.questsTogetherChip}>
                  <Text style={styles.questsTogetherEmoji}>⚡</Text>
                  <Text style={styles.questsTogetherText}>
                    {questsTogether} sidequest{questsTogether === 1 ? '' : 's'} together
                  </Text>
                </View>
              )}
              <PulseChip state={pulseState} />
            </View>
          )}

          {/* Warm-pair graduation prompt (Confidence Layer) — a quiet,
              dismissible one-liner: the engine noticed real momentum with
              this person and suggests making it official. The X writes a
              dismissal so this pairing is never suggested again. */}
          {warmPrompt && (
            <View style={styles.warmPromptCard}>
              <Ionicons name="sparkles" size={15} color={authColors.accent} />
              <Text style={styles.warmPromptText} numberOfLines={2}>
                {warmPrompt.context}
              </Text>
              <Pressable
                onPress={acceptWarmPrompt}
                disabled={processingAction}
                hitSlop={6}
                style={styles.warmPromptAdd}>
                <Text style={styles.warmPromptAddText}>Add friend</Text>
              </Pressable>
              <Pressable onPress={dismissWarmPrompt} hitSlop={10} style={styles.warmPromptClose}>
                <Ionicons name="close" size={16} color={authColors.textSecondary} />
              </Pressable>
            </View>
          )}

          {/* About Me */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About Me</Text>
            <Text style={profile.bio ? styles.bioText : styles.bioPlaceholder}>
              {profile.bio ||
                `${profile.full_name?.split(' ')[0] || 'This user'} hasn't shared anything yet`}
            </Text>
          </View>

          {/* Socials — always shown; tap to open the app/browser when set */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Socials</Text>
            <SocialLinks
              instagram={profile.instagram_url}
              tiktok={profile.tiktok_url}
              youtube={profile.youtube_url}
            />
          </View>

          {/* Travel Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Travel Stats</Text>
            <TravelStatsCard
              visitedCodes={travelStats.countryCodes}
              width={SCREEN_WIDTH - authSpace.xl * 2}
              accent={authColors.accent}
            />
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
        </View>
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
  sheet: {
    backgroundColor: authColors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    paddingTop: authSpace.xs,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D7DBE0',
    marginTop: authSpace.md,
    marginBottom: authSpace.sm,
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
    fontFamily: display('700'),
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
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
    marginTop: 6,
  },
  locationFlag: {
    fontSize: 18,
    marginRight: 8,
  },
  locationText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  questsTogetherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: authSpace.sm,
    paddingHorizontal: authSpace.xl,
    marginBottom: authSpace.xl,
  },
  questsTogetherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: authColors.accentSoft,
    borderColor: authColors.accentBorder,
    borderWidth: 1,
    borderRadius: authRadius.pill,
    paddingHorizontal: authSpace.lg,
    paddingVertical: authSpace.sm,
  },
  questsTogetherEmoji: {
    fontSize: 15,
  },
  questsTogetherText: {
    fontSize: 14,
    fontWeight: '700',
    color: authColors.accent,
  },
  warmPromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpace.sm,
    backgroundColor: authColors.accentSoft,
    borderColor: authColors.accentBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: authSpace.lg,
    paddingVertical: authSpace.md,
    marginHorizontal: authSpace.xl,
    marginBottom: authSpace.xl,
  },
  warmPromptText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: authColors.textPrimary,
  },
  warmPromptAddText: {
    fontSize: 13,
    fontWeight: '700',
    color: authColors.accent,
  },
  warmPromptAdd: {
    paddingVertical: 2,
  },
  warmPromptClose: {
    padding: 2,
  },
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpace.sm,
    backgroundColor: authColors.accentSoft,
    borderColor: authColors.accentBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: authSpace.lg,
    paddingVertical: authSpace.md,
    marginHorizontal: authSpace.xl,
    marginBottom: authSpace.md,
  },
  previewBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: authColors.accent,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: authSpace.xl,
    paddingTop: authSpace.sm,
    paddingBottom: authSpace.xl,
    gap: authSpace.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: authColors.surface,
    paddingVertical: 15,
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
    marginBottom: authSpace.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: authSpace.md,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: authColors.textPrimary,
    marginBottom: authSpace.lg,
    letterSpacing: -0.2,
  },
  bioText: {
    fontSize: authType.body.fontSize,
    lineHeight: authType.body.lineHeight,
    color: authColors.textSecondary,
  },
  bioPlaceholder: {
    fontSize: authType.body.fontSize,
    lineHeight: authType.body.lineHeight,
    color: authColors.textSecondary,
    fontStyle: 'italic',
    opacity: 0.7,
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
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
    gap: 8,
  },
  interestEmoji: {
    fontSize: 16,
  },
  interestLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: authColors.textPrimary,
  },
  languagesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: authColors.surface,
    paddingHorizontal: authSpace.lg,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
    gap: authSpace.sm,
  },
  languagesIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: authColors.textPrimary,
  },
  languagesText: {
    fontSize: 15,
    fontWeight: '500',
    color: authColors.textPrimary,
  },
  socialsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpace.md,
  },
  socialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: authColors.surface,
    paddingHorizontal: authSpace.lg,
    paddingVertical: 14,
    borderRadius: 14,
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
