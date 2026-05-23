import { Text, View } from 'react-native';

/**
 * Educational body for the final notifications step. No input — the
 * Continue button (labelled "Enable Notifications") triggers the
 * permission request inside the step's `commit`. Skip writes
 * notifications_enabled: false.
 */
export function NotificationsBody() {
  return (
    <View style={{ paddingTop: 20 }}>
      <View style={{ alignItems: 'center', marginBottom: 30 }}>
        <View
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: 'white',
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#007AFF',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <Text style={{ fontSize: 50 }}>🔔</Text>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <FeatureCard
          emoji="💬"
          title="Messages"
          subtitle="Get notified when someone messages you"
        />
        <FeatureCard
          emoji="📅"
          title="Plan Updates"
          subtitle="Stay informed about your upcoming plans"
        />
        <FeatureCard
          emoji="🎯"
          title="New Connections"
          subtitle="Know when people nearby match your vibe"
        />
      </View>
    </View>
  );
}

function FeatureCard({
  emoji,
  title,
  subtitle,
}: {
  emoji: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View
      style={{
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          backgroundColor: '#E3F2FD',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 22 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontSize: 16, fontWeight: '600', marginBottom: 2, color: '#1A1A1A' }}
        >
          {title}
        </Text>
        <Text style={{ fontSize: 13, color: '#666', lineHeight: 18 }}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}
