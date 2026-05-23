import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '~/app/contexts/AuthProvider';
import { OnboardingFrame } from './OnboardingFrame';
import {
  FIRST_STEP_SLUG,
  ONBOARDING_SEQUENCE,
  STEP_INDEX,
} from './sequence';
import { commitStep, loadProfile } from './persist';
import { isCustomStep, type ProfileRow } from './types';

/**
 * The dynamic-route screen rendered at /(auth)/onboarding/[step]. Reads
 * the slug from the URL, loads the persisted profile row, manages the
 * current step's local slot value, runs commit on Continue, advances to
 * the next step (or completes onboarding on the terminal step).
 *
 * Resume-on-reopen: if the URL slug points to a step earlier than the
 * user's persisted onboarding_step, the component leaves them where the
 * URL says — they explicitly navigated there. If it points beyond, we
 * redirect to the persisted position so they can't skip ahead.
 */
export function OnboardingStep() {
  const { step: slug } = useLocalSearchParams<{ step: string }>();
  const { session, refreshOnboardingStatus } = useAuth();
  const userId = session?.user?.id;

  const [profile, setProfile] = useState<Partial<ProfileRow> | null>(null);
  const [slotValue, setSlotValue] = useState<unknown>(undefined);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const stepIndex = slug ? STEP_INDEX[slug] : undefined;
  const step = stepIndex !== undefined ? ONBOARDING_SEQUENCE[stepIndex] : undefined;

  const redirectedRef = useRef(false);

  // Load profile + initialise slot value when slug changes
  useEffect(() => {
    if (!userId || !step) return;
    let cancelled = false;
    setProfile(null);
    setSlotValue(undefined);
    setLoadError(null);
    redirectedRef.current = false;

    (async () => {
      try {
        const row = await loadProfile(userId);
        if (cancelled) return;

        // Redirect-forward guard: if the URL is past where the user has
        // persisted progress, send them to the persisted position.
        const persistedStep =
          typeof row.onboarding_step === 'number' ? row.onboarding_step : 0;
        if (stepIndex !== undefined && stepIndex > persistedStep && !redirectedRef.current) {
          redirectedRef.current = true;
          const targetSlug =
            ONBOARDING_SEQUENCE[persistedStep]?.slug ?? FIRST_STEP_SLUG;
          if (targetSlug !== slug) {
            router.replace(`/onboarding/${targetSlug}` as never);
            return;
          }
        }

        setProfile(row);
        setSlotValue(step.read?.(row));
      } catch (err) {
        if (!cancelled) {
          console.error('Onboarding load error:', err);
          setLoadError('Failed to load your profile. Pull to retry.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, slug, step, stepIndex]);

  const handleContinue = useCallback(async () => {
    if (!step || !userId || stepIndex === undefined) return;
    if (step.isValid && !step.isValid(slotValue)) return;
    setBusy(true);
    try {
      const patch = (await step.commit?.(slotValue, { userId, skipped: false })) ?? {};
      await commitStep(userId, stepIndex, ONBOARDING_SEQUENCE.length, patch);
      if (stepIndex === ONBOARDING_SEQUENCE.length - 1) {
        // Terminal step: AuthProvider's onAuthStateChange + checkOnboardingStatus
        // is the route the auth controller listens on; refreshOnboardingStatus
        // pulls the new `onboarding_completed: true` and the root NavigationController
        // sends the user to /(tabs).
        await refreshOnboardingStatus();
      } else {
        const nextSlug = ONBOARDING_SEQUENCE[stepIndex + 1].slug;
        router.push(`/onboarding/${nextSlug}` as never);
      }
    } catch (err) {
      console.error('Step commit failed:', err);
      const msg =
        err instanceof Error ? err.message : 'Something went wrong. Try again.';
      Alert.alert("Couldn't save", msg);
    } finally {
      setBusy(false);
    }
  }, [step, stepIndex, slotValue, userId, refreshOnboardingStatus]);

  const handleSkip = useCallback(async () => {
    if (!step || !userId || stepIndex === undefined) return;
    setBusy(true);
    try {
      const patch = (await step.commit?.(undefined, { userId, skipped: true })) ?? {};
      await commitStep(userId, stepIndex, ONBOARDING_SEQUENCE.length, patch);
      if (stepIndex === ONBOARDING_SEQUENCE.length - 1) {
        await refreshOnboardingStatus();
      } else {
        const nextSlug = ONBOARDING_SEQUENCE[stepIndex + 1].slug;
        router.push(`/onboarding/${nextSlug}` as never);
      }
    } catch (err) {
      console.error('Step skip failed:', err);
    } finally {
      setBusy(false);
    }
  }, [step, stepIndex, userId, refreshOnboardingStatus]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
  }, []);

  // ----- Render guards -----

  if (!step || stepIndex === undefined) {
    // Unknown slug: redirect to wherever the user actually is.
    if (userId && !redirectedRef.current) {
      redirectedRef.current = true;
      router.replace(`/onboarding/${FIRST_STEP_SLUG}` as never);
    }
    return null;
  }

  if (!profile || !userId) {
    return (
      <OnboardingFrame title={step.title} subtitle={step.subtitle}>
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          {loadError ? null : <ActivityIndicator size="large" color="#007AFF" />}
        </View>
      </OnboardingFrame>
    );
  }

  // Custom takeover (e.g. trips). Owns its own chrome via `advance`/`goBack`.
  if (isCustomStep(step)) {
    const Custom = step.custom;
    return (
      <Custom
        step={step}
        draft={profile}
        userId={userId}
        advance={async (patch) => {
          try {
            await commitStep(
              userId,
              stepIndex,
              ONBOARDING_SEQUENCE.length,
              patch ?? {},
            );
            if (stepIndex === ONBOARDING_SEQUENCE.length - 1) {
              await refreshOnboardingStatus();
            } else {
              const nextSlug = ONBOARDING_SEQUENCE[stepIndex + 1].slug;
              router.push(`/onboarding/${nextSlug}` as never);
            }
          } catch (err) {
            console.error('Custom step advance failed:', err);
            const msg =
              err instanceof Error
                ? err.message
                : 'Something went wrong. Try again.';
            Alert.alert("Couldn't save", msg);
          }
        }}
        goBack={handleBack}
      />
    );
  }

  const Body = step.Body!;
  const continueLabel =
    step.slug === 'notifications' && !busy ? 'Enable Notifications' : 'Continue';
  const canContinue = step.isValid ? step.isValid(slotValue) : true;

  return (
    <OnboardingFrame
      title={step.title}
      subtitle={step.subtitle}
      onBack={handleBack}
      onSkip={step.skippable ? handleSkip : undefined}
      onContinue={handleContinue}
      canContinue={canContinue}
      busy={busy}
      continueLabel={continueLabel}
    >
      <Body
        value={slotValue}
        setValue={(next: unknown) => setSlotValue(next)}
        draft={profile}
      />
    </OnboardingFrame>
  );
}
