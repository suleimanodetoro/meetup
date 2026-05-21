// app/event/[id]/index.tsx - FIXED VERSION

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
  SafeAreaView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { Platform, ToastAndroid } from 'react-native';
import { getInterestEmoji } from '~/utils/constants';


import { supabase } from '~/utils/supabase';
import { useAuth } from '~/app/contexts/AuthProvider';
import { getCountryFlag } from '~/utils/geographic';

const { width, height } = Dimensions.get('window');

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
        .select(`
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
        `)
        .eq('id', Number(id))
        .single();

      if (eventError) throw eventError;
      setEvent(eventData as unknown as EventDetails);

      if (session?.user?.id) {
        const isUserAttending = eventData.attendees?.some(
          a => a.user.id === session.user.id
        );
        setIsAttending(!!isUserAttending);
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

    setJoining(true);
    try {
      const { error } = await supabase
        .from('attendance')
        .insert({
          event_id: parseInt(id),
          user_id: session.user.id,
        });

      if (error) throw error;
      router.push(`/chat/${id}`);
    } catch (error: any) {
      if (error?.code === '23505') {
        router.push(`/chat/${id}`);
      } else {
        console.error('Error joining plan:', error);
        Alert.alert('Error', 'Failed to join plan');
      }
    } finally {
      setJoining(false);
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

  const formatDate = (dateString: string, endDateString?: string) => {
    const date = new Date(dateString);
    const endDate = endDateString ? new Date(endDateString) : null;
    
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    };
    
    if (endDate && dateString !== endDateString) {
      return `${date.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
    }
    return date.toLocaleDateString('en-US', options);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
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
        .filter(c => !c.is_optional && c.amount)
        .reduce((sum, c) => sum + (c.amount || 0), 0);
      return total;
    }
    
    return null;
  };

  const formatCost = (amount: number | null) => {
    if (amount === null || amount === undefined) return null;
    if (amount === 0) return 'Free';
    
    const currency = event?.cost_currency || 'USD';
    const symbol = currency === 'USD' ? '$' : currency;
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

  const isCreator = session?.user?.id === event.user_id;
  const attendeeCount = event.attendees?.length || 0;
  const spotsLeft = event.max_attendees 
    ? Math.max(0, event.max_attendees - attendeeCount)
    : null;
  const totalCost = calculateTotalCost();
  const costDisplay = formatCost(totalCost);

  return (
    <View style={styles.container}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* Header with Image */}
        <View style={styles.headerContainer}>
          <Image
            source={{ 
              uri: event.image_uri || 'https://source.unsplash.com/800x600/?bangkok,travel' 
            }}
            style={styles.headerImage}
          />
          
          {/* FIXED: Back/Close Button - changes icon based on fromCreation */}
          <Pressable 
            style={styles.headerBackButton}
            onPress={handleBack}
          >
            <Ionicons 
              name={isFromCreation ? "close" : "arrow-back"} 
              size={24} 
              color="#000" 
            />
          </Pressable>

          {/* Share Button */}
          <Pressable style={styles.shareButton}>
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
            <View style={styles.locationRow}>
              <Text style={styles.locationFlag}>
                {getCountryFlag(event.country_code)}
              </Text>
              <Text style={styles.locationText}>
                {event.location_name || event.city}
                {event.country && `, ${event.country}`}
              </Text>
            </View>
          </View>

          {/* Date */}
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={18} color="#6B7280" />
            <Text style={styles.dateText}>
              {formatDate(event.date, event.end_date)}
            </Text>
          </View>

          {/* Attendees */}
          <View style={styles.attendeesSection}>
            <View style={styles.avatarStack}>
              {event.attendees?.slice(0, 5).map((attendee, index) => (
                <Image
                  key={attendee.user.id}
                  source={{ 
                    uri: attendee.user.avatar_url || `https://i.pravatar.cc/100?u=${attendee.user.id}` 
                  }}
                  style={[
                    styles.attendeeAvatar,
                    { marginLeft: index > 0 ? -15 : 0, zIndex: 5 - index }
                  ]}
                />
              ))}
              {attendeeCount > 5 && (
                <View style={[styles.moreAttendees, { marginLeft: -15, zIndex: 0 }]}>
                  <Text style={styles.moreAttendeesText}>
                    +{attendeeCount - 5}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Join Button */}
          <Pressable
            onPress={isAttending ? () => router.push(`/chat/${id}`) : handleJoinPlan}
            disabled={joining}
          >
            <LinearGradient
              colors={['#007AFF', '#0051D5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.joinButton}
            >
              {joining ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.joinButtonText}>
                  {isAttending ? 'Open Chat' : 'Join Chat'}
                </Text>
              )}
            </LinearGradient>
          </Pressable>

          {/* About Section */}
          <Pressable 
            style={styles.section}
            onPress={() => toggleSection('about')}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>About Trip</Text>
              <Ionicons 
                name={expandedSections.about ? 'chevron-down' : 'chevron-forward'} 
                size={20} 
                color="#000" 
              />
            </View>
            {expandedSections.about && (
              <Text style={styles.description}>{event.description}</Text>
            )}
          </Pressable>

          {/* Cost Section */}
          {(costDisplay || (event.costs && event.costs.length > 0)) && (
            <Pressable 
              style={styles.section}
              onPress={() => toggleSection('cost')}
            >
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
                  {event.costs && event.costs.length > 0 && !event.costs.some(c => c.item_name === 'No expected cost') && (
                    <View style={styles.costBreakdown}>
                      {event.costs.map((cost, index) => (
                        <View key={index} style={styles.costItem}>
                          <Text style={styles.costItemName}>
                            {cost.item_name}
                            {cost.is_optional && ' (optional)'}
                          </Text>
                          {cost.amount !== undefined && cost.amount !== null && (
                            <Text style={styles.costItemAmount}>
                              {formatCost(cost.amount)}
                            </Text>
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
            <Pressable 
              style={styles.section}
              onPress={() => toggleSection('interests')}
            >
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
                        <Text style={styles.interestEmoji}>
                          {getInterestEmoji(interest)}
                        </Text>
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
              <Pressable
                style={styles.sectionHeader}
                onPress={() => toggleSection('destinations')}
              >
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
                      android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
                    >
                      <Image
                        source={{ uri: `https://picsum.photos/400/300?random=${index}` }}
                        style={styles.destinationImage}
                        defaultSource={{
                          uri: 'https://via.placeholder.com/400x300/007AFF/FFFFFF?text=Loading',
                        }}
                      />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.8)']}
                        style={styles.destinationGradient}
                      >
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
          <Pressable 
            style={styles.section}
            onPress={() => toggleSection('managedBy')}
          >
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
                onPress={() => router.push(`/profile/${event.creator!.id}`)}
              >
                <Image
                  source={{
                    uri: event.creator.avatar_url || `https://i.pravatar.cc/100?u=${event.creator.id}`
                  }}
                  style={styles.organizerAvatar}
                />
                <View style={styles.organizerInfo}>
                  <Text style={styles.organizerName}>
                    {event.creator.full_name || event.creator.username || 'Unknown'}
                  </Text>
                  <Text style={styles.organizerRole}>Group Organizer</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </Pressable>
            )}
          </Pressable>

          {/* Report Button */}
          <Pressable style={styles.reportButton}>
            <Text style={styles.reportText}>Report Group</Text>
          </Pressable>
        </View>
      </ScrollView>
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
});