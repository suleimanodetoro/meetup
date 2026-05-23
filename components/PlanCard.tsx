// components/PlanCard.tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface PlanCardProps {
  plan: {
    event_id: number;
    title: string;
    description?: string;
    image_uri?: string;
    date: string;
    location_name?: string;
    cost?: number;
    attendee_count: number;
    host_name?: string;
    host_avatar?: string;
  };
}

export default function PlanCard({ plan }: PlanCardProps) {
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.container}>
      {/* Image or Gradient */}
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
        
        {/* Attendee Count Badge */}
        {plan.attendee_count > 0 && (
          <View style={styles.attendeeBadge}>
            <Ionicons name="people" size={14} color="white" />
            <Text style={styles.attendeeCount}>{plan.attendee_count}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {plan.title}
        </Text>
        
        {plan.description && (
          <Text style={styles.description} numberOfLines={2}>
            {plan.description}
          </Text>
        )}
        
        <View style={styles.details}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={14} color="#666" />
            <Text style={styles.detailText}>{formatDate(plan.date)}</Text>
          </View>
          
          {plan.location_name && (
            <View style={styles.detailItem}>
              <Ionicons name="location-outline" size={14} color="#666" />
              <Text style={styles.detailText} numberOfLines={1}>
                {plan.location_name}
              </Text>
            </View>
          )}
          
          {plan.cost !== null && plan.cost !== undefined && (
            <View style={styles.detailItem}>
              <Text style={styles.cost}>
                {plan.cost === 0 ? 'Free' : `$${plan.cost}`}
              </Text>
            </View>
          )}
        </View>
        
        {/* Host Info */}
        {plan.host_name && (
          <View style={styles.hostInfo}>
            {plan.host_avatar ? (
              <Image source={{ uri: plan.host_avatar }} style={styles.hostAvatar} />
            ) : (
              <View style={[styles.hostAvatar, styles.hostAvatarPlaceholder]}>
                <Text style={styles.hostInitial}>
                  {plan.host_name[0]?.toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.hostName}>Hosted by {plan.host_name}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  imageContainer: {
    height: 160,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attendeeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  attendeeCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#666',
    maxWidth: 150,
  },
  cost: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  hostInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  hostAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  hostAvatarPlaceholder: {
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hostInitial: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
  },
  hostName: {
    fontSize: 12,
    color: '#999',
  },
});