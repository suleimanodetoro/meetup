// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { View, Pressable } from 'react-native';
import { FontAwesome5, FontAwesome6 } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AntDesign } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import CreateOptionsModal from '~/components/CreateOptionsModal';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#4A90E2',
          tabBarInactiveTintColor: '#9E9E9E',
          tabBarStyle: {
            backgroundColor: 'white',
            borderTopWidth: 1,
            borderTopColor: '#F0F0F0',
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom > 0 ? insets.bottom / 2 : 8,
            paddingTop: 8,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            headerShown: false,
            tabBarIcon: ({ color }) => <MaterialCommunityIcons name="home" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: 'Map',
            headerShown: false,
            tabBarIcon: ({ color }) => <FontAwesome6 name="map-pin" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            title: '',
            headerShown: false,
            tabBarIcon: ({ color }) => (
              <View
                style={{
                  backgroundColor: showCreateModal ? '#3A7BC8' : '#4A90E2',
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: insets.bottom > 0 ? insets.bottom / 2 : 0,
                  marginTop: -8,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 4,
                  elevation: 5,
                  transform: [{ rotate: showCreateModal ? '45deg' : '0deg' }],
                }}>
                <FontAwesome5 
                  name={showCreateModal ? "times" : "plus"} 
                  size={20} 
                  color="white" 
                />
              </View>
            ),
            tabBarLabel: () => null,
            tabBarButton: (props) => (
              <Pressable
                {...props}
                onPress={() => setShowCreateModal(true)}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="chats"
          options={{
            title: 'Chats',
            headerShown: false,
            tabBarIcon: ({ color }) => <Ionicons name="chatbox-ellipses-outline" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            headerShown: false,
            tabBarIcon: ({ color }) => <AntDesign name="user" size={24} color={color} />,
          }}
        />
      </Tabs>

      {/* Modal Overlay */}
      <CreateOptionsModal 
        visible={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
      />
    </>
  );
}