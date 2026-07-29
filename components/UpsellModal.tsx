// components/UpsellModal.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';
import Purchases, {
  type PurchasesPackage,
  PURCHASES_ERROR_CODE,
  INTRO_ELIGIBILITY_STATUS,
} from 'react-native-purchases';
import { FounderBadge } from '~/components/FounderBadge';
import { GradientButton } from '~/components/GradientButton';
import { isRevenueCatConfigured } from '~/lib/revenuecat';
import { authColors, authSpace } from '~/utils/authTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAGE_WIDTH = SCREEN_WIDTH;
const PACKAGE_GAP = 10;
const TERMS_URL = 'https://www.usewaypoint.app/terms';
const PRIVACY_URL = 'https://www.usewaypoint.app/privacy';

interface UpsellModalProps {
  visible: boolean;
  onDismiss: () => void;
  mode?: 'premium' | 'founder';
  offeringIdentifier?: string;
}

const ENTITLEMENT_BY_MODE = {
  premium: 'premium',
  founder: 'founder',
} as const;

const PREMIUM_BENEFITS = [
  'See every person in any city',
  'Send unlimited messages',
  'Priority visibility on your profile',
  'Access full travel history',
];

const FOUNDER_BENEFITS = [
  'Lifetime Founder recognition on your profile',
  'Everything included in Premium',
  'Permanent supporter recognition as Waypoint grows',
  'Your support helps fund the first community',
];

