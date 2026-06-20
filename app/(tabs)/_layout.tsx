// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import CreateOptionsModal from '~/components/CreateOptionsModal';
import { triggerLightHaptic } from '~/utils/haptics';
import { useAuth } from '~/contexts/AuthProvider';
import { supabase } from '~/utils/supabase';

const C = {
  accent: '#007AFF',
  // Faint accent wash behind the active tab (the "selected" pill in the inspo).
  activePill: 'rgba(0, 122, 255, 0.12)',
  // Near-opaque warm white so the bar reads as a clean surface over the map
  // (the old translucent cream looked muddy).
  surface: 'rgba(255, 253, 247, 0.98)',
  inactive: '#8A9099',
  border: 'rgba(17, 24, 39, 0.06)',
  // Match the unread badge the Chats list already uses (blue accent, not green).
  badge: '#007AFF',
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <>
      <Tabs
        tabBar={(props) => (
          <WaypointTabBar
            {...props}
            bottomInset={insets.bottom}
            createActive={showCreateModal}
            onCreatePress={() => setShowCreateModal(true)}
          />
        )}
        screenOptions={{
          headerShown: false,
        }}>
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="create" options={{ title: 'Create' }} />
        <Tabs.Screen name="chats" options={{ title: 'Chats' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>

      {/* Modal Overlay */}
      <CreateOptionsModal visible={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </>
  );
}

function WaypointTabBar({
  state,
  descriptors,
  navigation,
  bottomInset,
  createActive,
  onCreatePress,
}: any) {
  const { session } = useAuth();
  const activeRouteName = state.routes[state.index]?.name;
  const [unread, setUnread] = useState(0);

  // Keep a chat-unread total fresh for the Chats badge. Refreshes on mount and
  // whenever the active tab changes — cheap, and avoids a second realtime
  // subscription (the Chats screen owns the live channel; leaving it refreshes
  // this count, which is when the badge should drop after reading).
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) {
      setUnread(0);
      return;
    }
    let active = true;
    (async () => {
      const { data, error } = await supabase.rpc('get_user_conversations', { p_user_id: uid });
      if (!active || error || !data) return;
      const total = (data as any[]).reduce((sum, c) => sum + (c?.unread_count || 0), 0);
      setUnread(total);
    })();
    return () => {
      active = false;
    };
  }, [session?.user?.id, state.index]);

  // The home is the unified map now; every registered tab is shown.
  const visibleRoutes = state.routes;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(bottomInset, 12) }]}>
      <View style={styles.bar}>
        {visibleRoutes.map((route: any) => {
          const options = descriptors[route.key]?.options ?? {};
          const label = typeof options.title === 'string' ? options.title : route.name;
          const isCreate = route.name === 'create';
          const focused = isCreate ? createActive : activeRouteName === route.name;
          const tint = focused ? C.accent : C.inactive;

          const onPress = () => {
            triggerLightHaptic();

            if (isCreate) {
              onCreatePress();
              return;
            }

            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              style={styles.segment}>
              <View style={[styles.pill, focused && styles.pillActive]}>
                <View style={styles.iconWrap}>
                  <TabIcon routeName={route.name} focused={focused} color={tint} />
                  {route.name === 'chats' && unread > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                    </View>
                  )}
                </View>
                <Text numberOfLines={1} style={[styles.label, { color: tint }]}>
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TabIcon({
  routeName,
  focused,
  color,
}: {
  routeName: string;
  focused: boolean;
  color: string;
}) {
  switch (routeName) {
    case 'index':
      return <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />;
    case 'create':
      return (
        <Ionicons name={focused ? 'add-circle' : 'add-circle-outline'} size={26} color={color} />
      );
    case 'chats':
      return (
        <Ionicons
          name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
          size={24}
          color={color}
        />
      );
    case 'profile':
      return <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />;
    default:
      return <Ionicons name="ellipse-outline" size={24} color={color} />;
  }
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 14,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    paddingHorizontal: 6,
    paddingVertical: 8,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 18,
    minWidth: 62,
  },
  pillActive: {
    backgroundColor: C.activePill,
  },
  iconWrap: {
    // Anchor for the absolutely-positioned unread badge.
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: C.badge,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
