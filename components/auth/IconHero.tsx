// components/auth/IconHero.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { authColors, authSpace, authType } from '../../utils/authTheme';

interface IconHeroProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}

export default function IconHero({ icon, title, subtitle }: IconHeroProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.iconSlot}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: authSpace.lg,
  },
  iconSlot: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: authSpace.lg,
  },
  title: {
    fontSize: authType.sectionTitle.fontSize,
    lineHeight: authType.sectionTitle.lineHeight,
    letterSpacing: authType.sectionTitle.letterSpacing,
    fontWeight: authType.sectionTitle.fontWeight,
    color: authColors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: authSpace.md,
    fontSize: authType.body.fontSize,
    lineHeight: authType.body.lineHeight,
    fontWeight: authType.body.fontWeight,
    color: authColors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: authSpace.lg,
  },
});