const PAYWALL_PAGES = [
  {
    mode: 'premium' as const,
    title: 'more trips. more people.',
    eyebrow: 'Waypoint Premium',
    icon: 'sparkles' as const,
    subtitle: 'Unlock the full travel graph around every city you visit.',
    benefits: PREMIUM_BENEFITS,
    ctaIdle: 'continue with premium',
  },
  {
    mode: 'founder' as const,
    title: 'back what comes next.',
    eyebrow: 'Founder Supporter',
    icon: 'diamond' as const,
    subtitle: 'Get Premium plus profile-only Founder recognition.',
    benefits: FOUNDER_BENEFITS,
    ctaIdle: 'continue as founder',
  },
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

export default function UpsellModal({
  visible,
  onDismiss,
  mode = 'premium',
  offeringIdentifier: _offeringIdentifier,
}: UpsellModalProps) {
  const scrollRef = useRef<ScrollView>(null);
  const initialPage = mode === 'founder' ? 1 : 0;
  const [activePage, setActivePage] = useState(initialPage);
  const [packagesByMode, setPackagesByMode] = useState<
    Record<'premium' | 'founder', PurchasesPackage[]>
  >({
    premium: [],
    founder: [],
  });
  const [selectedPackageIdByMode, setSelectedPackageIdByMode] = useState<
    Record<'premium' | 'founder', string | null>
  >({
    premium: null,
    founder: null,
  });
  const [loading, setLoading] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-product-id trial eligibility. A product is present here with value
  // `false` ONLY when RevenueCat says the user is explicitly ineligible for the
  // intro offer (already used their trial). Absent / true → show the trial.
  // Fail open: if the check errors or returns UNKNOWN we still show the trial,
  // because hiding it from an eligible user costs a conversion and Apple
  // enforces real eligibility at purchase time anyway.
  const [trialEligible, setTrialEligible] = useState<Record<string, boolean>>({});
  const activeMode = PAYWALL_PAGES[activePage]?.mode ?? mode;
  const activePackages = packagesByMode[activeMode];
  const sortedActivePackages = useMemo(() => sortPackages(activePackages), [activePackages]);
  // Up to three packages render (weekly / monthly / yearly ladder), and at
  // most one carries the "best value" badge (the founder page lists both
  // Yearly and Lifetime, which previously both qualified — see
  // bestValuePackageId).
  const shownPackages = useMemo(() => sortedActivePackages.slice(0, 3), [sortedActivePackages]);
  const bestValueId = useMemo(() => bestValuePackageId(shownPackages), [shownPackages]);
  const selectedPackage =
    sortedActivePackages.find((pkg) => pkg.identifier === selectedPackageIdByMode[activeMode]) ??
    sortedActivePackages[0] ??
    null;
  const entitlementId = ENTITLEMENT_BY_MODE[activeMode];

  // Trial label for a package, but only if the user is actually eligible.
  // Returns null when the product has no free trial OR RevenueCat has told us
  // this user already consumed theirs — so the "start free trial" CTA/badge
  // never shows to someone Apple would immediately charge.
  const trialLabelFor = useCallback(
    (pkg: PurchasesPackage): string | null => {
      const label = freeTrialLabel(pkg);
      if (!label) return null;
      if (trialEligible[pkg.product.identifier] === false) return null;
      return label;
    },
    [trialEligible]
  );

  // Fetch offerings only when the modal becomes visible. RC caches them
  // SDK-side so subsequent opens are instant; we don't need a global
  // pre-fetch.
  useEffect(() => {
    if (!visible) return;
    setActivePage(initialPage);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: initialPage * PAGE_WIDTH, animated: false });
    });
    if (!isRevenueCatConfigured()) {
      setError('Subscriptions are not available in this build.');
      setPackagesByMode({ premium: [], founder: [] });
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTrialEligible({});
    Purchases.getOfferings()
      .then((offerings) => {
        if (cancelled) return;
        const premiumPackages = offerings.current?.availablePackages ?? [];
        const founderPackages = offerings.all.supporter?.availablePackages ?? [];

        setPackagesByMode({
          premium: premiumPackages,
          founder: founderPackages,
        });
        const sortedPremium = sortPackages(premiumPackages);
        const sortedFounder = sortPackages(founderPackages);

        setSelectedPackageIdByMode({
          premium: sortedPremium[0]?.identifier ?? null,
          founder: sortedFounder[0]?.identifier ?? null,
        });

        if (premiumPackages.length === 0 && founderPackages.length === 0) {
          setError('No purchase options are available right now.');
        }

        // Check intro-offer eligibility for every product that actually
        // carries a free trial, so ineligible users don't see trial wording.
        // Non-blocking and fail-open — a failure just leaves the trial shown.
        const trialProductIds = [...premiumPackages, ...founderPackages]
          .filter((pkg) => freeTrialLabel(pkg) !== null)
          .map((pkg) => pkg.product.identifier);
        if (trialProductIds.length > 0) {
          Purchases.checkTrialOrIntroductoryPriceEligibility(trialProductIds)
            .then((result) => {
              if (cancelled) return;
              const next: Record<string, boolean> = {};
              for (const [productId, eligibility] of Object.entries(result)) {
                next[productId] =
                  eligibility.status !==
                  INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE;
              }
              setTrialEligible(next);
            })
            .catch((err) => {
              console.warn('[UpsellModal] trial eligibility check failed:', err);
            });
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
  }, [visible, initialPage]);

  const purchasePackage = useCallback(
    async (pkg: PurchasesPackage) => {
      setPurchasingId(pkg.identifier);
      setError(null);
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        if (customerInfo.entitlements.active[entitlementId]) {
          // Success. The RC -> Supabase webhook will update
          // user_subscriptions; useSubscription's realtime listener will
          // pick it up on the next tick and the paywall will unblur.
          onDismiss();
        } else {
          setError(
            `Purchase completed but the ${entitlementId} entitlement was not granted. Contact support.`
          );
        }
      } catch (err: any) {
        const isCancel =
          err?.userCancelled || err?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
        if (isCancel) {
          // Silent. Covers both Apple's "Cancel" button and tap-outside /
          // backgrounding the purchase sheet, which different RC SDK
          // versions raise via different paths.
        } else if (err?.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
          // Family sharing / SCA — payment is in flight but not yet approved.
          Alert.alert(
            'Payment pending',
            'Your purchase is awaiting approval. You will get access once it is confirmed.'
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
    [entitlementId, onDismiss]
  );

  const restorePurchases = useCallback(async () => {
    if (!isRevenueCatConfigured()) return;
    setRestoring(true);
    setError(null);
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (customerInfo.entitlements.active[entitlementId]) {
        Alert.alert(
          'Restored',
          activeMode === 'founder'
            ? 'Your Founder purchase has been restored.'
            : 'Your subscription has been restored.'
        );
        onDismiss();
      } else {
        Alert.alert(
          'Nothing to restore',
          activeMode === 'founder'
            ? 'No Founder purchase was found for this Apple ID.'
            : 'No active subscription was found for this Apple ID.'
        );
      }
    } catch (err: any) {
      console.error('[UpsellModal] restore failed:', err);
      setError(err?.message ?? 'Restore failed. Please try again.');
    } finally {
      setRestoring(false);
    }
  }, [activeMode, entitlementId, onDismiss]);

  const anyPending = purchasingId !== null || restoring;
  const isPurchasingSelected = !!selectedPackage && purchasingId === selectedPackage.identifier;
  const activePageConfig = PAYWALL_PAGES[activePage] ?? PAYWALL_PAGES[initialPage];
  const selectedTrial = selectedPackage ? trialLabelFor(selectedPackage) : null;

  const onMomentumEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextPage = Math.round(event.nativeEvent.contentOffset.x / PAGE_WIDTH);
    setActivePage(Math.max(0, Math.min(PAYWALL_PAGES.length - 1, nextPage)));
  }, []);

  const legalPrefix = useMemo(() => {
    if (activeMode === 'founder') {
      return 'Founder purchases are optional. Annual renews unless cancelled in App Store settings. Founder Forever is a one-time purchase. By continuing, you agree to our ';
    }
    if (selectedTrial && selectedPackage) {
      // Apple requires trial terms (length, post-trial price, auto-renewal)
      // to be stated where the trial is offered.
      return `Free for ${selectedTrial.replace('-', ' ')}, then ${selectedPackage.product.priceString} per ${periodNoun(selectedPackage)}. Renews automatically unless cancelled in App Store settings at least 24 hours before the trial ends. By continuing, you agree to our `;
    }
    return 'By continuing, your subscription renews unless cancelled in App Store settings. You agree to our ';
  }, [activeMode, selectedTrial, selectedPackage]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brand}>waypoint plus</Text>
          <Pressable onPress={onDismiss} style={styles.closeButton} disabled={anyPending}>
            <Ionicons name="close" size={26} color={authColors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          scrollEnabled={!anyPending}>
          {PAYWALL_PAGES.map((page) => (
            <PaywallPage key={page.mode} page={page} />
          ))}
        </ScrollView>

        <View style={styles.pageDots}>
          {PAYWALL_PAGES.map((page, index) => (
            <View key={page.mode} style={[styles.dot, activePage === index && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.bottomPanel}>
          {loading ? (
            <View style={styles.loaderRow}>
              <ActivityIndicator color={authColors.accent} />
              <Text style={styles.loaderText}>Loading purchase options...</Text>
            </View>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <>
              <View style={styles.packageGrid}>
                {shownPackages.map((pkg) => {
                  const selected = selectedPackage?.identifier === pkg.identifier;
                  const trial = trialLabelFor(pkg);
                  const badge =
                    pkg.identifier === bestValueId ? 'best value' : trial ? 'free trial' : undefined;
                  return (
                    <PackageCard
                      key={pkg.identifier}
                      pkg={pkg}
                      selected={selected}
                      label={packageLabel(pkg)}
                      badge={badge}
                      badgeTone={badge === 'best value' ? 'dark' : 'accent'}
                      subprice={packageSubprice(pkg, trial)}
                      disabled={anyPending}
                      onPress={() =>
                        setSelectedPackageIdByMode((current) => ({
                          ...current,
                          [activeMode]: pkg.identifier,
                        }))
                      }
                    />
                  );
                })}
              </View>
              <GradientButton
                label={
                  selectedPackage
                    ? selectedTrial
                      ? `start ${selectedTrial} free trial`
                      : `${activePageConfig.ctaIdle} - ${selectedPackage.product.priceString}`
                    : 'purchase unavailable'
                }
                onPress={() => selectedPackage && purchasePackage(selectedPackage)}
                disabled={anyPending || !selectedPackage}
                loading={isPurchasingSelected}
              />
            </>
          )}

          <Pressable onPress={restorePurchases} disabled={anyPending} style={styles.restoreButton}>
            {loading ? null : restoring ? (
              <ActivityIndicator color={authColors.textSecondary} />
            ) : (
              <Text style={styles.restoreText}>restore purchases</Text>
            )}
          </Pressable>
          <Text style={styles.legal}>
            {legalPrefix}
            <Text
              style={styles.legalLink}
              accessibilityRole="link"
              onPress={() => Linking.openURL(TERMS_URL)}>
              Terms
            </Text>
            {' and '}
            <Text
              style={styles.legalLink}
              accessibilityRole="link"
              onPress={() => Linking.openURL(PRIVACY_URL)}>
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function sortPackages(packages: PurchasesPackage[]) {
  return [...packages].sort((a, b) => packageRank(a) - packageRank(b));
}

// Display order = ascending commitment (weekly → monthly → yearly →
// lifetime). sorted[0] doubles as the pre-selected default, so weekly is the
// hero on the premium page while the founder page (annual + lifetime) still
// defaults to annual.
function packageRank(pkg: PurchasesPackage) {
  switch (pkg.packageType) {
    case 'WEEKLY':
      return 0;
    case 'MONTHLY':
      return 1;
    case 'ANNUAL':
      return 2;
    case 'LIFETIME':
      return 3;
    default:
      return 4;
  }
}

/** Billing period noun for legal copy ("week" / "month" / "year"). */
function periodNoun(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case 'WEEKLY':
      return 'week';
    case 'MONTHLY':
      return 'month';
    case 'ANNUAL':
      return 'year';
    default:
      return 'period';
  }
}

/**
 * "3-day" / "1-week" style label when the package carries a FREE intro offer
 * (price 0). Paid intro offers (pay-as-you-go discounts) return null — we
 * don't sell those, and rendering them as "free" would be an App Review
 * rejection.
 */
function freeTrialLabel(pkg: PurchasesPackage): string | null {
  const intro = pkg.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const unit = intro.periodUnit?.toLowerCase() ?? 'day';
  // Hyphenated compound adjectives stay singular: "3-day", "1-week".
  return `${intro.periodNumberOfUnits}-${unit}`;
}

// The single best-value package among those rendered. A one-time Lifetime (e.g.
// Founder Forever) is the headline value and wins outright; otherwise the annual
// plan is the best value versus monthly. Returns at most one id so the "best
// value" badge is never shown on two cards at once.
function bestValuePackageId(packages: PurchasesPackage[]): string | null {
  const lifetime = packages.find((pkg) => pkg.packageType === 'LIFETIME');
  if (lifetime) return lifetime.identifier;
  const annual = packages.find((pkg) => pkg.packageType === 'ANNUAL');
  return annual?.identifier ?? null;
}

// `trialLabel` is the eligibility-resolved trial (null if none or the user is
// ineligible) — passed in so the subprice line matches the badge/CTA exactly.
function packageSubprice(pkg: PurchasesPackage, trialLabel: string | null) {
  if (pkg.packageType === 'WEEKLY') {
    return trialLabel
      ? `${trialLabel} free, then ${pkg.product.priceString}/wk`
      : `${pkg.product.priceString}/wk, billed weekly`;
  }
  if (pkg.packageType === 'ANNUAL') {
    return `${formatPriceLike(pkg.product.price / 12, pkg.product.priceString)}/mo, billed annually`;
  }
  if (pkg.packageType === 'MONTHLY') {
    return `${pkg.product.priceString}/mo, billed monthly`;
  }
  if (pkg.packageType === 'LIFETIME') {
    return 'one-time purchase';
  }
  return pkg.product.description || pkg.product.title;
}

function formatPriceLike(amount: number, priceString: string) {
  const currencyPrefix = priceString.match(/^[^\d.,]+/)?.[0] ?? '';
  return `${currencyPrefix}${amount.toFixed(2)}`;
}

function PaywallPage({ page }: { page: (typeof PAYWALL_PAGES)[number] }) {
  const isFounder = page.mode === 'founder';

  return (
    <View style={styles.page}>
      <View style={styles.heroArt}>
        <View style={[styles.heroBlob, isFounder && styles.heroBlobFounder]}>
          <Ionicons name={page.icon} size={74} color={authColors.textPrimary} />
        </View>
        <View style={[styles.orb, styles.orbTop]}>
          <Ionicons name="airplane" size={24} color={authColors.textPrimary} />
        </View>
        <View style={[styles.orb, styles.orbLeft]}>
          <Ionicons name="people" size={22} color={authColors.textPrimary} />
        </View>
        <View style={[styles.orb, styles.orbRight]}>
          {isFounder ? (
            <FounderBadge size={22} />
          ) : (
            <SpeechBubbleIcon size={28} color={authColors.textPrimary} />
          )}
        </View>
      </View>

      <Text style={styles.eyebrow}>{page.eyebrow}</Text>
      <Text style={styles.title}>{page.title}</Text>
      <Text style={styles.subtitle}>{page.subtitle}</Text>

      <ScrollView
        style={styles.benefitScroll}
        contentContainerStyle={styles.benefits}
        showsVerticalScrollIndicator={false}>
        {page.benefits.map((benefit) => (
          <View key={benefit} style={styles.benefit}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.benefitText}>{benefit}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function SpeechBubbleIcon({ size = 24, color = '#000000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5.25 5.75C5.25 4.65 6.15 3.75 7.25 3.75H16.75C17.85 3.75 18.75 4.65 18.75 5.75V12.5C18.75 13.6 17.85 14.5 16.75 14.5H11.1L7.1 18.05C6.74 18.37 6.17 18.11 6.17 17.63V14.42C5.24 14.24 4.55 13.42 4.55 12.45V5.75H5.25Z"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="9" cy="9.25" r="0.85" fill={color} />
      <Circle cx="12" cy="9.25" r="0.85" fill={color} />
      <Circle cx="15" cy="9.25" r="0.85" fill={color} />
    </Svg>
  );
}

function PackageCard({
  pkg,
  label,
  badge,
  badgeTone = 'dark',
  subprice,
  selected,
  disabled,
  onPress,
}: {
  pkg: PurchasesPackage;
  label: string;
  badge?: string;
  badgeTone?: 'dark' | 'accent';
  subprice?: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.packageCard, selected && styles.packageCardSelected]}>
      {badge ? (
        <View style={[styles.packageBadge, badgeTone === 'accent' && styles.packageBadgeAccent]}>
          <Text style={styles.packageBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <View style={styles.packageTopRow}>
        <Text style={styles.packageLabel} numberOfLines={1}>
          {label.toLowerCase()}
        </Text>
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : null}
        </View>
      </View>
      <Text style={styles.packagePrice}>{pkg.product.priceString}</Text>
      <Text style={styles.packageMeta}>{subprice}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: authColors.bg,
  },
  header: {
    height: 56,
    paddingHorizontal: authSpace.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: authColors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.2,
    textTransform: 'lowercase',
  },
  closeButton: {
    position: 'absolute',
    right: authSpace.lg,
    zIndex: 1,
    padding: 8,
  },
  page: {
    width: PAGE_WIDTH,
    paddingHorizontal: authSpace.xl,
    alignItems: 'center',
  },
  heroArt: {
    width: 176,
    height: 176,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: authSpace.md,
    marginBottom: authSpace.md,
  },
  heroBlob: {
    width: 126,
    height: 126,
    borderRadius: 44,
    backgroundColor: authColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '10deg' }],
    shadowColor: authColors.accent,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 8,
  },
  heroBlobFounder: {
    backgroundColor: '#DCE9FF',
    shadowColor: authColors.accent,
  },
  orb: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: authColors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: authColors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  orbTop: {
    top: 14,
    right: 34,
  },
  orbLeft: {
    bottom: 40,
    left: 14,
  },
  orbRight: {
    bottom: 30,
    right: 10,
  },
  eyebrow: {
    color: authColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    textTransform: 'lowercase',
    marginBottom: authSpace.sm,
  },
  title: {
    color: authColors.textPrimary,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
    textAlign: 'center',
    textTransform: 'lowercase',
  },
  subtitle: {
    color: authColors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: authSpace.sm,
    marginBottom: authSpace.md,
  },
  benefitScroll: {
    alignSelf: 'stretch',
    maxHeight: 118,
  },
  benefits: {
    alignSelf: 'stretch',
    gap: authSpace.sm,
    paddingBottom: authSpace.md,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  check: {
    width: 24,
    color: authColors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: authColors.textPrimary,
    marginLeft: 10,
    fontWeight: '700',
  },
  pageDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: authSpace.sm,
    marginBottom: authSpace.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: authColors.borderSubtle,
  },
  dotActive: {
    width: 18,
    backgroundColor: authColors.accent,
  },
  bottomPanel: {
    paddingHorizontal: authSpace.lg,
    paddingTop: authSpace.md,
    paddingBottom: authSpace.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: authSpace.sm,
    minHeight: 128,
  },
  loaderText: {
    color: authColors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: authColors.error,
    fontSize: 14,
    textAlign: 'center',
    minHeight: 128,
    paddingHorizontal: 16,
  },
  packageGrid: {
    flexDirection: 'row',
    gap: PACKAGE_GAP,
    paddingTop: 14,
    paddingBottom: authSpace.lg,
  },
  packageCard: {
    flex: 1,
    minHeight: 124,
    borderRadius: 16,
    backgroundColor: authColors.surface,
    borderWidth: 2,
    borderColor: authColors.borderSubtle,
    paddingVertical: authSpace.lg,
    paddingHorizontal: authSpace.md,
    justifyContent: 'space-between',
  },
  packageCardSelected: {
    borderColor: authColors.accent,
  },
  packageBadge: {
    position: 'absolute',
    top: -12,
    left: 10,
    borderRadius: 6,
    paddingHorizontal: authSpace.sm,
    paddingVertical: 4,
    backgroundColor: authColors.textPrimary,
  },
  packageBadgeAccent: {
    backgroundColor: authColors.accent,
  },
  packageBadgeText: {
    color: authColors.ctaPrimaryText,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '800',
    textTransform: 'lowercase',
  },
  packageTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: authSpace.xs,
  },
  radio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CFC8B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: authColors.textPrimary,
    backgroundColor: authColors.textPrimary,
  },
  ctaButton: {
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: authColors.accent,
    overflow: 'hidden',
    shadowColor: authColors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 4,
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    color: authColors.ctaPrimaryText,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    textTransform: 'lowercase',
  },
  ctaSheen: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packageLabel: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    color: authColors.textPrimary,
    textTransform: 'lowercase',
  },
  packagePrice: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
    color: authColors.textPrimary,
    marginTop: authSpace.md,
  },
  packageMeta: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    color: authColors.textSecondary,
    marginTop: 2,
  },
  restoreButton: {
    paddingTop: authSpace.md,
    paddingBottom: authSpace.xs,
    minHeight: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restoreText: {
    fontSize: 14,
    color: authColors.textPrimary,
    fontWeight: '800',
    textTransform: 'lowercase',
  },
  legal: {
    color: authColors.textDisclaimer,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    paddingHorizontal: authSpace.sm,
  },
  legalLink: {
    color: authColors.accent,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
