// lib/revenuecat.ts
//
// Thin wrapper around react-native-purchases so the rest of the app
// doesn't have to deal with platform key selection, idempotent config,
// or no-op fallback when API keys are missing in dev.
//
// Three functions:
//   - configureRevenueCat()        once at module load
//   - identifyRevenueCatUser(uid)  on auth sign-in
//   - signOutOfRevenueCat()        on auth sign-out
//
// Everything else (offerings, purchases, customerInfo) is read directly
// from Purchases at the call site. RC's own SDK surface is already well
// shaped; we don't need a deep abstraction over it.

import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

let configured = false;

function pickApiKey(): string | undefined {
  return Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;
}

/**
 * Configure the RC SDK once. Safe to call multiple times; subsequent
 * calls are no-ops. When the platform's API key isn't set we log a
 * warning and return — dev environments without an RC project shouldn't
 * crash the app, and the rest of the helpers will short-circuit.
 */
export function configureRevenueCat(): void {
  if (configured) return;
  const apiKey = pickApiKey();
  if (!apiKey) {
    if (__DEV__) {
      console.warn(
        `[revenuecat] EXPO_PUBLIC_REVENUECAT_${Platform.OS.toUpperCase()}_API_KEY is not set — SDK not configured. Paywall purchases will not work.`,
      );
    }
    return;
  }
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
  Purchases.configure({ apiKey });
  configured = true;
}

export function isRevenueCatConfigured(): boolean {
  return configured;
}

/**
 * Tie the RC anonymous user to our Supabase user UUID. Call after the
 * Supabase session is known so RC's customerInfo and webhook events
 * carry the right app_user_id.
 */
export async function identifyRevenueCatUser(userId: string): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logIn(userId);
  } catch (err) {
    console.error('[revenuecat] logIn failed:', err);
  }
}

/**
 * Detach the current Supabase user from RC. Without this, RC keeps the
 * previous user_id on the device and the next sign-in would silently
 * inherit their entitlements.
 */
export async function signOutOfRevenueCat(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch (err) {
    // logOut throws if the user is already anonymous — harmless, swallow.
    if (__DEV__) console.warn('[revenuecat] logOut warning:', err);
  }
}
