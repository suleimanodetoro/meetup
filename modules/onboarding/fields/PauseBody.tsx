import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

/**
 * Interstitial step body — no field, no input. The Frame renders it inside
 * the standard chrome with Continue at the bottom. The step's `commit` is
 * a no-op; `isValid` is always true.
 */
export function PauseBody() {
  const fade = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [fade, slideUp]);

  return (
    <Animated.View
      style={{ opacity: fade, transform: [{ translateY: slideUp }] }}
    >
      <Text style={{ fontSize: 64, marginBottom: 24 }}>🎉</Text>

      <View
        style={{
          backgroundColor: 'white',
          borderRadius: 24,
          padding: 32,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 4,
        }}
      >
        <View style={{ gap: 24 }}>
          <ProgressRow icon="✓" title="Profile Created" subtitle="Looking good so far" />
          <ProgressRow icon="✓" title="Interests Selected" subtitle="Finding your people" />
          <ProgressRow icon="📸" title="Add Your Photo" subtitle="Next up" pending />
        </View>

        <View
          style={{
            marginTop: 32,
            height: 8,
            backgroundColor: '#F0F0F0',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: '60%',
              height: '100%',
              backgroundColor: '#007AFF',
              borderRadius: 4,
            }}
          />
        </View>

        <Text
          style={{ marginTop: 12, fontSize: 14, color: '#999', textAlign: 'center' }}
        >
          60% complete
        </Text>
      </View>
    </Animated.View>
  );
}

function ProgressRow({
  icon,
  title,
  subtitle,
  pending,
}: {
  icon: string;
  title: string;
  subtitle: string;
  pending?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: pending ? '#F5F5F5' : '#E3F2FD',
          borderWidth: pending ? 2 : 0,
          borderColor: '#007AFF',
          borderStyle: pending ? 'dashed' : 'solid',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 24 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#333' }}>
          {title}
        </Text>
        <Text style={{ fontSize: 14, color: '#999', marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}
