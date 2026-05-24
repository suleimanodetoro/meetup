// components/UpsellModal.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Purchases, {
  type PurchasesPackage,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import { isRevenueCatConfigured } from '~/lib/revenuecat';

interface UpsellModalProps {
  visible: boolean;
  onDismiss: () => void;
}

const ENTITLEMENT_ID = 'premium';

const BENEFITS = [
  'See every person in any city',
  'Send unlimited messages',
  'Priority visibility on your profile',
  'Access exclusive events',
];

function packageLabel(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case 'ANNUAL':
      return 'Yearly';
    case 'MONTHLY':
      return 'Monthly';
    case 'WEEKLY':
      return 'Weekly';
    case 'LIFETIME':
      return 'Lifetime';
    case 'TWO_MONTH':
      return '2 months';
    case 'THREE_MONTH':
      return '3 months';
    case 'SIX_MONTH':
      return '6 months';
    default:
      return pkg.product.title ?? 'Subscription';
  }
}

export default function UpsellModal({ visible, onDismiss }: UpsellModalProps) {
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch offerings only when the modal becomes visible. RC caches them
  // SDK-side so subsequent opens are instant; we don't need a global
  // pre-fetch.
  useEffect(() => {
    if (!visible) return;
    if (!isRevenueCatConfigured()) {
      setError('Subscriptions are not available in this build.');
      setPackages([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Purchases.getOfferings()
      .then((offerings) => {
        if (cancelled) return;
        const available = offerings.current?.availablePackages ?? [];
        setPackages(available);
        if (available.length === 0) {
          setError('No subscription options are available right now.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[UpsellModal] getOfferings failed:', err);
        setError('Could not load subscription options. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const purchasePackage = useCallback(
    async (pkg: PurchasesPackage) => {
      setPurchasingId(pkg.identifier);
      setError(null);
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        if (customerInfo.entitlements.active[ENTITLEMENT_ID]) {
          // Success. The RC -> Supabase webhook will update
          // user_subscriptions; useSubscription's realtime listener will
          // pick it up on the next tick and the paywall will unblur.
          onDismiss();
        } else {
          setError(
            'Purchase completed but the premium entitlement was not granted. Contact support.',
          );
        }
      } catch (err: any) {
        if (err?.userCancelled) {
          // silent — user backed out of Apple's purchase sheet
        } else if (err?.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
          // Family sharing / SCA — payment is in flight but not yet approved.
          Alert.alert(
            'Payment pending',
            'Your purchase is awaiting approval. You will get access once it is confirmed.',
          );
          onDismiss();
        } else {
          console.error('[UpsellModal] purchase failed:', err);
          setError(err?.message ?? 'Purchase failed. Please try again.');
        }
      } finally {
        setPurchasingId(null);
      }
    },
    [onDismiss],
  );

  const restorePurchases = useCallback(async () => {
    if (!isRevenueCatConfigured()) return;
    setRestoring(true);
    setError(null);
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (customerInfo.entitlements.active[ENTITLEMENT_ID]) {
        Alert.alert('Restored', 'Your subscription has been restored.');
        onDismiss();
      } else {
        Alert.alert(
          'Nothing to restore',
          'No active subscription was found for this Apple ID.',
        );
      }
    } catch (err: any) {
      console.error('[UpsellModal] restore failed:', err);
      setError(err?.message ?? 'Restore failed. Please try again.');
    } finally {
      setRestoring(false);
    }
  }, [onDismiss]);

  const anyPending = purchasingId !== null || restoring;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <LinearGradient colors={['#007AFF', '#667eea']} style={styles.container}>
        <SafeAreaView style={styles.content}>
          <Pressable onPress={onDismiss} style={styles.closeButton} disabled={anyPending}>
            <Ionicons name="close" size={28} color="white" />
          </Pressable>

          <View style={styles.main}>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-open" size={64} color="white" />
            </View>

            <Text style={styles.title}>Unlock All Profiles</Text>
            <Text style={styles.subtitle}>
              Connect with unlimited people and see who's visiting your destinations
            </Text>

            <View style={styles.benefits}>
              {BENEFITS.map((benefit) => (
                <View key={benefit} style={styles.benefit}>
                  <Ionicons name="checkmark-circle" size={22} color="#4CAF50" />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>

            {loading ? (
              <View style={styles.loaderRow}>
                <ActivityIndicator color="white" />
                <Text style={styles.loaderText}>Loading subscription options…</Text>
              </View>
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : (
              <View style={styles.packageList}>
                {packages.map((pkg) => {
                  const isPurchasingThis = purchasingId === pkg.identifier;
                  return (
                    <Pressable
                      key={pkg.identifier}
                      onPress={() => purchasePackage(pkg)}
                      disabled={anyPending}
                      style={[styles.packageButton, anyPending && styles.packageButtonDisabled]}
                    >
                      {isPurchasingThis ? (
                        <ActivityIndicator color="#007AFF" />
                      ) : (
                        <>
                          <Text style={styles.packageLabel}>{packageLabel(pkg)}</Text>
                          <Text style={styles.packagePrice}>
                            {pkg.product.priceString}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Pressable
              onPress={restorePurchases}
              disabled={anyPending}
              style={styles.restoreButton}
            >
              {restoring ? (
                <ActivityIndicator color="rgba(255,255,255,0.9)" />
              ) : (
                <Text style={styles.restoreText}>Restore Purchases</Text>
              )}
            </Pressable>

            <Pressable
              onPress={onDismiss}
              disabled={anyPending}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryText}>Maybe Later</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
    padding: 8,
  },
  main: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: { marginBottom: 24 },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 28,
  },
  benefits: { marginBottom: 28, alignSelf: 'stretch' },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 15,
    color: 'white',
    marginLeft: 10,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  loaderText: {
    color: 'white',
    fontSize: 14,
  },
  errorText: {
    color: '#FFE0E0',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  packageList: { alignSelf: 'stretch', gap: 12, marginBottom: 16 },
  packageButton: {
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  packageButtonDisabled: {
    opacity: 0.7,
  },
  packageLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  packagePrice: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
  },
  restoreButton: {
    paddingVertical: 12,
    minHeight: 40,
    justifyContent: 'center',
  },
  restoreText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textDecorationLine: 'underline',
  },
  secondaryButton: { paddingVertical: 12 },
  secondaryText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
});
