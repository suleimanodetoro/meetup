// app/event/[id]/index.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Dimensions,
  StatusBar,
} from 'react-native';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { AppImage } from '~/components/AppImage';
import { router, useLocalSearchParams } from 'expo-router';
import { shareContent } from '~/utils/share';
import { GradientButton } from '~/components/GradientButton';
import { InitialsAvatar } from '~/components/InitialsAvatar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { Platform, ToastAndroid } from 'react-native';
import { getInterestEmoji } from '~/utils/constants';

import { supabase } from '~/utils/supabase';
import { useAuth } from '~/contexts/AuthProvider';
import { getCountryFlag } from '~/utils/geographic';
import { openReport } from '~/modules/safety';
import { canSendFriendRequest, sendFriendRequest } from '~/utils/friendRequests';

const { width, height } = Dimensions.get('window');

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF',
  CNY: '¥',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  INR: '₹',
  NGN: '₦',
  ZAR: 'R',
  BRL: 'R$',
  MXN: 'MX$',
};

interface EventDetails {
  id: number;
  title: string;
  description: string;
  date: string;
  end_date?: string;
  time?: string;
  city: string;
  country?: string;
  country_code?: string;
  location_name?: string;
  image_uri?: string;
  max_attendees?: number;
  interests?: string[];
  cost?: number;
  cost_currency?: string;
  is_all_day?: boolean;
  is_one_day?: boolean;
  // Quest lifecycle — 'active' | 'completed' | 'cancelled' (see events.status).
  status?: string;
  completed_at?: string | null;
  user_id: string;
  creator?: {
    id: string;
    full_name?: string;
    username?: string;
    avatar_url?: string;
  };
  attendees?: Array<{
    user: {
      id: string;
      full_name?: string;
      username?: string;
      avatar_url?: string;
    };
  }>;
  venues?: Array<{
    venue_name: string;
    venue_city?: string;
    venue_address?: string;
  }>;
  costs?: Array<{
    item_name: string;
    amount?: number;
    is_optional?: boolean;
  }>;
}

