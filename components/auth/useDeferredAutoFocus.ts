// components/auth/useDeferredAutoFocus.ts
import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import type { TextInput } from 'react-native';

/**
 * Focus a TextInput only after the screen's push animation has settled.
 *
 * Mount-time `autoFocus` raises the keyboard while the screen is still
 * sliding in, so the KeyboardAvoidingView reflows the layout mid-transition
 * and the whole screen visibly jumps. Native-stack screens emit
 * `transitionEnd` once the animation finishes; the timer is a fallback for
 * entries that never animate (initial route, deep-link cold start).
 */
export function useDeferredAutoFocus() {
  const ref = useRef<TextInput>(null);
  const navigation = useNavigation();

  useEffect(() => {
    let done = false;
    const focus = () => {
      if (done) return;
      done = true;
      ref.current?.focus();
    };

    const unsubscribe = navigation.addListener('transitionEnd' as never, focus as never);
    const fallback = setTimeout(focus, 700);

    return () => {
      unsubscribe();
      clearTimeout(fallback);
    };
  }, [navigation]);

  return ref;
}
