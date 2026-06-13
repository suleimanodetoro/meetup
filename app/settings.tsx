// app/settings.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Purchases from 'react-native-purchases';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/contexts/AuthProvider';
import { isRevenueCatConfigured } from '~/lib/revenuecat';
import UpsellModal from '~/components/UpsellModal';
import {
  Card,
  Chevron,
  ExternalLinkIcon,
  Row,
  SectionHeader,
  settingsTheme,
} from '~/components/SettingsList';

const SUPPORT_EMAIL = 'hello@usewaypoint.app';
const TERMS_URL = 'https://www.usewaypoint.app/terms';
const PRIVACY_URL = 'https://www.usewaypoint.app/privacy';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const [showFounderModal, setShowFounderModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            // Navigation will be handled by NavigationController
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.prompt(
              'Confirm Deletion',
              'Type "DELETE" to confirm account deletion',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Account',
                  style: 'destructive',
                  onPress: async (text) => {
                    if (text === 'DELETE') {
                      await performAccountDeletion();
                    } else {
                      Alert.alert('Error', 'Please type DELETE to confirm');
                    }
                  },
                },
              ],
              'plain-text'
            );
          },
        },
      ],
      { cancelable: true }
    );
  };

  const performAccountDeletion = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_user_account');
      if (error) throw error;

      await signOut();
      Alert.alert('Account Deleted', 'Your account has been successfully deleted.');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestorePurchases = async () => {
    if (restoring) return;
    if (!isRevenueCatConfigured()) {
      Alert.alert('Unavailable', 'Purchases are not available right now.');
      return;
    }
    setRestoring(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      const restored = Object.keys(customerInfo.entitlements.active).length > 0;
      Alert.alert(
        restored ? 'Purchases Restored' : 'Nothing to Restore',
        restored
          ? 'Your purchases have been restored to this account.'
          : 'No previous purchases were found for this Apple ID.'
      );
    } catch (error: any) {
      console.error('[Settings] restore failed:', error);
      Alert.alert('Restore Failed', error?.message ?? 'Please try again in a moment.');
    } finally {
      setRestoring(false);
    }
  };

  const handleLeaveReview = async () => {
    try {
      // Loaded lazily so a dev build whose binary predates expo-store-review
      // can't crash the whole Settings screen at import time — it just falls
      // through to the alert below until the next native rebuild.
      const StoreReview = await import('expo-store-review');
      if (await StoreReview.hasAction()) {
        await StoreReview.requestReview();
        return;
      }
    } catch (error) {
      console.warn('[Settings] store review unavailable:', error);
    }
    Alert.alert(
      'Thanks for the love!',
      'In-app reviews will be available in the next build of the app.'
    );
  };

  const handleReportIssue = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Issue Report`);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="arrow-back" size={26} color={settingsTheme.label} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Subscription" />
        <Card dividerInset={52}>
          <Row
            icon="refresh-outline"
            label="Restore Purchases"
            onPress={handleRestorePurchases}
            right={
              restoring ? <ActivityIndicator size="small" color={settingsTheme.accent} /> : undefined
            }
          />
          <Row
            icon="diamond"
            iconColor={settingsTheme.accent}
            label="Support Waypoint"
            onPress={() => setShowFounderModal(true)}
            right={
              <View style={styles.founderTag}>
                <Text style={styles.founderText}>Founder</Text>
                <Ionicons name="diamond" size={14} color={settingsTheme.accent} />
              </View>
            }
          />
        </Card>

        <SectionHeader title="Preferences" />
        <Card dividerInset={52}>
          <Row
            icon="lock-closed-outline"
            label="Privacy Settings"
            onPress={() => router.push('/settings/privacy')}
            right={<Chevron />}
          />
        </Card>

        <SectionHeader title="Support" />
        <Card dividerInset={52}>
          <Row icon="chatbox-ellipses-outline" label="Report an issue" onPress={handleReportIssue} />
          <Row icon="star-outline" label="Leave a review" onPress={handleLeaveReview} />
        </Card>

        <SectionHeader title="Legal" />
        <Card dividerInset={52}>
          <Row
            icon="people-outline"
            label="Community Guidelines"
            onPress={() => Linking.openURL(TERMS_URL)}
            right={<ExternalLinkIcon />}
          />
          <Row
            icon="document-text-outline"
            label="Terms and Conditions"
            onPress={() => Linking.openURL(TERMS_URL)}
            right={<ExternalLinkIcon />}
          />
          <Row
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => Linking.openURL(PRIVACY_URL)}
            right={<ExternalLinkIcon />}
          />
        </Card>

        <SectionHeader title="Account" />
        <Card dividerInset={52}>
          <Row icon="log-out-outline" label="Log Out" onPress={handleLogout} />
        </Card>

        <Card style={styles.destructiveCard}>
          <Row
            icon="trash-outline"
            label="Delete Account"
            destructive
            center
            onPress={handleDeleteAccount}
          />
        </Card>
      </ScrollView>

      {isDeleting && (
        <View style={styles.deletingOverlay}>
          <View style={styles.deletingCard}>
            <ActivityIndicator size="large" color={settingsTheme.destructive} />
            <Text style={styles.deletingText}>Deleting account...</Text>
          </View>
        </View>
      )}

      <UpsellModal
        visible={showFounderModal}
        onDismiss={() => setShowFounderModal(false)}
        mode="founder"
        offeringIdentifier="supporter"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: settingsTheme.background,
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
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: settingsTheme.label,
  },
  content: {
    paddingBottom: 48,
  },
  founderTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  founderText: {
    fontSize: 15,
    fontWeight: '700',
    color: settingsTheme.accent,
  },
  destructiveCard: {
    marginTop: 26,
  },
  deletingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deletingCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
  },
  deletingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
  },
});
