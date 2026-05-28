// components/ErrorBanner.tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { authColors, authRadius, authSpace } from '../utils/authTheme';

interface ErrorBannerProps {
  message: string | null | undefined;
}

export default function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <View
      style={styles.banner}
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <Ionicons
        name="warning"
        size={18}
        color={authColors.error}
        style={styles.icon}
      />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: authColors.errorBannerBg,
    borderWidth: 1,
    borderColor: authColors.errorBannerBorder,
    borderRadius: authRadius.input,
    padding: authSpace.md,
    width: '100%',
  },
  icon: {
    marginRight: authSpace.sm,
    marginTop: 1,
  },
  message: {
    flex: 1,
    color: authColors.errorBannerText,
    fontSize: 14,
    lineHeight: 20,
  },
});
