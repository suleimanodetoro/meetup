// components/PlanCardHome.tsx - FIXED VERSION WITH PRICE DISPLAY

import React, { memo } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Event } from '~/types/db';

interface ExtendedEvent extends Event {
  attendee_count?: number;
  recent_attendees?: Array<{
    id: string;
    full_name: string;
    avatar_url?: string;
  }>;
}

interface PlanCardHomeProps {
  plan: ExtendedEvent;
}

const PlanCardHome = memo(({ plan }: PlanCardHomeProps) => {
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if today
    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })}`;
    }

    // Check if tomorrow
    if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow, ${date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })}`;
    }

    // Otherwise show date
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const attendeeCount = plan.attendee_count || 0;
  const displayAttendees = plan.recent_attendees?.slice(0, 3) || [];

  return (
    <Pressable
      onPress={() => router.push(`/event/${plan.id}`)}
      style={styles.container}
    >
      {/* Image Section */}
      <View style={styles.imageContainer}>
        {plan.image_uri ? (
          <Image source={{ uri: plan.image_uri }} style={styles.image} />
        ) : (
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.imagePlaceholder}
          >
            <Ionicons name="calendar" size={32} color="white" />
          </LinearGradient>
        )}
      </View>

      {/* Content Section */}
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {plan.title}
        </Text>

        {/* Date & Location Row */}
        <View style={styles.infoRow}>
          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={14} color="#6B7280" />
            <Text style={styles.dateText} numberOfLines={1}>
              {formatDate(plan.date ?? '')}
            </Text>
          </View>
        </View>

        {/* Location Row */}
        {(plan.location_name || plan.city) && (
          <View style={styles.locationContainer}>
            <Ionicons name="location-outline" size={14} color="#6B7280" />
            <Text style={styles.locationText} numberOfLines={1}>
              {plan.location_name || plan.city}
            </Text>
          </View>
        )}

        {/* Price Display - ADDED */}
        {plan.cost !== null && plan.cost !== undefined && (
          <View style={styles.priceContainer}>
            <Text style={styles.priceText}>
              {plan.cost === 0 ? 'Free' : `${plan.cost}`}
            </Text>
          </View>
        )}

        {/* Attendees Section */}
        {attendeeCount > 0 && (
          <View style={styles.attendeesContainer}>
            <View style={styles.avatarStack}>
              {displayAttendees.map((user, index) => (
                <View
                  key={user.id}
                  style={[
                    styles.avatar,
                    index > 0 && { marginLeft: -8 }
                  ]}
                >
                  {user?.avatar_url ? (
                    <Image
                      source={{ uri: user.avatar_url }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons name="person" size={12} color="#999" />
                    </View>
                  )}
                </View>
              ))}
            </View>

            <Text style={styles.attendeeCount}>
              {attendeeCount}+ going
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    width: 280,
    backgroundColor: 'white',
    borderRadius: 16,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  imageContainer: {
    height: 160,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dateText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 6,
    flex: 1,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 6,
    flex: 1,
  },
  priceContainer: {
    marginBottom: 8,
  },
  priceText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#059669',
  },
  attendeesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  attendeeCount: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
});

export default PlanCardHome;