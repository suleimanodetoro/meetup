// app/settings/privacy.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  Alert,
  ActivityIndicator,Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { 
  UserPrivacySettings, 
  MessagePrivacy, 
  ProfileVisibility,
  BlockedUser 
} from '~/types/messaging';
import { useAuth } from '../contexts/AuthProvider';
import { supabase } from '~/utils/supabase';

export default function PrivacySettingsScreen() {
  const { session } = useAuth();
  const [settings, setSettings] = useState<UserPrivacySettings | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      fetchPrivacySettings();
      fetchBlockedUsers();
    }
  }, [session]);

  const fetchPrivacySettings = async () => {
    if (!session?.user?.id) return;

    try {
      const { data, error } = await supabase
        .from('user_privacy_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // No settings exist, create default
        const defaultSettings: Partial<UserPrivacySettings> = {
          user_id: session.user.id,
          message_privacy: 'everyone',
          profile_visibility: 'public',
          show_online_status: true,
          show_read_receipts: true,
          allow_friend_requests: true,
        };

        const { data: newSettings } = await supabase
          .from('user_privacy_settings')
          .insert(defaultSettings)
          .select()
          .single();

        setSettings(newSettings);
      } else if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching privacy settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBlockedUsers = async () => {
    if (!session?.user?.id) return;

    try {
      const { data } = await supabase
        .from('blocked_users')
        .select(`
          *,
          blocked_profile:profiles!blocked_users_blocked_id_fkey(*)
        `)
        .eq('blocker_id', session.user.id);

      setBlockedUsers(data || []);
    } catch (error) {
      console.error('Error fetching blocked users:', error);
    }
  };

  const updateSetting = async (key: keyof UserPrivacySettings, value: any) => {
    if (!settings || !session?.user?.id) return;

    setSaving(true);
    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);

    try {
      const { error } = await supabase
        .from('user_privacy_settings')
        .update({ [key]: value, updated_at: new Date().toISOString() })
        .eq('user_id', session.user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      // Revert on error
      setSettings(settings);
      Alert.alert('Error', 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  const unblockUser = async (blockedUserId: string) => {
    Alert.alert(
      'Unblock User',
      'Are you sure you want to unblock this user? They will be able to message you again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              await supabase
                .from('blocked_users')
                .delete()
                .eq('blocker_id', session?.user?.id)
                .eq('blocked_id', blockedUserId);

              setBlockedUsers(prev => prev.filter(b => b.blocked_id !== blockedUserId));
              Alert.alert('User unblocked');
            } catch (error) {
              console.error('Error unblocking user:', error);
              Alert.alert('Error', 'Failed to unblock user');
            }
          },
        },
      ]
    );
  };

  const RadioOption = ({ 
    label, 
    value, 
    currentValue, 
    onSelect 
  }: { 
    label: string; 
    value: string; 
    currentValue: string; 
    onSelect: (value: string) => void;
  }) => (
    <Pressable
      style={styles.radioOption}
      onPress={() => onSelect(value)}
    >
      <View style={styles.radioCircle}>
        {currentValue === value && <View style={styles.radioSelected} />}
      </View>
      <Text style={styles.radioLabel}>{label}</Text>
    </Pressable>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Settings</Text>
        <View style={styles.headerRight}>
          {saving && <ActivityIndicator size="small" color="#007AFF" />}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Message Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Who can message me</Text>
          <Text style={styles.sectionDescription}>
            Control who can start a conversation with you
          </Text>
          
          <RadioOption
            label="Everyone"
            value="everyone"
            currentValue={settings?.message_privacy || 'everyone'}
            onSelect={(value) => updateSetting('message_privacy', value)}
          />
          <RadioOption
            label="Friends only"
            value="friends_only"
            currentValue={settings?.message_privacy || 'everyone'}
            onSelect={(value) => updateSetting('message_privacy', value)}
          />
          <RadioOption
            label="Nobody"
            value="nobody"
            currentValue={settings?.message_privacy || 'everyone'}
            onSelect={(value) => updateSetting('message_privacy', value)}
          />
        </View>

        {/* Profile Visibility */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile visibility</Text>
          <Text style={styles.sectionDescription}>
            Control who can see your profile information
          </Text>
          
          <RadioOption
            label="Public (Anyone can see)"
            value="public"
            currentValue={settings?.profile_visibility || 'public'}
            onSelect={(value) => updateSetting('profile_visibility', value)}
          />
          <RadioOption
            label="Friends only"
            value="friends_only"
            currentValue={settings?.profile_visibility || 'public'}
            onSelect={(value) => updateSetting('profile_visibility', value)}
          />
          <RadioOption
            label="Private (Only me)"
            value="private"
            currentValue={settings?.profile_visibility || 'public'}
            onSelect={(value) => updateSetting('profile_visibility', value)}
          />
        </View>

        {/* Toggle Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity</Text>
          
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Show online status</Text>
              <Text style={styles.toggleDescription}>
                Let others see when you're online
              </Text>
            </View>
            <Switch
              value={settings?.show_online_status || false}
              onValueChange={(value) => updateSetting('show_online_status', value)}
              trackColor={{ false: '#e0e0e0', true: '#007AFF' }}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Read receipts</Text>
              <Text style={styles.toggleDescription}>
                Show when you've read messages
              </Text>
            </View>
            <Switch
              value={settings?.show_read_receipts || false}
              onValueChange={(value) => updateSetting('show_read_receipts', value)}
              trackColor={{ false: '#e0e0e0', true: '#007AFF' }}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Friend requests</Text>
              <Text style={styles.toggleDescription}>
                Allow others to send you friend requests
              </Text>
            </View>
            <Switch
              value={settings?.allow_friend_requests || false}
              onValueChange={(value) => updateSetting('allow_friend_requests', value)}
              trackColor={{ false: '#e0e0e0', true: '#007AFF' }}
            />
          </View>
        </View>

        {/* Blocked Users */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Blocked users</Text>
          <Text style={styles.sectionDescription}>
            {blockedUsers.length > 0 
              ? "Users you've blocked can't message you or see your profile"
              : "You haven't blocked anyone"}
          </Text>
          
          {blockedUsers.map((blocked) => (
            <View key={blocked.id} style={styles.blockedUser}>
              <Image
                source={{ 
                  uri: blocked.blocked_profile?.avatar_url || 'https://via.placeholder.com/40' 
                }}
                style={styles.blockedAvatar}
              />
              <Text style={styles.blockedName}>
                {blocked.blocked_profile?.full_name || 'Unknown User'}
              </Text>
              <Pressable
                style={styles.unblockButton}
                onPress={() => unblockUser(blocked.blocked_id)}
              >
                <Text style={styles.unblockText}>Unblock</Text>
              </Pressable>
            </View>
          ))}
        </View>

        {/* Data & Storage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Storage</Text>
          
          <Pressable style={styles.actionRow}>
            <Text style={styles.actionLabel}>Clear message cache</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </Pressable>
          
          <Pressable style={styles.actionRow}>
            <Text style={styles.actionLabel}>Download my data</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007AFF',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  radioLabel: {
    fontSize: 16,
    color: '#000',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#000',
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: 12,
    color: '#666',
  },
  blockedUser: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  blockedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  blockedName: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  unblockButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  unblockText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionLabel: {
    fontSize: 16,
    color: '#000',
  },
});