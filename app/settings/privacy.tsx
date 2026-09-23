// app/settings/privacy.tsx

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { AppImage } from '~/components/AppImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { InitialsAvatar } from '~/components/InitialsAvatar';
import { router } from 'expo-router';
import type { BlockedUser, UpdatePrivacySettingsInput } from '~/types/messaging';
import type { Database } from '~/types/supabase';
import { useAuth } from '~/contexts/AuthProvider';
import { supabase } from '~/utils/supabase';
import {
  Card,
  Check,
  Row,
  SectionFootnote,
  SectionHeader,
  settingsTheme,
} from '~/components/SettingsList';

const MESSAGE_OPTIONS = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'friends_only', label: 'Friends only' },
  { value: 'nobody', label: 'Nobody' },
] as const;

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public (Anyone can see)' },
  { value: 'friends_only', label: 'Friends only' },
  { value: 'private', label: 'Private (Only me)' },
] as const;

type PrivacySettings = Database['public']['Tables']['user_privacy_settings']['Row'];

export default function PrivacySettingsScreen() {
  const { session } = useAuth();
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [blockedLoading, setBlockedLoading] = useState(true);
  const [blockedError, setBlockedError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchPrivacySettings = useCallback(async () => {
    if (!session?.user?.id) return;

    setLoading(true);
    setSettingsError(null);
    try {
      const { data, error } = await supabase
        .from('user_privacy_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        // No settings exist, create default
        const defaultSettings = {
          user_id: session.user.id,
          message_privacy: 'everyone',
          profile_visibility: 'public',
          show_online_status: true,
          show_read_receipts: true,
          allow_friend_requests: true,
        };

        const { data: newSettings, error: insertError } = await supabase
          .from('user_privacy_settings')
          .insert(defaultSettings)
          .select()
          .single();

        if (insertError) throw insertError;
        if (!newSettings) throw new Error('Privacy settings were not returned');
        setSettings(newSettings);
      } else {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching privacy settings:', error);
      setSettings(null);
      setSettingsError(
        'Could not load your privacy settings. Your saved choices have not changed.'
      );
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  const fetchBlockedUsers = useCallback(async () => {
    if (!session?.user?.id) return;

    setBlockedLoading(true);
    setBlockedError(null);
    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select(
          `
          *,
          blocked_profile:profiles!blocked_users_blocked_id_fkey(id, full_name, avatar_url)
        `
        )
        .eq('blocker_id', session.user.id);

      if (error) throw error;
      setBlockedUsers(
        (data ?? []).filter((row) => row.blocked_id && row.blocker_id) as BlockedUser[]
      );
    } catch (error) {
      console.error('Error fetching blocked users:', error);
      setBlockedError('Could not load blocked users. Your blocks are still in place.');
    } finally {
      setBlockedLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (session?.user?.id) {
      void fetchPrivacySettings();
      void fetchBlockedUsers();
    }
  }, [fetchBlockedUsers, fetchPrivacySettings, session?.user?.id]);

  const updateSetting = async <K extends keyof UpdatePrivacySettingsInput>(
    key: K,
    value: UpdatePrivacySettingsInput[K]
  ) => {
    if (!settings || !session?.user?.id || saving) return;

    setSaving(true);
    const previous = settings;
    setSettings({ ...settings, [key]: value });

    try {
      const { error } = await supabase
        .from('user_privacy_settings')
        .update({ [key]: value, updated_at: new Date().toISOString() })
        .eq('user_id', session.user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      setSettings(previous); // Revert on error
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
            const blockerId = session?.user?.id;
            if (!blockerId) return;
            try {
              const { error } = await supabase
                .from('blocked_users')
                .delete()
                .eq('blocker_id', blockerId)
                .eq('blocked_id', blockedUserId);
              if (error) throw error;

              setBlockedUsers((prev) => prev.filter((b) => b.blocked_id !== blockedUserId));
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

  const messagePrivacy = settings?.message_privacy;
  const profileVisibility = settings?.profile_visibility;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="arrow-back" size={26} color={settingsTheme.label} />
        </Pressable>
        <Text style={styles.title}>Privacy</Text>
        {saving ? <ActivityIndicator size="small" color={settingsTheme.accent} /> : null}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.sectionLoading}>
            <ActivityIndicator size="large" color={settingsTheme.accent} />
          </View>
        ) : settingsError || !settings ? (
          <>
            <SectionHeader title="Privacy settings unavailable" />
            <Card>
              <Row
                label="Try again"
                sublabel={settingsError ?? 'Could not load your privacy settings.'}
                onPress={() => void fetchPrivacySettings()}
              />
            </Card>
          </>
        ) : (
          <>
            <SectionHeader title="Who can message me" />
            <Card>
              {MESSAGE_OPTIONS.map((option) => (
                <Row
                  key={option.value}
                  label={option.label}
                  onPress={() => updateSetting('message_privacy', option.value)}
                  disabled={saving}
                  right={<Check selected={messagePrivacy === option.value} />}
                />
              ))}
            </Card>
            <SectionFootnote>Control who can start a conversation with you.</SectionFootnote>

            <SectionHeader title="Profile visibility" />
            <Card>
              {VISIBILITY_OPTIONS.map((option) => (
                <Row
                  key={option.value}
                  label={option.label}
                  onPress={() => updateSetting('profile_visibility', option.value)}
                  disabled={saving}
                  right={<Check selected={profileVisibility === option.value} />}
                />
              ))}
            </Card>
            <SectionFootnote>Control who can see your profile information.</SectionFootnote>

            <SectionHeader title="Activity" />
            <Card>
              <Row
                label="Show online status"
                sublabel="Let others see when you're online"
                right={
                  <Switch
                    value={settings?.show_online_status || false}
                    disabled={saving}
                    onValueChange={(value) => updateSetting('show_online_status', value)}
                    trackColor={{ false: '#E0E0E0', true: settingsTheme.accent }}
                    thumbColor="white"
                  />
                }
              />
              <Row
                label="Read receipts"
                sublabel="Show when you've read messages"
                right={
                  <Switch
                    value={settings?.show_read_receipts || false}
                    disabled={saving}
                    onValueChange={(value) => updateSetting('show_read_receipts', value)}
                    trackColor={{ false: '#E0E0E0', true: settingsTheme.accent }}
                    thumbColor="white"
                  />
                }
              />
              <Row
                label="Friend requests"
                sublabel="Allow others to send you friend requests"
                right={
                  <Switch
                    value={settings?.allow_friend_requests || false}
                    disabled={saving}
                    onValueChange={(value) => updateSetting('allow_friend_requests', value)}
                    trackColor={{ false: '#E0E0E0', true: settingsTheme.accent }}
                    thumbColor="white"
                  />
                }
              />
            </Card>
          </>
        )}

        <SectionHeader title="Blocked users" />
        {blockedLoading ? (
          <View style={styles.sectionLoading}>
            <ActivityIndicator color={settingsTheme.accent} />
          </View>
        ) : blockedError ? (
          <Card>
            <Row
              label="Try again"
              sublabel={blockedError}
              onPress={() => void fetchBlockedUsers()}
            />
          </Card>
        ) : blockedUsers.length > 0 ? (
          <Card>
            {blockedUsers.map((blocked) => (
              <View key={blocked.id} style={styles.blockedRow}>
                {blocked.blocked_profile?.avatar_url ? (
                  <AppImage
                    source={{ uri: blocked.blocked_profile.avatar_url }}
                    style={styles.blockedAvatar}
                  />
                ) : (
                  <InitialsAvatar
                    name={blocked.blocked_profile?.full_name}
                    id={blocked.blocked_id}
                    size={40}
                    style={styles.blockedAvatar}
                  />
                )}
                <Text style={styles.blockedName} numberOfLines={1}>
                  {blocked.blocked_profile?.full_name || 'Blocked user'}
                </Text>
                <Pressable
                  style={styles.unblockButton}
                  onPress={() => unblockUser(blocked.blocked_id)}>
                  <Text style={styles.unblockText}>Unblock</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        ) : (
          <Card>
            <Row label="You haven’t blocked anyone" />
          </Card>
        )}
        <SectionFootnote>Blocked users can’t message you or see your profile.</SectionFootnote>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: settingsTheme.background,
  },
  sectionLoading: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 12,
  },
  backButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: settingsTheme.label,
  },
  content: {
    paddingBottom: 48,
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  blockedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 14,
    backgroundColor: '#E9E9E9',
  },
  blockedName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    color: settingsTheme.label,
  },
  unblockButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#EEF1F4',
    borderRadius: 9,
  },
  unblockText: {
    fontSize: 14,
    color: settingsTheme.accent,
    fontWeight: '700',
  },
});
