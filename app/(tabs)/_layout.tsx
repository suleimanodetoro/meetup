// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  AntDesign,
  FontAwesome5,
  FontAwesome6,
  Ionicons,
  MaterialCommunityIcons,
} from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import CreateOptionsModal from '~/components/CreateOptionsModal';
import { triggerLightHaptic } from '~/utils/haptics';

const C = {
  accent: '#007AFF',
  // Tinted translucent cream so the map / content shows through faintly behind the floating bar.
  tabbarBg: 'rgba(255, 252, 244, 0.85)',
  inactive: '#6F757D',
  border: 'rgba(255,255,255,0.85)',
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
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: 'Map',
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            title: 'Create',
          }}
        />
        <Tabs.Screen
          name="chats"
          options={{
            title: 'Chats',
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
          }}
        />
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
  const activeRouteName = state.routes[state.index]?.name;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.tabBarWrap, { bottom: Math.max(bottomInset, 16) }]}>
      <View style={styles.tabBar}>
        {state.routes.map((route: any) => {
          const options = descriptors[route.key]?.options ?? {};
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : typeof options.title === 'string'
                ? options.title
                : route.name;
          const isCreate = route.name === 'create';
          const isFocused = isCreate ? createActive : activeRouteName === route.name;
          const iconColor = isFocused ? C.accent : C.inactive;

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

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              style={styles.tabSegment}>
              <TabIcon routeName={route.name} focused={isFocused} color={iconColor} />
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
      return (
        <MaterialCommunityIcons name={focused ? 'home' : 'home-outline'} size={25} color={color} />
      );
    case 'map':
      return <FontAwesome6 name="map-pin" size={22} color={color} />;
    case 'create':
      return <FontAwesome5 name={focused ? 'times' : 'plus'} size={21} color={color} />;
    case 'chats':
      return (
        <Ionicons
          name={focused ? 'chatbox-ellipses' : 'chatbox-ellipses-outline'}
          size={25}
          color={color}
        />
      );
    case 'profile':
      return <AntDesign name="user" size={25} color={color} />;
    default:
      return <Ionicons name="ellipse-outline" size={22} color={color} />;
  }
}

const styles = StyleSheet.create({
  tabBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  tabBar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    borderRadius: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: C.tabbarBg,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabSegment: {
    width: 52,
    height: 48,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
