// components/auth/AuthHeader.tsx
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { authColors, authHitSlop, authSpace } from '../../utils/authTheme';

interface AuthHeaderProps {
  onBack?: () => void;
  right?: React.ReactNode;
}

export default function AuthHeader({ onBack, right }: AuthHeaderProps) {
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    // Last-resort fallback. The chevron is always visible, so silently
    // no-op'ing on screens reached via deep-link (no stack history) looks
    // broken to users. Send them to /welcome — unauthenticated routing
    // takes over from there.
    router.replace('/welcome');
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={handleBack}
        hitSlop={authHitSlop}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={28} color={authColors.textPrimary} />
      </Pressable>
      <View style={styles.rightSlot}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: authSpace.sm,
    marginBottom: authSpace.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  rightSlot: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
