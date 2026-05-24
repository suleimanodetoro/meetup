// components/VisitDetailsBottomSheet.tsx
import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  type ViewToken,
} from 'react-native';
import { router } from 'expo-router';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import UserCard from './UserCard';
import PlanCard from './PlanCard';
import { useSubscription } from '~/hooks/useSubscription';
import { getCountryFlag } from '~/utils/countryFlags';

const BLUR_START_INDEX = 10;

interface Props {
  visit: {
    city: string;
    country?: string | null;
    country_code?: string | null;
  };
  /** Optional window label, e.g. "May 24 – May 31". Hidden when omitted. */
  windowLabel?: string | null;
  users: any[];
  plans: any[];
  activeTab: 'users' | 'plans';
  onTabChange: (tab: 'users' | 'plans') => void;
  /** A paywall-eligible card just entered the viewport. */
  onPaywallCardEntered: (index: number) => void;
  /** A paywall-eligible card just left the viewport. */
  onPaywallCardLeft: (index: number) => void;
  loading: boolean;
  onRefresh: () => void | Promise<void>;
  onLoadMoreUsers: () => void;
  onLoadMorePlans: () => void;
  usersLoadingMore: boolean;
  plansLoadingMore: boolean;
}

export default function VisitDetailsBottomSheet({
  visit,
  windowLabel,
  users,
  plans,
  activeTab,
  onTabChange,
  onPaywallCardEntered,
  onPaywallCardLeft,
  loading,
  onRefresh,
  onLoadMoreUsers,
  onLoadMorePlans,
  usersLoadingMore,
  plansLoadingMore,
}: Props) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['35%', '75%', '95%'], []);
  const { hasSubscription } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);

  // FlatList rejects any change to viewabilityConfigCallbackPairs after
  // mount, so we cannot rebuild it when hasSubscription or the callbacks
  // change. Instead, cache the latest values in refs and read them at
  // call time inside a callback whose identity is stable for the
  // FlatList's lifetime.
  const hasSubscriptionRef = useRef(hasSubscription);
  const onEnteredRef = useRef(onPaywallCardEntered);
  const onLeftRef = useRef(onPaywallCardLeft);
  useEffect(() => { hasSubscriptionRef.current = hasSubscription; }, [hasSubscription]);
  useEffect(() => { onEnteredRef.current = onPaywallCardEntered; }, [onPaywallCardEntered]);
  useEffect(() => { onLeftRef.current = onPaywallCardLeft; }, [onPaywallCardLeft]);

  // Track which paywall-eligible indices are currently in view. Each
  // viewability event computes the set difference vs the previous set
  // to emit explicit enter/leave events to the trigger hook. Items that
  // briefly flash into view as the FlatList materialises rows and then
  // leave before the dwell completes will enter+leave in quick
  // succession, which cancels their pending timer in the hook.
  const visibleIndicesRef = useRef<Set<number>>(new Set());

  const viewabilityConfigCallbackPairs = useRef([
    {
      viewabilityConfig: {
        // Card counts as visible when >= 50% of itself is on-screen.
        // Keeps cards at the bottom edge of the bottom sheet from
        // briefly counting as visible just because their top pixel
        // peeked through.
        itemVisiblePercentThreshold: 50,
      },
      onViewableItemsChanged: ({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (hasSubscriptionRef.current) return;

        const next = new Set<number>();
        for (const vt of viewableItems) {
          if (vt.index !== null && vt.index >= BLUR_START_INDEX) {
            next.add(vt.index);
          }
        }

        // Items entering view (in next but not in prev).
        for (const i of next) {
          if (!visibleIndicesRef.current.has(i)) onEnteredRef.current(i);
        }
        // Items leaving view (in prev but not in next).
        for (const i of visibleIndicesRef.current) {
          if (!next.has(i)) onLeftRef.current(i);
        }

        visibleIndicesRef.current = next;
      },
    },
  ]).current;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }, [onRefresh]);

  const renderUserItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
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
              <BlurView intensity={40} style={StyleSheet.absoluteFillObject} tint="light" />
              <View style={styles.blurOverlay}>
                <Ionicons name="lock-closed" size={24} color="rgba(0,0,0,0.5)" />
              </View>
            </>
          )}
        </Pressable>
      );
    },
    [hasSubscription],
  );

  const renderPlanItem = useCallback(
    ({ item }: { item: any }) => (
      <Pressable
        style={styles.cardWrapper}
        onPress={() => router.push(`/event/${item.event_id}`)}
      >
        <PlanCard plan={item} />
      </Pressable>
    ),
    [],
  );

  const renderHeader = () => (
    <>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.cityRow}>
            <Text style={styles.cityName}>{visit.city}</Text>
            <Text style={styles.flag}>{getCountryFlag(visit.country_code)}</Text>
          </View>
          {visit.country ? <Text style={styles.country}>{visit.country}</Text> : null}
        </View>
        {windowLabel ? (
          <View style={styles.windowChip}>
            <Ionicons name="calendar-outline" size={14} color="#007AFF" />
            <Text style={styles.windowChipText}>{windowLabel}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === 'users' && styles.activeTab]}
          onPress={() => onTabChange('users')}
        >
          <Ionicons name="people" size={20} color={activeTab === 'users' ? '#007AFF' : '#999'} />
          <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>
            Users
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'plans' && styles.activeTab]}
          onPress={() => onTabChange('plans')}
        >
          <Ionicons name="calendar" size={20} color={activeTab === 'plans' ? '#007AFF' : '#999'} />
          <Text style={[styles.tabText, activeTab === 'plans' && styles.activeTabText]}>
            Plans
          </Text>
        </Pressable>
      </View>

      <View style={styles.divider} />
    </>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>
        {activeTab === 'users'
          ? windowLabel
            ? 'No profiles match these dates'
            : 'No upcoming visitors yet'
          : windowLabel
            ? 'No plans match these dates'
            : 'No upcoming plans yet'}
      </Text>
    </View>
  );

  const renderFooter = () => {
    const isLoadingMore = activeTab === 'users' ? usersLoadingMore : plansLoadingMore;
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color="#007AFF" />
      </View>
    );
  };

  const handleEndReached = useCallback(() => {
    if (activeTab === 'users') onLoadMoreUsers();
    else onLoadMorePlans();
  }, [activeTab, onLoadMoreUsers, onLoadMorePlans]);

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
      {loading ? (
        <>
          {renderHeader()}
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        </>
      ) : activeTab === 'users' ? (
        <BottomSheetFlatList
          key="city-users-list"
          data={users}
          keyExtractor={(item) => `user-${item.user_id}`}
          renderItem={renderUserItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
        />
      ) : (
        <BottomSheetFlatList
          key="city-plans-list"
          data={plans}
          keyExtractor={(item) => `plan-${item.event_id}`}
          renderItem={renderPlanItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
        />
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
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
  windowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#E8F2FF',
    borderRadius: 999,
    marginTop: 8,
  },
  windowChipText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
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
    color: '#007AFF',
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
  footerLoader: {
    paddingVertical: 16,
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
