// components/SocialLinks.tsx
// The Socials row used on both the viewed profile and the own-profile tab.
// Always renders Instagram / TikTok / YouTube — each shows its handle and is
// tappable (opens the app or browser) when set, or a dimmed "Not set" when not.
import React, { ComponentProps } from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authColors } from '~/utils/authTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface SocialLinksProps {
  instagram?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
}

// Pull the @handle out of a stored social URL for display.
function handleFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const seg = url.replace(/\/+$/, '').split('/').pop() || '';
  return seg.replace(/^@/, '') || null;
}

export function SocialLinks({ instagram, tiktok, youtube }: SocialLinksProps) {
  const items: { key: string; icon: IconName; url?: string | null }[] = [
    { key: 'instagram', icon: 'logo-instagram', url: instagram },
    { key: 'tiktok', icon: 'logo-tiktok', url: tiktok },
    { key: 'youtube', icon: 'logo-youtube', url: youtube },
  ];

  return (
    <View style={styles.row}>
      {items.map(({ key, icon, url }) => {
        const handle = handleFromUrl(url);
        const content = (
          <>
            <Ionicons
              name={icon}
              size={18}
              color={handle ? authColors.textPrimary : authColors.textTertiary}
            />
            <Text style={[styles.text, !handle && styles.textEmpty]} numberOfLines={1}>
              {handle || 'Not set'}
            </Text>
          </>
        );

        // Tappable only when a URL is set; otherwise a dimmed, inert pill.
        return url ? (
          <Pressable
            key={key}
            style={styles.pill}
            onPress={() => Linking.openURL(url).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel={`Open ${key}`}>
            {content}
          </Pressable>
        ) : (
          <View key={key} style={[styles.pill, styles.pillEmpty]}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: authColors.surface,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pillEmpty: {
    opacity: 0.6,
  },
  text: {
    fontSize: 15,
    fontWeight: '500',
    color: authColors.textPrimary,
    flexShrink: 1,
  },
  textEmpty: {
    color: authColors.textTertiary,
  },
});
