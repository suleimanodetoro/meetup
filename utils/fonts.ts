// utils/fonts.ts
// Typography system.
//   • Plus Jakarta Sans  — the app-wide default for all body / UI text.
//   • Space Grotesk      — expressive display face for big headings, logo text,
//                          onboarding titles, and empty states (opt-in only).
//
// applyGlobalFont() makes Plus Jakarta Sans the default for every <Text> /
// <TextInput> by mapping the style's fontWeight to the matching static weight
// file. Any style that sets `fontFamily` explicitly — icon fonts, or a Space
// Grotesk heading via displayFont() — is left untouched.
import React from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';

// Passed to useFonts() at the app root.
export const FONTS_TO_LOAD = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
};

/** Plus Jakarta Sans family for a given fontWeight (the default body face). */
export function jakarta(weight?: string | number): string {
  switch (String(weight)) {
    case '500':
      return 'PlusJakartaSans_500Medium';
    case '600':
      return 'PlusJakartaSans_600SemiBold';
    case '700':
    case 'bold':
      return 'PlusJakartaSans_700Bold';
    case '800':
    case '900':
      return 'PlusJakartaSans_800ExtraBold';
    default:
      return 'PlusJakartaSans_400Regular';
  }
}

/** Space Grotesk family for a given weight (expressive display headings). */
export function display(weight: '500' | '600' | '700' = '700'): string {
  switch (weight) {
    case '500':
      return 'SpaceGrotesk_500Medium';
    case '600':
      return 'SpaceGrotesk_600SemiBold';
    default:
      return 'SpaceGrotesk_700Bold';
  }
}

/** Style snippet to give a heading the Space Grotesk display face. */
export const displayFont = (weight: '500' | '600' | '700' = '700') => ({
  fontFamily: display(weight),
});

let patched = false;
/**
 * Make Plus Jakarta Sans the global default for <Text>/<TextInput>. Idempotent.
 * Call once at module load, before anything renders.
 */
export function applyGlobalFont() {
  if (patched) return;
  patched = true;

  for (const Comp of [Text, TextInput] as any[]) {
    const original = Comp.render;
    if (typeof original !== 'function') continue;
    Comp.render = function patchedRender(...args: any[]) {
      const el = original.apply(this, args);
      if (!el) return el;
      const flat = StyleSheet.flatten(el.props.style) || {};
      // Leave explicit families alone: icon fonts, Space Grotesk headings, etc.
      if (flat.fontFamily) return el;
      return React.cloneElement(el, {
        style: [el.props.style, { fontFamily: jakarta(flat.fontWeight) }],
      });
    };
  }
}
