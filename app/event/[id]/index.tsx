// app/event/[id]/index.tsx 

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
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '~/utils/supabase';
import { useAuth } from '~/app/contexts/AuthProvider';

const { width } = Dimensions.get('window');

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [isAttending, setIsAttending] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    about: true,
    interests: true,
    destinations: true,
    managedBy: true,
  });

  useEffect(() => {
    if (id) {
      fetchEventDetails();
    }
  }, [id]);

  const fetchEventDetails = async () => {
    try {
      // Fetch event with all related data
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
        .eq('id', id)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      // Check if current user is attending
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
      router.push('/auth');
      return;
    }

    setJoining(true);
    try {
      // Add user to attendance
      const { error } = await supabase
        .from('attendance')
        .insert({
          event_id: parseInt(id),
          user_id: session.user.id,
        });

      if (error) throw error;

      // Navigate to group chat
      router.push(`/chat/${id}`);
    } catch (error: any) {
      if (error?.code === '23505') {
        // Already attending - just go to chat
        router.push(`/chat/${id}`);
      } else {
        console.error('Error joining plan:', error);
        Alert.alert('Error', 'Failed to join plan');
      }
    } finally {
      setJoining(false);
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

  const getFlagEmoji = (countryCode: string) => {
    if (!countryCode) return '';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
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
          <Pressable onPress={() => router.back()} style={styles.backButton}>
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView bounces={false}>
        {/* Header with Image */}
        <View style={styles.headerContainer}>
          <Image
            source={{ 
              uri: event.image_uri || 'https://via.placeholder.com/400x300' 
            }}
            style={styles.headerImage}
          />
          
          {/* Back Button */}
          <Pressable 
            style={styles.headerBackButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>

          {/* Share Button */}
          <Pressable style={styles.shareButton}>
            <Ionicons name="share-outline" size={24} color="#fff" />
          </Pressable>

          {/* Overlay with title */}
          <View style={styles.imageOverlay}>
            <Text style={styles.overlayTitle}>{event.title}</Text>
            {event.country_code && (
              <View style={styles.countryBadge}>
                <Text style={styles.countryFlag}>
                  {getFlagEmoji(event.country_code)}
                </Text>
                <Text style={styles.countryName}>{event.country}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Date and Attendees */}
          <View style={styles.infoRow}>
            <View style={styles.dateContainer}>
              <Ionicons name="calendar-outline" size={20} color="#666" />
              <Text style={styles.dateText}>
                {formatDate(event.date, event.end_date)}
              </Text>
            </View>
          </View>

          {/* Attendees */}
          <View style={styles.attendeesSection}>
            <View style={styles.attendeesRow}>
              <View style={styles.avatarStack}>
                {event.attendees?.slice(0, 5).map((attendee, index) => (
                  <Image
                    key={attendee.user.id}
                    source={{ 
                      uri: attendee.user.avatar_url || 'https://via.placeholder.com/40' 
                    }}
                    style={[
                      styles.attendeeAvatar,
                      { marginLeft: index > 0 ? -12 : 0, zIndex: 5 - index }
                    ]}
                  />
                ))}
                {attendeeCount > 5 && (
                  <View style={[styles.moreAttendees, { marginLeft: -12 }]}>
                    <Text style={styles.moreAttendeesText}>
                      +{attendeeCount - 5}
                    </Text>
                  </View>
                )}
              </View>
              {spotsLeft !== null && spotsLeft > 0 && (
                <Text style={styles.spotsLeft}>
                  {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
                </Text>
              )}
            </View>
          </View>

          {/* Join/Chat Button */}
          <Pressable
            style={[
              styles.mainButton,
              (joining || (isAttending && !isCreator)) && styles.chatButton
            ]}
            onPress={isAttending ? () => router.push(`/chat/${id}`) : handleJoinPlan}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator color="#fff" />
            ) : isAttending ? (
              <>
                <Ionicons name="chatbubbles" size={20} color="#fff" />
                <Text style={styles.mainButtonText}>Open Chat</Text>
              </>
            ) : (
              <Text style={styles.mainButtonText}>Join Chat</Text>
            )}
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
                color="#666" 
              />
            </View>
            {expandedSections.about && (
              <Text style={styles.description}>{event.description}</Text>
            )}
          </Pressable>

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
                  color="#666" 
                />
              </View>
              {expandedSections.interests && (
                <View style={styles.interestsGrid}>
                  {event.interests.map((interest, index) => (
                    <View key={index} style={styles.interestItem}>
                      <View style={styles.interestIcon}>
                        <Ionicons 
                          name={getInterestIcon(interest)} 
                          size={24} 
                          color="#666" 
                        />
                      </View>
                      <Text style={styles.interestText}>{interest}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          )}

          {/* Destinations Section */}
          {event.venues && event.venues.length > 0 && (
            <Pressable 
              style={styles.section}
              onPress={() => toggleSection('destinations')}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Destinations</Text>
                <Ionicons 
                  name={expandedSections.destinations ? 'chevron-down' : 'chevron-forward'} 
                  size={20} 
                  color="#666" 
                />
              </View>
              {expandedSections.destinations && (
                <View style={styles.destinationsGrid}>
                  {event.venues.map((venue, index) => (
                    <View key={index} style={styles.destinationCard}>
                      <Image
                        source={{ 
                          uri: `https://source.unsplash.com/400x300/?${venue.venue_city || 'city'}` 
                        }}
                        style={styles.destinationImage}
                      />
                      <Text style={styles.destinationName}>{venue.venue_name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
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
                color="#666" 
              />
            </View>
            {expandedSections.managedBy && event.creator && (
              <Pressable 
                style={styles.organizerRow}
                onPress={() => router.push(`/profile/${event.creator.id}`)}
              >
                <Image
                  source={{ 
                    uri: event.creator.avatar_url || 'https://via.placeholder.com/50' 
                  }}
                  style={styles.organizerAvatar}
                />
                <View style={styles.organizerInfo}>
                  <Text style={styles.organizerName}>
                    {event.creator.full_name || event.creator.username || 'Unknown'}
                  </Text>
                  <Text style={styles.organizerRole}>Group Organizer</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </Pressable>
            )}
          </Pressable>

          {/* Report Button */}
          <Pressable style={styles.reportButton}>
            <Text style={styles.reportText}>Report Group</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Helper function for interest icons
function getInterestIcon(interest: string): any {
  const iconMap: { [key: string]: string } = {
    'Adventure': 'compass',
    'Beach': 'umbrella',
    'Night Life': 'moon',
    'Solo Travel': 'person',
    'Nature': 'leaf',
    'Food': 'restaurant',
    'Culture': 'school',
    'Sports': 'basketball',
    'Music': 'musical-notes',
    'Art': 'color-palette',
  };
  return (iconMap[interest] || 'star') as any;
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  headerContainer: {
    position: 'relative',
    height: 300,
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  overlayTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  countryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countryFlag: {
    fontSize: 20,
  },
  countryName: {
    fontSize: 16,
    color: '#fff',
  },
  content: {
    padding: 16,
  },
  infoRow: {
    marginBottom: 16,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  attendeesSection: {
    marginBottom: 20,
  },
  attendeesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendeeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  moreAttendees: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  moreAttendeesText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  spotsLeft: {
    fontSize: 14,
    color: '#666',
  },
  mainButton: {
    backgroundColor: '#007AFF',
    borderRadius: 25,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  chatButton: {
    backgroundColor: '#34C759',
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  description: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  interestItem: {
    width: (width - 48) / 3,
    alignItems: 'center',
    paddingVertical: 12,
  },
  interestIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  interestText: {
    fontSize: 13,
    color: '#333',
    textAlign: 'center',
  },
  destinationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  destinationCard: {
    width: (width - 44) / 2,
  },
  destinationImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    marginBottom: 8,
  },
  destinationName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  organizerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  organizerInfo: {
    flex: 1,
  },
  organizerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  organizerRole: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  reportButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  reportText: {
    fontSize: 14,
    color: '#999',
  },
});