import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface FounderBadgeProps {
  size?: number;
  year?: number | null;
  style?: ViewStyle;
  showLabel?: boolean;
}

export function FounderBadge({ size = 22, year, style, showLabel = false }: FounderBadgeProps) {
  const iconSize = Math.max(14, size - 7);
  const containerSize = size + 8;

  if (showLabel) {
    return (
      <View style={[styles.labelPill, style]}>
        <LinearGradient colors={['#007AFF', '#6E56CF']} style={styles.labelIcon}>
          <Ionicons name="diamond" size={13} color="#FFFFFF" />
        </LinearGradient>
        <Text style={styles.labelText}>Founder{year ? ` · ${year}` : ''}</Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#007AFF', '#6E56CF']}
      style={[
        styles.badge,
        {
          width: containerSize,
          height: containerSize,
          borderRadius: containerSize / 2,
        },
        style,
      ]}>
      <Ionicons name="diamond" size={iconSize} color="#FFFFFF" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 4,
  },
  labelPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#DCE9FF',
  },
  labelIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },
  labelText: {
    color: '#050505',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
});
