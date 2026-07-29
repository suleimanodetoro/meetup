// components/RedeemCodeSheet.tsx
// Flowing bottom sheet for redeeming a Waypoint promo / invite code
// (redeem_promo_code RPC). Used from Settings ("Redeem Code" row) and the
// final onboarding step ("Have an invite code?"). Hosted inside a transparent
// Modal so it can be summoned from anywhere in the tree without caring about
// screen nesting; the sheet itself stays a @gorhom flowing sheet.
//
// On success the RPC has already written user_subscriptions; useSubscription's
// realtime listener picks the row up on its own — callers don't need to do
// anything beyond closing the sheet.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { supabase } from '~/utils/supabase';
import { GradientButton } from '~/components/GradientButton';
import { authColors, authRadius, authSpace } from '~/utils/authTheme';

interface RedeemCodeSheetProps {
  visible: boolean;
  onClose: () => void;
}

const REASON_MESSAGES: Record<string, string> = {
  invalid: "That code doesn't look right — double-check it and try again.",
  expired: 'This code is no longer redeemable.',
  exhausted: 'This code has reached its redemption limit.',
  already_redeemed: "You've already used this code.",
  already_subscribed: 'You already have an active subscription — nothing to redeem.',
};

// Codes are 4–32 chars (see the promo_codes.code CHECK constraint); don't let
// obviously-too-short input hit the server.
const MIN_CODE_LENGTH = 4;

export function RedeemCodeSheet({ visible, onClose }: RedeemCodeSheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  // Fixed height — dynamic sizing is deliberately OFF. With dynamic sizing,
  // showing/hiding the error line resizes the sheet mid-keyboard, and gorhom
  // can treat the shrink as a dismissal (the sheet auto-closed on the first
  // keystroke after an error). Nothing inside may change the content height:
  // the error line renders into a fixed-height slot.
  const snapPoints = useMemo(() => [400], []);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grantedUntil, setGrantedUntil] = useState<string | null>(null);

  // Fresh sheet every time it's summoned.
  useEffect(() => {
    if (visible) {
      setCode('');
      setError(null);
      setGrantedUntil(null);
      setLoading(false);
    }
  }, [visible]);

  const redeem = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      // Cast: redeem_promo_code isn't in the generated DB types yet (same
      // idiom as suggest_quest in create-plan/intent.tsx).
      const { data, error: rpcError } = await (supabase.rpc as any)('redeem_promo_code', {
        p_code: trimmed,
      });
      if (rpcError) throw rpcError;
      const result = data as { ok: boolean; reason?: string; expires_at?: string };
      if (result?.ok) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setGrantedUntil(result.expires_at ?? null);
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(REASON_MESSAGES[result?.reason ?? ''] ?? 'Something went wrong. Try again.');
      }
    } catch (e) {
      console.warn('redeem_promo_code failed:', e);
      setError("Couldn't reach Waypoint right now. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    []
  );

  if (!visible) return null;

  const untilLabel = grantedUntil
    ? new Date(grantedUntil).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.host}>
        <BottomSheet
          ref={sheetRef}
          index={0}
          snapPoints={snapPoints}
          enableDynamicSizing={false}
          enablePanDownToClose
          onClose={onClose}
          backdropComponent={renderBackdrop}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
          handleIndicatorStyle={styles.handle}
          backgroundStyle={styles.sheetBg}>
          <BottomSheetView style={styles.content}>
            {grantedUntil ? (
              <>
                <View style={styles.successBadge}>
                  <Ionicons name="checkmark" size={34} color="#fff" />
                </View>
                <Text style={styles.title}>Code redeemed!</Text>
                <Text style={styles.subtitle}>
                  You have full Waypoint access{untilLabel ? ` until ${untilLabel}` : ''}. Enjoy —
                  and thanks for supporting Waypoint.
                </Text>
                <GradientButton
                  label="Done"
                  onPress={() => sheetRef.current?.close()}
                  style={styles.cta}
                />
              </>
            ) : (
              <>
                <Text style={styles.title}>Redeem a code</Text>
                <Text style={styles.subtitle}>
                  Got an invite or promo code? Enter it below to unlock Waypoint.
                </Text>
                <BottomSheetTextInput
                  value={code}
                  onChangeText={(t) => {
                    setCode(t.toUpperCase());
                    if (error) setError(null);
                  }}
                  placeholder="ENTER CODE"
                  placeholderTextColor={authColors.placeholder}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoComplete="off"
                  autoFocus
                  maxLength={32}
                  returnKeyType="go"
                  onSubmitEditing={redeem}
                  editable={!loading}
                  style={[styles.input, error != null && styles.inputError]}
                />
                {/* Fixed-height slot — the sheet must never resize (see
                    snapPoints comment). */}
                <View style={styles.errorSlot}>
                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                </View>
                <GradientButton
                  label="Redeem"
                  onPress={redeem}
                  loading={loading}
                  disabled={code.trim().length < MIN_CODE_LENGTH}
                  style={styles.cta}
                />
                <Pressable
                  onPress={() => sheetRef.current?.close()}
                  disabled={loading}
                  style={styles.cancelButton}
                  hitSlop={8}>
                  {loading ? (
                    <ActivityIndicator size="small" color={authColors.textTertiary} />
                  ) : (
                    <Text style={styles.cancelText}>Cancel</Text>
                  )}
                </Pressable>
              </>
            )}
          </BottomSheetView>
        </BottomSheet>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  sheetBg: { backgroundColor: authColors.bg, borderRadius: 28 },
  handle: { backgroundColor: authColors.borderSubtle, width: 44 },
  content: {
    paddingHorizontal: authSpace.xl,
    paddingTop: authSpace.sm,
    paddingBottom: authSpace.xxxl,
    alignItems: 'center',
  },
  successBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: authColors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: authSpace.lg,
    shadowColor: authColors.success,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: authColors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: authColors.textSecondary,
    textAlign: 'center',
    marginTop: authSpace.sm,
    marginBottom: authSpace.xl,
  },
  input: {
    alignSelf: 'stretch',
    borderWidth: 1.5,
    borderColor: authColors.inputBorder,
    borderRadius: authRadius.input,
    backgroundColor: authColors.inputBg,
    paddingVertical: 14,
    paddingHorizontal: authSpace.lg,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    color: authColors.textPrimary,
  },
  inputError: { borderColor: authColors.inputBorderError },
  errorSlot: {
    alignSelf: 'stretch',
    height: 44,
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    color: authColors.error,
    textAlign: 'center',
  },
  cta: { alignSelf: 'stretch' },
  cancelButton: {
    marginTop: authSpace.md,
    paddingVertical: authSpace.sm,
    minHeight: 32,
    justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: authColors.textTertiary },
});
