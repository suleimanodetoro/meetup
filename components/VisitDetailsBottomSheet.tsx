// components/VisitDetailsBottomSheet.tsx
import React, { useRef, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import UserCard from './UserCard';
import PlanCard from './PlanCard';
import { useSubscription } from '~/hooks/useSubscription';
import { getCountryFlag } from '~/utils/countryFlags';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BLUR_START_INDEX = 10;

// Add the missing formatDateRange function
const formatDateRange = (startDate: string, endDate: string) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const options: Intl.DateTimeFormatOptions = { 
    month: 'short', 
    day: 'numeric' 
  };
  
  const startFormatted = start.toLocaleDateString('en-US', options);
  const endFormatted = end.toLocaleDateString('en-US', options);
  
  if (start.getMonth() === end.getMonth()) {
    return `${startFormatted} - ${end.getDate()}, ${end.getFullYear()}`;
  }
  
  return `${startFormatted} - ${endFormatted}, ${end.getFullYear()}`;
};

interface Props {
  visit: any;
  users: any[];
  plans: any[];
  activeTab: 'users' | 'plans';
  onTabChange: (tab: 'users' | 'plans') => void;
  onUserCardVisible: (index: number, isVisible: boolean) => void;
  loading: boolean;
  onRefresh: () => void;
}

export default function VisitDetailsBottomSheet({
  visit,
  users,
  plans,
  activeTab,
  onTabChange,
  onUserCardVisible,
  loading,
  onRefresh,
}: Props) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['35%', '75%', '95%'], []);
  const { hasSubscription } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);
  
  // Track visible items for upsell trigger - FIXED
  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 90,
    minimumViewTime: 120,
  }).current;

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    viewableItems.forEach((item) => {
      onUserCardVisible(item.index, item.isViewable);
    });
  }, [onUserCardVisible]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }, [onRefresh]);

  const renderUserItem = ({ item, index }) => {
    const isBlurred = !hasSubscription && index >= BLUR_START_INDEX;
    
    return (
      <Pressable
        style={styles.cardWrapper}
        onPress={() => !isBlurred && router.push(`/profile/${item.user_id}`)}
        disabled={isBlurred}
      >
        <UserCard user={item} />
        {isBlurred && (
          <>
            <BlurView
              intensity={40}
              style={StyleSheet.absoluteFillObject}
              tint="light"
            />
            <View style={styles.blurOverlay}>
              <Ionicons name="lock-closed" size={24} color="rgba(0,0,0,0.5)" />
            </View>
          </>
        )}
      </Pressable>
    );
  };

  const renderPlanItem = ({ item }) => (
    <Pressable
      style={styles.cardWrapper}
      onPress={() => router.push(`/event/${item.event_id}`)}
    >
      <PlanCard plan={item} />
    </Pressable>
  );

  // Add debug logging
  console.log('BottomSheet rendering with:', {
    visit: visit?.city,
    users: users?.length,
    plans: plans?.length,
    activeTab,
  });

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handle}
      enablePanDownToClose={false}
      enableOverDrag={true}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.cityRow}>
            <Text style={styles.cityName}>{visit.city}</Text>
            <Text style={styles.flag}>{getCountryFlag(visit.country_code)}</Text>
          </View>
          <Text style={styles.country}>{visit.country}</Text>
        </View>
        <Text style={styles.dateRange}>
          {formatDateRange(visit.start_date, visit.end_date)}
        </Text>
      </View>

      {/* Tab Buttons */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === 'users' && styles.activeTab]}
          onPress={() => onTabChange('users')}
        >
          <Ionicons 
            name="people" 
            size={20} 
            color={activeTab === 'users' ? '#4A90E2' : '#999'} 
          />
          <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>
            Users {users.length > 0 && `(${users.length})`}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'plans' && styles.activeTab]}
          onPress={() => onTabChange('plans')}
        >
          <Ionicons 
            name="calendar" 
            size={20} 
            color={activeTab === 'plans' ? '#4A90E2' : '#999'} 
          />
          <Text style={[styles.tabText, activeTab === 'plans' && styles.activeTabText]}>
            Plans {plans.length > 0 && `(${plans.length})`}
          </Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

      {/* Content wrapped in BottomSheetScrollView for proper scrolling */}
      <BottomSheetScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
          </View>
        ) : activeTab === 'users' ? (
          <>
            {users.length > 0 ? (
              users.map((user, index) => (
                <View key={user.user_id}>
                  {renderUserItem({ item: user, index })}
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No travelers yet for these dates</Text>
              </View>
            )}
          </>
        ) : (
          <>
            {plans.length > 0 ? (
              plans.map((plan) => (
                <View key={plan.event_id}>
                  {renderPlanItem({ item: plan })}
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No plans scheduled for these dates</Text>
              </View>
            )}
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 0,
  },
  headerLeft: {
    marginBottom: 8,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cityName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  flag: {
    fontSize: 24,
  },
  country: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  dateRange: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#E8F2FF',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
  },
  activeTabText: {
    color: '#4A90E2',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginTop: 16,
    marginHorizontal: 24,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 100,
  },
  cardWrapper: {
    marginHorizontal: 24,
    marginBottom: 16,
    position: 'relative',
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderContainer: {
    paddingVertical: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});