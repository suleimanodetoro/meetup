// app/settings.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/contexts/AuthProvider';
import UpsellModal from '~/components/UpsellModal';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const [hideNearbyDistance, setHideNearbyDistance] = useState(false);
  const [hideActiveStatus, setHideActiveStatus] = useState(false);
  const [unitOfMeasurement, setUnitOfMeasurement] = useState('km');
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showFounderModal, setShowFounderModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
            // Show confirmation with text input
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
      // Call Supabase function to delete user account
      const { error } = await supabase.rpc('delete_user_account');

      if (error) throw error;

      // Sign out after deletion
      await signOut();

      Alert.alert('Account Deleted', 'Your account has been successfully deleted.');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReportIssue = () => {
    // Open email client with pre-filled subject
    Linking.openURL('mailto:hello@usewaypoint.app?subject=Issue Report');
  };

  const handleLeaveReview = () => {
    // In production, this would open App Store/Play Store
    Alert.alert('Leave a Review', 'This would open the app store for review');
  };

  const handleRestorePurchases = () => {
    Alert.alert('Restore Purchases', 'No purchases to restore');
  };

  const handleCommunityGuidelines = () => {
    // In production, this would open a web view or external link
    Linking.openURL('https://www.usewaypoint.app/terms');
  };

  const handleTermsAndConditions = () => {
    // In production, this would open a web view or external link
    Linking.openURL('https://www.usewaypoint.app/terms');
  };

  const handlePrivacyPolicy = () => {
    // In production, this would open a web view or external link
    Linking.openURL('https://www.usewaypoint.app/privacy');
  };

  const SettingRow = ({
    label,
    onPress,
    rightElement,
    textColor = '#000',
    showBorder = true,
  }: {
    label: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    textColor?: string;
    showBorder?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 20,
        borderBottomWidth: showBorder ? 1 : 0,
        borderBottomColor: '#F0F0F0',
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <Text
          style={{
            fontSize: 18,
            color: textColor,
          }}>
          {label}
        </Text>
        {rightElement}
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#F0F0F0',
        }}>
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={28} color="#000" />
        </Pressable>
        <Text
          style={{
            fontSize: 24,
            fontWeight: '700',
            marginLeft: 20,
          }}>
          Settings
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: 20 }}>
          {/* Unit of measurement */}
          <SettingRow
            label="Unit of measurement"
            onPress={() => setShowUnitPicker(true)}
            rightElement={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 18, color: '#666' }}>{unitOfMeasurement}</Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </View>
            }
          />

          {/* Hide my nearby distance */}
          <SettingRow
            label="Hide my nearby distance"
            rightElement={
              <Switch
                value={hideNearbyDistance}
                onValueChange={setHideNearbyDistance}
                trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
                thumbColor="white"
              />
            }
          />

          {/* Hide active status */}
          <SettingRow
            label="Hide active status"
            rightElement={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    backgroundColor: '#E3F2FD',
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 12,
                  }}>
                  <Text style={{ fontSize: 14, color: '#007AFF', fontWeight: '600' }}>
                    Pro Feature
                  </Text>
                </View>
                <Switch
                  value={hideActiveStatus}
                  onValueChange={setHideActiveStatus}
                  trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
                  thumbColor="white"
                  disabled
                />
              </View>
            }
          />

          {/* Spacer */}
          <View style={{ height: 20 }} />
          {/* Privacy Settings */}
          <SettingRow label="Privacy Settings" onPress={() => router.push('/settings/privacy')} />

          {/* Report an issue */}
          <SettingRow label="Report an issue" onPress={handleReportIssue} showBorder={false} />

          {/* Leave a review */}
          <SettingRow label="Leave a review" onPress={handleLeaveReview} showBorder={false} />

          {/* Spacer */}
          <View style={{ height: 20 }} />

          {/* Restore Purchases */}
          <SettingRow
            label="Restore Purchases"
            onPress={handleRestorePurchases}
            showBorder={false}
          />

          <SettingRow
            label="Support Waypoint"
            onPress={() => setShowFounderModal(true)}
            rightElement={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 14, color: '#007AFF', fontWeight: '700' }}>Founder</Text>
                <Ionicons name="diamond" size={18} color="#007AFF" />
              </View>
            }
            showBorder={false}
          />

          {/* Spacer */}
          <View style={{ height: 30 }} />

          {/* Community Guidelines */}
          <SettingRow
            label="Community Guidelines"
            onPress={handleCommunityGuidelines}
            showBorder={false}
          />

          {/* Terms and Conditions */}
          <SettingRow
            label="Terms and Conditions"
            onPress={handleTermsAndConditions}
            showBorder={false}
          />

          {/* Privacy Policy */}
          <SettingRow label="Privacy Policy" onPress={handlePrivacyPolicy} showBorder={false} />

          {/* Spacer */}
          <View style={{ height: 30 }} />

          {/* Logout */}
          <SettingRow label="Logout" onPress={handleLogout} showBorder={false} />

          {/* Spacer */}
          <View style={{ height: 20 }} />

          {/* Delete Account */}
          <SettingRow
            label="Delete Account"
            onPress={handleDeleteAccount}
            textColor="#FF3B30"
            showBorder={false}
          />
        </View>
      </ScrollView>

      {/* Unit Picker Modal */}
      <Modal visible={showUnitPicker} transparent animationType="fade">
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setShowUnitPicker(false)}>
          <View
            style={{
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 20,
              width: '80%',
              maxWidth: 300,
            }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: '600',
                marginBottom: 20,
                textAlign: 'center',
              }}>
              Select Unit
            </Text>

            {['km', 'mi'].map((unit) => (
              <Pressable
                key={unit}
                onPress={() => {
                  setUnitOfMeasurement(unit);
                  setShowUnitPicker(false);
                }}
                style={{
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  backgroundColor: unitOfMeasurement === unit ? '#F0F7FF' : 'white',
                  borderRadius: 12,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: unitOfMeasurement === unit ? '#007AFF' : '#E0E0E0',
                }}>
                <Text
                  style={{
                    fontSize: 16,
                    color: unitOfMeasurement === unit ? '#007AFF' : '#000',
                    fontWeight: unitOfMeasurement === unit ? '600' : '400',
                    textAlign: 'center',
                  }}>
                  {unit === 'km' ? 'Kilometers (km)' : 'Miles (mi)'}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Loading overlay for account deletion */}
      {isDeleting && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <View
            style={{
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 30,
              alignItems: 'center',
            }}>
            <ActivityIndicator size="large" color="#FF3B30" />
            <Text
              style={{
                marginTop: 16,
                fontSize: 16,
                color: '#333',
              }}>
              Deleting account...
            </Text>
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