export default function PlanDetailsScreen() {
  const { id, fromCreation } = useLocalSearchParams<{ id: string; fromCreation?: string }>();
  const { session } = useAuth();
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [isAttending, setIsAttending] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Confidence Layer graduation prompt: after a completion credited to a
  // partner who isn't already a friend, the partner sheet swaps to an
  // "Add {name} as a friend?" follow-up instead of closing.
  const [addFriendPrompt, setAddFriendPrompt] = useState<{ id: string; name: string } | null>(
    null
  );
  const [promptBusy, setPromptBusy] = useState(false);

  // Partner picker ("Who did you do it with?") — a flowing bottom sheet that
  // opens on demand (index -1 = closed) when a completed quest has other people
  // on its roster to credit. Solo quests skip it and complete directly.
  const partnerSheetRef = useRef<BottomSheet>(null);
  const partnerSnapPoints = useMemo(() => ['50%', '85%'], []);
  const renderPartnerBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    []
  );

  // Check if we came from plan creation
  const isFromCreation = fromCreation === 'true';

  const [expandedSections, setExpandedSections] = useState({
    about: true,
    interests: true,
    destinations: true,
    cost: true,
    managedBy: true,
  });

  useEffect(() => {
    StatusBar.setBarStyle('light-content');
    if (id) {
      fetchEventDetails();
    }
    return () => StatusBar.setBarStyle('dark-content');
  }, [id]);

  const fetchEventDetails = async () => {
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select(
          `
          *,
          creator:profiles!events_user_id_fkey(
            id,
            full_name,
            username,
            avatar_url
          ),
          attendees:attendance(
            user:profiles(
              id,
              full_name,
              username,
              avatar_url
            )
          ),
          venues:event_venues(
            venue_name,
            venue_city,
            venue_address
          ),
          costs:event_costs(
            item_name,
            amount,
            is_optional
          )
        `
        )
        .eq('id', Number(id))
        .single();

      if (eventError) throw eventError;
      setEvent(eventData as unknown as EventDetails);

      if (session?.user?.id) {
        const isUserAttending = eventData.attendees?.some((a) => a.user.id === session.user.id);
        // The creator is the host of their own sidequest — always a member,
        // even if the attendance row never landed (e.g. an interrupted
        // creation), so they see the host state, not a "Join" button.
        const isHost = eventData.user_id === session.user.id;
        setIsAttending(!!isUserAttending || isHost);
      }
    } catch (error) {
      console.error('Error fetching event:', error);
      Alert.alert('Error', 'Failed to load plan details');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinPlan = async () => {
    if (!session?.user?.id) {
      router.push('/welcome');
      return;
    }
    const eventId = Number(id);
    if (!Number.isFinite(eventId)) {
      Alert.alert('Error', 'Invalid plan id');
      return;
    }

    setJoining(true);
    try {
      const { error } = await supabase.from('attendance').insert({
        event_id: eventId,
        user_id: session.user.id,
      });

      if (error) throw error;
      router.push(`/chat/${id}` as never);
    } catch (error: any) {
      if (error?.code === '23505') {
        router.push(`/chat/${id}` as never);
      } else {
        console.error('Error joining plan:', error);
        Alert.alert('Error', 'Failed to join plan');
      }
    } finally {
      setJoining(false);
    }
  };

  // Should the completion sheet graduate into "add them as a friend?" The
  // server applies the same privacy, bilateral-block and existing-relationship
  // gate used by the write RPC. The local dismissal is the prompt-specific
  // final gate. Any read failure errs on the side of not prompting.
  const shouldPromptAddFriend = async (partnerId: string): Promise<boolean> => {
    const me = session?.user?.id;
    if (!me) return false;
    const [allowedResult, dismissalResult] = await Promise.allSettled([
      canSendFriendRequest(partnerId),
      supabase
        .from('prompt_dismissals')
        .select('created_at')
        .eq('user_id', me)
        .eq('target_id', partnerId)
        .eq('prompt_type', 'post_quest_add')
        .limit(1),
    ]);
    if (allowedResult.status !== 'fulfilled' || dismissalResult.status !== 'fulfilled')
      return false;
    if (dismissalResult.value.error) return false;
    return allowedResult.value && (dismissalResult.value.data?.length ?? 0) === 0;
  };

  // Accept the graduation prompt: the shared friend-request write path plus
  // the accepted engine event, then the sheet closes.
  const acceptAddFriend = async () => {
    const me = session?.user?.id;
    if (!addFriendPrompt || !me || promptBusy) return;
    setPromptBusy(true);
    try {
      await sendFriendRequest(addFriendPrompt.id);
      void supabase.rpc('log_engine_event', {
        p_event_key: 'confidence.prompt_accepted',
        p_payload: { type: 'post_quest_add', target_id: addFriendPrompt.id },
        p_event_id: Number(id) || undefined,
      });
      Alert.alert('Request sent', `${addFriendPrompt.name} will be asked to confirm.`);
    } catch (error) {
      console.error('Error sending friend request from prompt:', error);
      Alert.alert('Request unavailable', 'This person is not accepting friend requests.');
    } finally {
      setPromptBusy(false);
      partnerSheetRef.current?.close();
    }
  };

  // "Not now": close, then record the dismissal so this pairing is never
  // re-prompted post-quest. Best-effort — never blocks the flow.
  const dismissAddFriend = async () => {
    const me = session?.user?.id;
    const target = addFriendPrompt?.id;
    partnerSheetRef.current?.close();
    if (!me || !target) return;
    try {
      await supabase.from('prompt_dismissals').upsert(
        { user_id: me, target_id: target, prompt_type: 'post_quest_add' },
        { onConflict: 'user_id,target_id,prompt_type', ignoreDuplicates: true }
      );
      void supabase.rpc('log_engine_event', {
        p_event_key: 'confidence.prompt_dismissed',
        p_payload: { type: 'post_quest_add', target_id: target },
        p_event_id: Number(id) || undefined,
      });
    } catch (error) {
      console.warn('prompt dismissal failed (non-blocking):', error);
    }
  };

  // Mark this quest completed via the complete_quest RPC and, when a partner is
  // chosen, credit the pairwise ledger. The RPC is idempotent (only the first
  // completion transition writes), so a race against another roster member just
  // no-ops server-side. `partnerId` is null for a solo / skipped completion.
  const completeWith = async (partnerId: string | null) => {
    if (completing) return;
    const eventId = Number(id);
    if (!Number.isFinite(eventId)) {
      Alert.alert('Error', 'Invalid plan id');
      return;
    }

    setCompleting(true);
    try {
      const args: { p_event_id: number; p_partner_id?: string } = { p_event_id: eventId };
      if (partnerId) args.p_partner_id = partnerId;

      const { error } = await supabase.rpc('complete_quest', args);
      if (error) throw error;

      // Reflect the completion locally so the CTA flips to the "Completed" chip
      // without a refetch.
      setEvent((prev) =>
        prev ? { ...prev, status: 'completed', completed_at: new Date().toISOString() } : prev
      );

      // Confidence Layer: if the tagged partner isn't already a friend (and
      // this pairing wasn't dismissed before), the sheet graduates into an
      // add-friend follow-up instead of closing.
      const partner = partnerId
        ? (event?.attendees ?? []).find((a) => a.user.id === partnerId)
        : undefined;
      if (partner && (await shouldPromptAddFriend(partner.user.id))) {
        setAddFriendPrompt({
          id: partner.user.id,
          name: partner.user.full_name || partner.user.username || 'them',
        });
        void supabase.rpc('log_engine_event', {
          p_event_key: 'confidence.prompt_shown',
          p_payload: { type: 'post_quest_add', target_id: partner.user.id },
          p_event_id: eventId,
        });
        partnerSheetRef.current?.snapToIndex(0);
      } else {
        partnerSheetRef.current?.close();
      }
    } catch (error: any) {
      console.error('Error completing quest:', error);
      const message: string = error?.message || '';
      Alert.alert(
        'Could not complete',
        /participant/i.test(message)
          ? 'Only people on this sidequest can mark it completed.'
          : 'Something went wrong marking this completed. Please try again.'
      );
    } finally {
      setCompleting(false);
    }
  };

  // Tap "Mark completed": if the roster has other people, ask who it was done
  // with (the ledger pairing); otherwise complete solo straight away.
  const handleMarkCompleted = () => {
    const others = (event?.attendees ?? []).filter((a) => a.user.id !== session?.user?.id);
    if (others.length === 0) {
      completeWith(null);
    } else {
      partnerSheetRef.current?.snapToIndex(0);
    }
  };

  const copyAddressToClipboard = async (address?: string, fallback?: string) => {
    const text = (address || fallback || '').trim();
    if (!text) return;

    await Clipboard.setStringAsync(text);

    if (Platform.OS === 'android') {
      ToastAndroid.show('Address copied', ToastAndroid.SHORT);
    } else {
      Alert.alert('Copied to clipboard', text);
    }
  };

  // Tap the city row → city-name-keyed overview screen. The screen
  // always renders, even for cities with no current visitors and/or no
  // upcoming plans — no visit_id lookup, no explore fallback.
  const openCityDetail = (city: string | null | undefined) => {
    if (!city) return;
    router.push(`/city/${encodeURIComponent(city)}` as never);
  };

  // `events.date` and `events.end_date` are `timestamp with time zone`.
  // `new Date(...)` reads as the UTC instant; `toLocaleDateString`
  // renders the local date for the user.
  const formatDate = (dateString: string, endDateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const endDate = endDateString ? new Date(endDateString) : null;
    const endValid = endDate && !isNaN(endDate.getTime());

    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    };

    if (endValid && dateString !== endDateString) {
      return `${date.toLocaleDateString('en-US', options)} - ${endDate!.toLocaleDateString('en-US', options)}`;
    }
    return date.toLocaleDateString('en-US', options);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // FIXED: Handle back navigation properly
  const handleBack = () => {
    if (isFromCreation) {
      // If from creation, go home (dismiss the flow)
      router.replace('/(tabs)');
    } else {
      // Normal back navigation
      router.back();
    }
  };

  const calculateTotalCost = () => {
    if (event?.cost !== undefined && event?.cost !== null) {
      return event.cost;
    }

    if (event?.costs && event.costs.length > 0) {
      const total = event.costs
        .filter((c) => !c.is_optional && c.amount)
        .reduce((sum, c) => sum + (c.amount || 0), 0);
      return total;
    }

    return null;
  };

  const formatCost = (amount: number | null) => {
    if (amount === null || amount === undefined) return null;
    if (amount === 0) return 'Free';

    const code = (event?.cost_currency ?? 'USD').toUpperCase();
    const symbol = CURRENCY_SYMBOLS[code] ?? `${code} `;
    return `${symbol}${amount.toFixed(0)}`;
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

  if (!event) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Plan not found</Text>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const attendeeCount = event.attendees?.length || 0;
  const totalCost = calculateTotalCost();
  const costDisplay = formatCost(totalCost);

  // Completion CTA gating: a "Completed" status chip is public (anyone viewing a
  // finished quest sees it); the "Mark completed" action only shows to people on
  // the roster (attendee or host) while the quest is still active. Early
  // completion is allowed — a roster member can close the loop any time.
  const isCompleted = event.status === 'completed';
  const showMarkCompleted = !isCompleted && isAttending;
  const showCompletionBlock = isCompleted || showMarkCompleted;
  const partnerCandidates = (event.attendees ?? []).filter(
    (a) => a.user.id !== session?.user?.id
  );

  return (
    <View style={styles.container}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* Header with Image */}
        <View style={styles.headerContainer}>
          {event.image_uri ? (
            <AppImage source={{ uri: event.image_uri }} style={styles.headerImage} />
          ) : (
            <LinearGradient
              colors={['#3A4A63', '#243044']}
              style={[styles.headerImage, styles.headerPlaceholder]}>
              <Ionicons name="location" size={44} color="rgba(255,255,255,0.45)" />
              {event.city ? <Text style={styles.headerPlaceholderText}>{event.city}</Text> : null}
            </LinearGradient>
          )}

          {/* FIXED: Back/Close Button - changes icon based on fromCreation */}
          <Pressable style={styles.headerBackButton} onPress={handleBack}>
            <Ionicons name={isFromCreation ? 'close' : 'arrow-back'} size={24} color="#000" />
          </Pressable>

          {/* Share Button */}
          <Pressable
            style={styles.shareButton}
            onPress={() => id && shareContent('event', id, event?.title)}>
            <Ionicons name="share-outline" size={24} color="#000" />
          </Pressable>

          {/* Price Badge */}
          {costDisplay && (
            <View style={styles.priceBadge}>
              <Text style={styles.priceText}>{costDisplay}</Text>
            </View>
          )}
        </View>

        {/* Main Content - ALL THE REST STAYS THE SAME */}
        <View style={styles.content}>
          {/* Title and Location */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>{event.title}</Text>
            <Pressable
              style={styles.locationRow}
              disabled={!event.city}
              onPress={() => openCityDetail(event.city)}
              hitSlop={6}>
              <Text style={styles.locationFlag}>{getCountryFlag(event.country_code)}</Text>
              <Text style={styles.locationText}>
                {/* Venue + city reads naturally ("Firewater, Dundee"); the flag
                    already conveys the country and the map pin shows the city.
                    Dedupe so a city-only quest never renders "Dundee, Dundee". */}
                {[event.location_name, event.city]
                  .filter(
                    (p, i, a) =>
                      !!p && a.findIndex((x) => x?.toLowerCase() === p?.toLowerCase()) === i
                  )
                  .join(', ') ||
                  event.country ||
                  'Location'}
              </Text>
              {event.city ? (
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color="#9CA3AF"
                  style={{ marginLeft: 4 }}
                />
              ) : null}
            </Pressable>
          </View>

          {/* Date */}
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={18} color="#6B7280" />
            <Text style={styles.dateText}>{formatDate(event.date, event.end_date)}</Text>
          </View>

          {/* Attendees */}
          <View style={styles.attendeesSection}>
            <View style={styles.avatarStack}>
              {event.attendees
                ?.slice(0, 5)
                .map((attendee, index) =>
                  attendee.user.avatar_url ? (
                    <AppImage
                      key={attendee.user.id}
                      source={{ uri: attendee.user.avatar_url }}
                      style={[
                        styles.attendeeAvatar,
                        { marginLeft: index > 0 ? -15 : 0, zIndex: 5 - index },
                      ]}
                    />
                  ) : (
                    <InitialsAvatar
                      key={attendee.user.id}
                      name={attendee.user.full_name}
                      id={attendee.user.id}
                      size={44}
                      style={[
                        styles.attendeeAvatar,
                        { marginLeft: index > 0 ? -15 : 0, zIndex: 5 - index },
                      ]}
                    />
                  )
                )}
              {attendeeCount > 5 && (
                <View style={[styles.moreAttendees, { marginLeft: -15, zIndex: 0 }]}>
                  <Text style={styles.moreAttendeesText}>+{attendeeCount - 5}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Join Button */}
          <GradientButton
            label={isAttending ? 'Open Chat' : 'Join Chat'}
            onPress={isAttending ? () => router.push(`/chat/${id}`) : handleJoinPlan}
            loading={joining}
            style={{ marginBottom: showCompletionBlock ? 14 : 32 }}
          />

          {/* Completion state — a green refraction CTA while active, a status
              chip once done. */}
          {isCompleted ? (
            <View style={styles.completedChip}>
              <Ionicons name="checkmark-circle" size={16} color="#059669" />
              <Text style={styles.completedChipText}>
                {event.completed_at
                  ? `Completed · ${formatDate(event.completed_at)}`
                  : 'Completed'}
              </Text>
            </View>
          ) : showMarkCompleted ? (
            <GradientButton
              label="Mark completed"
              icon="checkmark-done"
              colors={['#34D399', '#0F9D6B']}
              onPress={handleMarkCompleted}
              loading={completing}
              style={{ marginBottom: 32 }}
            />
          ) : null}

          {/* About Section */}
          <Pressable style={styles.section} onPress={() => toggleSection('about')}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>About Trip</Text>
              <Ionicons
                name={expandedSections.about ? 'chevron-down' : 'chevron-forward'}
                size={20}
                color="#000"
              />
            </View>
            {expandedSections.about && <Text style={styles.description}>{event.description}</Text>}
          </Pressable>

          {/* Cost Section */}
          {(costDisplay || (event.costs && event.costs.length > 0)) && (
            <Pressable style={styles.section} onPress={() => toggleSection('cost')}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Cost Details</Text>
                <Ionicons
                  name={expandedSections.cost ? 'chevron-down' : 'chevron-forward'}
                  size={20}
                  color="#000"
                />
              </View>
              {expandedSections.cost && (
                <View>
                  {event.costs &&
                    event.costs.length > 0 &&
                    !event.costs.some((c) => c.item_name === 'No expected cost') && (
                      <View style={styles.costBreakdown}>
                        {event.costs.map((cost, index) => (
                          <View key={index} style={styles.costItem}>
                            <Text style={styles.costItemName}>
                              {cost.item_name}
                              {cost.is_optional && ' (optional)'}
                            </Text>
                            {cost.amount !== undefined && cost.amount !== null && (
                              <Text style={styles.costItemAmount}>{formatCost(cost.amount)}</Text>
                            )}
                          </View>
                        ))}
                      </View>
                    )}

                  <View style={styles.costTotalContainer}>
                    <Text style={styles.costTotalLabel}>Estimated Total</Text>
                    <Text style={styles.costTotalAmount}>{costDisplay || 'Free'}</Text>
                  </View>
                </View>
              )}
            </Pressable>
          )}

          {/* Interests Section */}
          {event.interests && event.interests.length > 0 && (
            <Pressable style={styles.section} onPress={() => toggleSection('interests')}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Interests</Text>
                <Ionicons
                  name={expandedSections.interests ? 'chevron-down' : 'chevron-forward'}
                  size={20}
                  color="#000"
                />
              </View>
              {expandedSections.interests && (
                <View style={styles.interestsGrid}>
                  {event.interests.map((interest, index) => (
                    <View key={index} style={styles.interestItem}>
                      <View style={styles.interestIconContainer}>
                        <Text style={styles.interestEmoji}>{getInterestEmoji(interest)}</Text>
                      </View>
                      <Text style={styles.interestText}>{interest}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          )}

          {/* Venues/Destinations Section */}
          {event.venues && event.venues.length > 0 && (
            <View style={styles.section}>
              <Pressable style={styles.sectionHeader} onPress={() => toggleSection('destinations')}>
                <Text style={styles.sectionTitle}>Destinations</Text>
                <Ionicons
                  name={expandedSections.destinations ? 'chevron-down' : 'chevron-forward'}
                  size={20}
                  color="#000"
                />
              </Pressable>

              {expandedSections.destinations && (
                <View style={styles.destinationsContainer}>
                  {event.venues.map((venue, index) => (
                    <Pressable
                      key={index}
                      style={styles.destinationCard}
                      onPress={() =>
                        copyAddressToClipboard(
                          venue.venue_address,
                          `${venue.venue_name}${venue.venue_city ? `, ${venue.venue_city}` : ''}`
                        )
                      }
                      android_ripple={{ color: 'rgba(0,0,0,0.05)' }}>
                      {/* Local solid behind the gradient/label — venues have no
                          photo, so the old random picsum was wasted egress + flicker. */}
                      <View style={[styles.destinationImage, { backgroundColor: '#3A4A63' }]} />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.8)']}
                        style={styles.destinationGradient}>
                        <Text style={styles.destinationName}>{venue.venue_name}</Text>
                        {venue.venue_address && (
                          <Text style={styles.destinationAddress}>{venue.venue_address}</Text>
                        )}
                      </LinearGradient>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Managed By Section */}
          <Pressable style={styles.section} onPress={() => toggleSection('managedBy')}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Managed By</Text>
              <Ionicons
                name={expandedSections.managedBy ? 'chevron-down' : 'chevron-forward'}
                size={20}
                color="#000"
              />
            </View>
            {expandedSections.managedBy && event.creator && (
              <Pressable
                style={styles.organizerRow}
                onPress={() => router.push(`/profile/${event.creator!.id}`)}>
                {event.creator.avatar_url ? (
                  <AppImage
                    source={{ uri: event.creator.avatar_url }}
                    style={styles.organizerAvatar}
                  />
                ) : (
                  <InitialsAvatar
                    name={event.creator.full_name || event.creator.username}
                    id={event.creator.id}
                    size={50}
                    style={styles.organizerAvatar}
                  />
                )}
                <View style={styles.organizerInfo}>
                  <Text style={styles.organizerName}>
                    {event.creator.full_name || event.creator.username || 'Unknown'}
                  </Text>
                  {/* Auto-generated quests are transparently system-hosted:
                      the 'waypoint' profile is the engine, not a person. */}
                  <Text style={styles.organizerRole}>
                    {event.creator.username === 'waypoint'
                      ? 'Suggested by Waypoint'
                      : 'Group Organizer'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </Pressable>
            )}
          </Pressable>

          {/* Report Button */}
          <Pressable
            style={styles.reportButton}
            onPress={() =>
              openReport({
                targetType: 'event',
                targetId: id,
                reportedUserId: event.creator?.id ?? null,
                name: event.title,
              })
            }>
            <Text style={styles.reportText}>Report Group</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* "Who did you do it with?" — flowing partner picker. Closed (index -1)
          until handleMarkCompleted opens it for quests with a shared roster. */}
      <BottomSheet
        ref={partnerSheetRef}
        index={-1}
        snapPoints={partnerSnapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        onClose={() => setAddFriendPrompt(null)}
        backdropComponent={renderPartnerBackdrop}
        backgroundStyle={styles.partnerSheetBackground}
        handleIndicatorStyle={styles.partnerSheetHandle}>
        <BottomSheetScrollView contentContainerStyle={styles.partnerSheetContent}>
          {addFriendPrompt ? (
            /* Post-completion graduation prompt (Confidence Layer): same
               sheet, new content — the quest is logged, so suggest making
               the pairing official. Plain-text dismiss writes a dismissal
               so this pairing is never re-prompted. */
            <>
              <Text style={styles.partnerSheetTitle}>
                Add {addFriendPrompt.name} as a friend?
              </Text>
              <Text style={styles.partnerSheetSubtitle}>
                Sidequest logged. Friends can message each other directly — keep this one
                going.
              </Text>
              <GradientButton
                label="Add friend"
                icon="person-add-outline"
                onPress={acceptAddFriend}
                loading={promptBusy}
                style={styles.promptAddButton}
              />
              <Pressable
                onPress={dismissAddFriend}
                disabled={promptBusy}
                hitSlop={8}
                style={styles.promptDismiss}>
                <Text style={styles.promptDismissText}>Not now</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.partnerSheetTitle}>Who did you do it with?</Text>
              <Text style={styles.partnerSheetSubtitle}>
                Tag someone to log this sidequest together, or skip if you went solo.
              </Text>

              <Pressable
                style={styles.partnerRow}
                onPress={() => completeWith(null)}
                disabled={completing}>
                <View style={[styles.partnerAvatarFallback, styles.partnerSoloIcon]}>
                  <Ionicons name="person-outline" size={20} color="#6B7280" />
                </View>
                <Text style={styles.partnerName}>Solo / skip</Text>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </Pressable>

              {partnerCandidates.map((attendee) => (
                <Pressable
                  key={attendee.user.id}
                  style={styles.partnerRow}
                  onPress={() => completeWith(attendee.user.id)}
                  disabled={completing}>
                  {attendee.user.avatar_url ? (
                    <AppImage
                      source={{ uri: attendee.user.avatar_url }}
                      style={styles.partnerAvatar}
                    />
                  ) : (
                    <InitialsAvatar
                      name={attendee.user.full_name || attendee.user.username}
                      id={attendee.user.id}
                      size={40}
                      style={styles.partnerAvatar}
                    />
                  )}
                  <Text style={styles.partnerName} numberOfLines={1}>
                    {attendee.user.full_name || attendee.user.username || 'Someone'}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </Pressable>
              ))}

              {completing ? (
                <ActivityIndicator color="#0F9D6B" style={{ marginTop: 16 }} />
              ) : null}
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

// Styles remain exactly the same
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#6B7280',
    marginBottom: 20,
    fontWeight: '500',
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerContainer: {
    position: 'relative',
    height: height * 0.45,
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerPlaceholderText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 18,
    fontWeight: '600',
  },
  headerBackButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  shareButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  priceBadge: {
    position: 'absolute',
    bottom: 50,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  priceText: {
    color: '#059669',
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: -30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  titleSection: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationFlag: {
    fontSize: 24,
  },
  locationText: {
    fontSize: 16,
    color: '#4B5563',
    fontWeight: '500',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dateText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  attendeesSection: {
    marginBottom: 24,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendeeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#fff',
  },
  moreAttendees: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  moreAttendeesText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  completedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 32,
  },
  completedChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  partnerSheetBackground: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  partnerSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
  },
  partnerSheetContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  partnerSheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -0.3,
  },
  partnerSheetSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 21,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  partnerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  partnerAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  partnerSoloIcon: {
    backgroundColor: '#F3F4F6',
  },
  partnerName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  joinButton: {
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  section: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  costBreakdown: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  costItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  costItemName: {
    fontSize: 15,
    color: '#6B7280',
  },
  costItemAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  costTotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  costTotalLabel: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
  costTotalAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#059669',
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  interestItem: {
    width: (width - 56) / 3,
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  interestIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  interestEmoji: {
    fontSize: 28,
  },
  interestText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    fontWeight: '500',
  },
  destinationsContainer: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  destinationCard: {
    width: width - 40,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  destinationImage: {
    width: '100%',
    height: '100%',
  },
  destinationGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    justifyContent: 'flex-end',
    padding: 16,
  },
  destinationName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  destinationAddress: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  organizerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
  },
  organizerInfo: {
    flex: 1,
  },
  organizerName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  organizerRole: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  reportButton: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 8,
  },
  reportText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  promptAddButton: {
    marginTop: 20,
  },
  promptDismiss: {
    alignSelf: 'center',
    marginTop: 14,
    padding: 6,
  },
  promptDismissText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
});
