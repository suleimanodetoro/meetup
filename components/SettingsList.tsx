// components/SettingsList.tsx
//
// Shared building blocks for the Settings flow (Settings + Privacy), styled as
// grouped iOS-style cards: gray uppercase section headers, white rounded cards
// with hairline dividers, leading icons, and chevron / toggle / value trailing
// elements. Keeps every settings-style screen visually identical.

import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export const settingsTheme = {
  background: '#F2F3F5',
  card: '#FFFFFF',
  label: '#101114',
  sublabel: '#7C828B',
  sectionHeader: '#8A8F98',
  icon: '#5B6068',
  divider: '#E7E8EB',
  accent: '#007AFF',
  destructive: '#FF3B30',
  chevron: '#C4C7CC',
};

export function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title.toUpperCase()}</Text>;
}

/** A footnote rendered beneath a card, like iOS grouped-list descriptions. */
export function SectionFootnote({ children }: { children: React.ReactNode }) {
  return <Text style={styles.footnote}>{children}</Text>;
}

export function Card({
  children,
  dividerInset = 16,
  style,
}: {
  children: React.ReactNode;
  /** Left inset of the divider between rows (52 to clear a leading icon). */
  dividerInset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.card, style]}>
      {items.map((child, index) => (
        <React.Fragment key={index}>
          {child}
          {index < items.length - 1 ? (
            <View style={[styles.divider, { marginLeft: dividerInset }]} />
          ) : null}
        </React.Fragment>
      ))}
    </View>
  );
}

export function Chevron() {
  return <Ionicons name="chevron-forward" size={18} color={settingsTheme.chevron} />;
}

export function ExternalLinkIcon() {
  return <Ionicons name="open-outline" size={17} color={settingsTheme.chevron} />;
}

export function Check({ selected }: { selected: boolean }) {
  if (!selected) return null;
  return <Ionicons name="checkmark" size={21} color={settingsTheme.accent} />;
}

export function Row({
  icon,
  iconColor,
  label,
  sublabel,
  onPress,
  right,
  destructive = false,
  center = false,
  disabled = false,
}: {
  icon?: IoniconName;
  iconColor?: string;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
  center?: boolean;
  disabled?: boolean;
}) {
  const labelColor = destructive ? settingsTheme.destructive : settingsTheme.label;

  const content = (
    <View style={[styles.rowInner, center && styles.rowInnerCenter]}>
      {icon ? (
        <Ionicons
          name={icon}
          size={21}
          color={destructive ? settingsTheme.destructive : (iconColor ?? settingsTheme.icon)}
          style={styles.rowIcon}
        />
      ) : null}
      <View style={[styles.rowText, center && styles.rowTextCenter]}>
        <Text style={[styles.rowLabel, { color: labelColor }]} numberOfLines={1}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={styles.rowSublabel} numberOfLines={2}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.rowRight}>{right}</View> : null}
    </View>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    marginTop: 26,
    marginBottom: 9,
    marginLeft: 18,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: settingsTheme.sectionHeader,
  },
  footnote: {
    marginTop: 9,
    marginHorizontal: 18,
    fontSize: 13,
    lineHeight: 17,
    color: settingsTheme.sublabel,
  },
  card: {
    backgroundColor: settingsTheme.card,
    borderRadius: 14,
    marginHorizontal: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: settingsTheme.divider,
  },
  row: {
    minHeight: 54,
    justifyContent: 'center',
  },
  rowPressed: {
    backgroundColor: '#F4F5F7',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowInnerCenter: {
    justifyContent: 'center',
  },
  rowIcon: {
    marginRight: 15,
    width: 22,
    textAlign: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTextCenter: {
    flex: 0,
  },
  rowLabel: {
    fontSize: 17,
    fontWeight: '500',
  },
  rowSublabel: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 17,
    color: settingsTheme.sublabel,
  },
  rowRight: {
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
